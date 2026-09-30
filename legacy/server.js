import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, tx } from './db.js';
import { landingPage, authPage, profilePage, dashboardPage, notFoundPage, platformOf } from './views.js';

const PORT = Number(process.env.PORT) || 3000;
const SESSION_DAYS = 30;
const MAX_BODY = 1.5 * 1024 * 1024; // 프로필 사진(data URL) 포함
const MAX_AVATAR = 1024 * 1024;
const MAX_LINKS = 50;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const RESERVED = new Set(['login', 'signup', 'logout', 'dashboard', 'api', 'go', 'avatar', 'static', 'admin', 'about', 'help', 'settings', 'www']);
const DAY = 24 * 60 * 60 * 1000;

// ── 비밀번호 ────────────────────────────────────────────
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return salt.toString('hex') + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
}
function verifyPassword(pw, stored) {
  const [salt, hash] = stored.split(':');
  const got = crypto.scryptSync(pw, Buffer.from(salt, 'hex'), 64);
  return crypto.timingSafeEqual(got, Buffer.from(hash, 'hex'));
}

// ── 세션 ────────────────────────────────────────────────
function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function isSecure(req) {
  return req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
}
function sessionCookie(req, value, maxAge) {
  return `sid=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isSecure(req) ? '; Secure' : ''}`;
}
function createSession(req, res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, Date.now() + SESSION_DAYS * DAY);
  res.setHeader('Set-Cookie', sessionCookie(req, token, SESSION_DAYS * 86400));
}
function currentUser(req) {
  const token = parseCookies(req).sid;
  if (!token) return null;
  return db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?`).get(token, Date.now()) || null;
}

// ── 간단한 요청 제한 (로그인·가입 무차별 시도 방지) ──────────
const attempts = new Map();
function rateLimited(req, key, limit = 10, windowMs = 10 * 60 * 1000) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
  const k = key + ':' + ip;
  const now = Date.now();
  const list = (attempts.get(k) || []).filter((t) => now - t < windowMs);
  list.push(now);
  attempts.set(k, list);
  return list.length > limit;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, list] of attempts) if (list.every((t) => now - t > 10 * 60 * 1000)) attempts.delete(k);
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
}, 10 * 60 * 1000).unref();

// ── 요청/응답 도우미 ────────────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error('too_large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
async function readJson(req) {
  if (!(req.headers['content-type'] || '').startsWith('application/json')) throw Object.assign(new Error('JSON 요청만 받습니다.'), { status: 415 });
  try { return JSON.parse(await readBody(req) || '{}'); } catch (e) { if (e.status) throw e; throw Object.assign(new Error('요청 형식이 올바르지 않습니다.'), { status: 400 }); }
}
async function readForm(req) {
  return Object.fromEntries(new URLSearchParams(await readBody(req)));
}
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; form-action 'self'; frame-ancestors 'none'",
};
function send(res, status, body, type = 'text/html; charset=utf-8', extra = {}) {
  res.writeHead(status, { 'Content-Type': type, ...SECURITY_HEADERS, ...extra });
  res.end(body);
}
const json = (res, status, obj) => send(res, status, JSON.stringify(obj), 'application/json; charset=utf-8', { 'Cache-Control': 'no-store' });
const redirect = (res, to) => { res.writeHead(303, { Location: to }); res.end(); };
const fail = (status, message) => Object.assign(new Error(message), { status });
const hostOf = (req) => req.headers.host || `localhost:${PORT}`;

// ── 입력 검증 ───────────────────────────────────────────
function cleanText(v, max) {
  return String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, max);
}
function cleanUrl(v) {
  let u = String(v ?? '').trim();
  if (!u) throw fail(400, '링크 주소를 입력해 주세요.');
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
  let parsed;
  try { parsed = new URL(u); } catch { throw fail(400, '링크 주소가 올바르지 않습니다.'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname.includes('.')) throw fail(400, 'http:// 또는 https://로 시작하는 웹 주소를 넣어 주세요.');
  if (parsed.href.length > 2000) throw fail(400, '링크 주소가 너무 깁니다.');
  return parsed.href;
}

// ── 대시보드 데이터 ─────────────────────────────────────
function dashboardData(user, host) {
  const since = Date.now() - 7 * DAY;
  const links = db.prepare(`
    SELECT l.id, l.title, l.url, l.clicks,
           (SELECT COUNT(*) FROM clicks c WHERE c.link_id = l.id AND c.at >= ?) AS clicks7d
    FROM links l WHERE l.user_id = ? ORDER BY l.position, l.id`).all(since, user.id);
  return {
    user: { username: user.username, name: user.name, bio: user.bio, hasAvatar: !!user.avatar_type, updatedAt: user.updated_at },
    pageUrl: `${host.startsWith('localhost') ? 'http' : 'https'}://${host}/${user.username}`,
    links: links.map((l) => ({ ...l, platform: platformOf(l.url) })),
  };
}
const ownLink = (user, id) => {
  const link = db.prepare('SELECT * FROM links WHERE id = ? AND user_id = ?').get(Number(id), user.id);
  if (!link) throw fail(404, '링크를 찾을 수 없습니다.');
  return link;
};
const touch = (user) => db.prepare('UPDATE users SET updated_at = ? WHERE id = ?').run(Date.now(), user.id);

// ── 정적 파일 ───────────────────────────────────────────
const STATIC = {
  'style.css': 'text/css; charset=utf-8',
  'dashboard.js': 'text/javascript; charset=utf-8',
  'favicon.svg': 'image/svg+xml',
};
const staticCache = {};
function serveStatic(res, name) {
  if (!STATIC[name]) return false;
  if (!staticCache[name] || process.env.NODE_ENV !== 'production') staticCache[name] = fs.readFileSync(path.join(import.meta.dirname, 'public', name));
  send(res, 200, staticCache[name], STATIC[name], { 'Cache-Control': 'public, max-age=300' });
  return true;
}

// ── 라우팅 ──────────────────────────────────────────────
const BOT_RE = /bot|crawler|spider|slurp|facebookexternalhit|embedly|preview|whatsapp|kakaotalk-scrap|discordbot|telegrambot/i;

async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const m = req.method;
  const host = hostOf(req);

  if (m === 'GET' && p.startsWith('/static/')) { if (serveStatic(res, p.slice(8))) return; }

  if (m === 'GET' && p === '/') return send(res, 200, landingPage(currentUser(req), host));

  // 가입 / 로그인 / 로그아웃
  if (p === '/signup' || p === '/login') {
    const mode = p.slice(1);
    if (m === 'GET') return currentUser(req) ? redirect(res, '/dashboard') : send(res, 200, authPage(mode, { host }));
    if (m === 'POST') {
      const f = await readForm(req);
      const username = String(f.username || '').trim().toLowerCase();
      const password = String(f.password || '');
      const again = (error, status = 400) => send(res, status, authPage(mode, { error, username, host }));
      if (rateLimited(req, mode)) return again('시도가 너무 많습니다. 10분 뒤에 다시 시도해 주세요.', 429);
      if (mode === 'signup') {
        if (!USERNAME_RE.test(username)) return again('아이디는 영문 소문자, 숫자, 밑줄(_)로 3~20자여야 합니다.');
        if (RESERVED.has(username)) return again('사용할 수 없는 아이디입니다. 다른 아이디를 골라 주세요.');
        if (password.length < 8) return again('비밀번호는 8자 이상이어야 합니다.');
        if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) return again('이미 사용 중인 아이디입니다.');
        const now = Date.now();
        const r = db.prepare('INSERT INTO users (username, pw_hash, name, updated_at, created_at) VALUES (?, ?, ?, ?, ?)').run(username, hashPassword(password), username, now, now);
        createSession(req, res, Number(r.lastInsertRowid));
        return redirect(res, '/dashboard');
      }
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
      if (!user || !verifyPassword(password, user.pw_hash)) return again('아이디 또는 비밀번호가 맞지 않습니다.', 401);
      createSession(req, res, user.id);
      return redirect(res, '/dashboard');
    }
  }
  if (m === 'POST' && p === '/logout') {
    const token = parseCookies(req).sid;
    if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    res.setHeader('Set-Cookie', sessionCookie(req, '', 0));
    return redirect(res, '/');
  }

  // 대시보드
  if (m === 'GET' && p === '/dashboard') {
    const user = currentUser(req);
    if (!user) return redirect(res, '/login');
    return send(res, 200, dashboardPage(user, dashboardData(user, host)), undefined, { 'Cache-Control': 'no-store' });
  }

  // API (로그인 필요)
  if (p.startsWith('/api/')) {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: '다시 로그인해 주세요.' });

    if (m === 'GET' && p === '/api/me') return json(res, 200, dashboardData(user, host));

    if (m === 'PUT' && p === '/api/profile') {
      const b = await readJson(req);
      const name = cleanText(b.name, 40);
      const bio = cleanText(b.bio, 160);
      db.prepare('UPDATE users SET name = ?, bio = ?, updated_at = ? WHERE id = ?').run(name, bio, Date.now(), user.id);
      return json(res, 200, { ok: true });
    }

    if (p === '/api/avatar') {
      if (m === 'PUT') {
        const b = await readJson(req);
        const mt = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(b.dataUrl || ''));
        if (!mt) throw fail(400, 'JPG, PNG, WEBP 이미지만 올릴 수 있습니다.');
        const buf = Buffer.from(mt[2], 'base64');
        if (buf.length > MAX_AVATAR) throw fail(400, '사진 용량이 너무 큽니다. 1MB 이하로 올려 주세요.');
        db.prepare('UPDATE users SET avatar = ?, avatar_type = ?, updated_at = ? WHERE id = ?').run(buf, mt[1], Date.now(), user.id);
        return json(res, 200, { ok: true });
      }
      if (m === 'DELETE') {
        db.prepare('UPDATE users SET avatar = NULL, avatar_type = NULL, updated_at = ? WHERE id = ?').run(Date.now(), user.id);
        return json(res, 200, { ok: true });
      }
    }

    if (m === 'POST' && p === '/api/links') {
      const b = await readJson(req);
      const count = db.prepare('SELECT COUNT(*) AS n FROM links WHERE user_id = ?').get(user.id).n;
      if (count >= MAX_LINKS) throw fail(400, `링크는 최대 ${MAX_LINKS}개까지 등록할 수 있습니다.`);
      const linkUrl = cleanUrl(b.url);
      const title = cleanText(b.title, 80);
      const pos = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM links WHERE user_id = ?').get(user.id).p;
      db.prepare('INSERT INTO links (user_id, title, url, position, created_at) VALUES (?, ?, ?, ?, ?)').run(user.id, title, linkUrl, pos, Date.now());
      touch(user);
      return json(res, 201, dashboardData(user, host));
    }

    if (m === 'PUT' && p === '/api/links/order') {
      const b = await readJson(req);
      const ids = Array.isArray(b.ids) ? b.ids.map(Number) : [];
      const mine = db.prepare('SELECT id FROM links WHERE user_id = ?').all(user.id).map((r) => r.id);
      if (ids.length !== mine.length || !mine.every((id) => ids.includes(id))) throw fail(400, '순서 정보가 올바르지 않습니다. 새로고침 후 다시 시도해 주세요.');
      const stmt = db.prepare('UPDATE links SET position = ? WHERE id = ? AND user_id = ?');
      tx(() => ids.forEach((id, i) => stmt.run(i, id, user.id)));
      touch(user);
      return json(res, 200, dashboardData(user, host));
    }

    const lm = /^\/api\/links\/(\d+)$/.exec(p);
    if (lm) {
      const link = ownLink(user, lm[1]);
      if (m === 'PUT') {
        const b = await readJson(req);
        db.prepare('UPDATE links SET title = ?, url = ? WHERE id = ?').run(cleanText(b.title, 80), cleanUrl(b.url), link.id);
        touch(user);
        return json(res, 200, dashboardData(user, host));
      }
      if (m === 'DELETE') {
        db.prepare('DELETE FROM links WHERE id = ?').run(link.id);
        touch(user);
        return json(res, 200, dashboardData(user, host));
      }
    }
    return json(res, 404, { error: '없는 API입니다.' });
  }

  // 링크 클릭: 집계 후 실제 주소로 이동
  const gm = /^\/go\/(\d+)$/.exec(p);
  if (gm && (m === 'GET' || m === 'HEAD')) {
    const link = db.prepare('SELECT id, url FROM links WHERE id = ?').get(Number(gm[1]));
    if (!link) return send(res, 404, notFoundPage());
    const prefetch = /prefetch|prerender/i.test(`${req.headers['sec-purpose'] || ''} ${req.headers.purpose || ''}`);
    if (m === 'GET' && !prefetch && !BOT_RE.test(req.headers['user-agent'] || '')) {
      tx(() => {
        db.prepare('UPDATE links SET clicks = clicks + 1 WHERE id = ?').run(link.id);
        db.prepare('INSERT INTO clicks (link_id, at) VALUES (?, ?)').run(link.id, Date.now());
      });
    }
    res.writeHead(302, { Location: link.url, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer-when-downgrade' });
    return res.end();
  }

  // 프로필 사진
  const am = /^\/avatar\/([a-z0-9_]{3,20})$/.exec(p);
  if (am && m === 'GET') {
    const u = db.prepare('SELECT avatar, avatar_type FROM users WHERE username = ?').get(am[1]);
    if (!u || !u.avatar_type) return send(res, 404, 'not found', 'text/plain');
    return send(res, 200, Buffer.from(u.avatar), u.avatar_type, { 'Cache-Control': 'public, max-age=31536000, immutable' });
  }

  // 공개 프로필 페이지: /아이디
  const um = /^\/([A-Za-z0-9_]{3,20})\/?$/.exec(p);
  if (um && m === 'GET') {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(um[1].toLowerCase());
    if (user) {
      if (um[1] !== user.username || p.endsWith('/')) return redirect(res, '/' + user.username);
      const links = db.prepare('SELECT id, title, url FROM links WHERE user_id = ? ORDER BY position, id').all(user.id);
      return send(res, 200, profilePage(user, links), undefined, { 'Cache-Control': 'no-cache' });
    }
  }

  return send(res, 404, notFoundPage());
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    if (res.headersSent) return res.end();
    const message = status === 500 ? '서버에 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.' : status === 413 ? '보낸 데이터가 너무 큽니다.' : e.message;
    if ((req.url || '').startsWith('/api/')) return json(res, status, { error: message });
    send(res, status, `<!doctype html><meta charset="utf-8"><p>${message}</p>`);
  });
});

server.listen(PORT, () => console.log(`링크나무 실행 중: http://localhost:${PORT}`));
