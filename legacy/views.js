export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// 주소로 SNS·블로그 종류를 알아내 카드에 표시한다. [호스트 패턴, 이름, 약칭, 분류]
const PLATFORMS = [
  [/(^|\.)instagram\.com$/, 'Instagram', 'IG', 'sns'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube', 'YT', 'sns'],
  [/(^|\.)(x\.com|twitter\.com)$/, 'X', 'X', 'sns'],
  [/(^|\.)threads\.(net|com)$/, 'Threads', 'TH', 'sns'],
  [/(^|\.)tiktok\.com$/, 'TikTok', 'TT', 'sns'],
  [/(^|\.)facebook\.com$/, 'Facebook', 'FB', 'sns'],
  [/(^|\.)linkedin\.com$/, 'LinkedIn', 'in', 'sns'],
  [/(^|\.)github\.com$/, 'GitHub', 'GH', 'dev'],
  [/(^|\.)gitlab\.com$/, 'GitLab', 'GL', 'dev'],
  [/(^|\.)blog\.naver\.com$/, '네이버 블로그', 'N', 'blog'],
  [/(^|\.)tistory\.com$/, '티스토리', 'T', 'blog'],
  [/(^|\.)velog\.io$/, 'velog', 'V', 'blog'],
  [/(^|\.)brunch\.co\.kr$/, '브런치', 'B', 'blog'],
  [/(^|\.)medium\.com$/, 'Medium', 'M', 'blog'],
  [/(^|\.)substack\.com$/, 'Substack', 'S', 'blog'],
];

export function platformOf(url) {
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch {}
  for (const [re, name, abbr, kind] of PLATFORMS) if (re.test(host)) return { name, abbr, kind, host };
  return { name: '웹사이트', abbr: (host[0] || '↗').toUpperCase(), kind: 'web', host };
}

function layout(title, body, { bodyClass = '', scripts = '' } = {}) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="icon" href="/static/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Do+Hyeon&family=IBM+Plex+Sans+KR:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/static/style.css">
</head>
<body class="${bodyClass}">
${body}
${scripts}
</body>
</html>`;
}

const brand = `<a class="brand" href="/"><span class="brand-mark" aria-hidden="true"></span>링크나무</a>`;

export function landingPage(user, host) {
  return layout('링크나무', `
<header class="topbar">${brand}
  <nav class="nav">${user
    ? `<a class="btn primary" href="/dashboard">내 페이지 관리</a>`
    : `<a class="btn" href="/login">로그인</a><a class="btn primary" href="/signup">시작하기</a>`}</nav>
</header>
<main class="landing">
  <section class="hero">
    <h1>링크는 여러 개,<br>주소는 하나.</h1>
    <p class="lead">인스타그램, 유튜브, 블로그, 포트폴리오. 흩어진 링크를 한 페이지에 모으고 프로필에는 주소 하나만 걸어 두세요.</p>
    <a class="btn primary big" href="${user ? '/dashboard' : '/signup'}">${user ? '내 페이지 관리' : '무료로 내 페이지 만들기'}</a>
    <p class="url-demo"><span>${esc(host)}/</span><b>내아이디</b></p>
  </section>
  <section class="features">
    <div><h2>프로필</h2><p>이름, 한 줄 소개, 프로필 사진으로 나를 소개합니다.</p></div>
    <div><h2>링크 카드</h2><p>주소를 붙여 넣으면 인스타그램·유튜브·블로그 같은 종류를 알아서 표시합니다.</p></div>
    <div><h2>클릭 수</h2><p>링크마다 전체 클릭 수와 최근 7일 클릭 수를 보여 줍니다.</p></div>
  </section>
</main>`, { bodyClass: 'page-landing' });
}

export function authPage(mode, { error = "", username = "", host = "" } = {}) {
  const isSignup = mode === 'signup';
  return layout(isSignup ? '가입하기 · 링크나무' : '로그인 · 링크나무', `
<header class="topbar">${brand}</header>
<main class="auth">
  <form class="panel" method="post" action="/${mode}">
    <h1>${isSignup ? '내 페이지 만들기' : '로그인'}</h1>
    ${error ? `<p class="msg err" role="alert">${esc(error)}</p>` : ''}
    <div class="field">
      <label for="username">아이디</label>
      <div class="prefix-input"><span>${esc(host)}/</span><input id="username" name="username" value="${esc(username)}" required autocomplete="username" autocapitalize="none" spellcheck="false" pattern="[a-z0-9_]{3,20}" maxlength="20"></div>
      ${isSignup ? '<small>영문 소문자, 숫자, 밑줄(_)로 3~20자. 내 페이지 주소가 됩니다.</small>' : ''}
    </div>
    <div class="field">
      <label for="password">비밀번호</label>
      <input id="password" name="password" type="password" required minlength="8" autocomplete="${isSignup ? 'new-password' : 'current-password'}">
      ${isSignup ? '<small>8자 이상</small>' : ''}
    </div>
    <button class="btn primary big" type="submit">${isSignup ? '가입하고 시작하기' : '로그인'}</button>
    <p class="alt">${isSignup ? '이미 계정이 있나요? <a href="/login">로그인</a>' : '아직 계정이 없나요? <a href="/signup">가입하기</a>'}</p>
  </form>
</main>`, { bodyClass: 'page-auth' });
}

export function avatarHtml(user, cls = 'avatar') {
  if (user.avatar_type) return `<img class="${cls}" src="/avatar/${esc(user.username)}?v=${user.updated_at}" alt="${esc(user.name || user.username)} 프로필 사진">`;
  const initial = Array.from((user.name || user.username).trim())[0] || '?';
  return `<div class="${cls} initial" aria-hidden="true">${esc(initial.toUpperCase())}</div>`;
}

export function profilePage(user, links) {
  const cards = links.map((l) => {
    const p = platformOf(l.url);
    return `<li><a class="card kind-${p.kind}" href="/go/${l.id}">
      <span class="badge" aria-hidden="true">${esc(p.abbr)}</span>
      <span class="card-text"><span class="card-title">${esc(l.title || p.name)}</span><span class="card-meta">${esc(p.name)} · ${esc(p.host)}</span></span>
      <span class="arrow" aria-hidden="true">→</span>
    </a></li>`;
  }).join('');
  return layout(`${user.name || user.username} · 링크나무`, `
<main class="profile">
  <header class="profile-head">
    ${avatarHtml(user)}
    <h1>${esc(user.name || user.username)}</h1>
    ${user.bio ? `<p class="bio">${esc(user.bio)}</p>` : ''}
  </header>
  ${links.length ? `<ul class="cards">${cards}</ul>` : '<p class="empty">아직 등록된 링크가 없습니다.</p>'}
  <footer class="profile-foot"><a href="/">${'링크나무'}로 내 페이지 만들기</a></footer>
</main>`, { bodyClass: 'page-profile' });
}

export function dashboardPage(user, data) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return layout('내 페이지 관리 · 링크나무', `
<header class="topbar">${brand}
  <nav class="nav"><a class="btn" href="/${esc(user.username)}" target="_blank" rel="noopener">내 페이지 보기</a>
  <form method="post" action="/logout"><button class="btn ghost" type="submit">로그아웃</button></form></nav>
</header>
<main class="dash" id="dash"></main>
<script type="application/json" id="initial">${json}</script>`, {
    bodyClass: 'page-dash',
    scripts: '<script src="/static/dashboard.js" defer></script>',
  });
}

export function notFoundPage() {
  return layout('페이지를 찾을 수 없습니다 · 링크나무', `
<header class="topbar">${brand}</header>
<main class="auth"><div class="panel"><h1>페이지를 찾을 수 없습니다</h1><p>주소가 바뀌었거나 없는 페이지입니다.</p><a class="btn primary" href="/">링크나무 홈으로</a></div></main>`);
}
