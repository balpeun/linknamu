(() => {
  const root = document.getElementById('dash');
  let data = JSON.parse(document.getElementById('initial').textContent);
  let armedDelete = null;

  // ── 도우미 ──────────────────────────────────────────
  function h(tag, attrs = {}, kids = []) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === false || v == null) continue;
      if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of [].concat(kids)) if (c) el.append(c);
    return el;
  }

  let toastTimer;
  function toast(text, isErr = false) {
    document.querySelector('.toast')?.remove();
    const t = h('div', { class: 'toast' + (isErr ? ' err' : ''), role: 'status', text });
    document.body.append(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.remove(), isErr ? 4000 : 2000);
  }

  async function api(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    const out = await res.json().catch(() => ({}));
    if (res.status === 401) { location.href = '/login'; throw new Error(out.error); }
    if (!res.ok) throw new Error(out.error || '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    return out;
  }
  async function run(fn, okText) {
    try { await fn(); if (okText) toast(okText); render(); }
    catch (e) { toast(e.message, true); }
  }

  // 사진을 400px 정사각형 JPEG로 줄여서 올린다
  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const src = URL.createObjectURL(file);
      img.onload = () => {
        const size = 400;
        const s = Math.min(img.naturalWidth, img.naturalHeight);
        const c = document.createElement('canvas');
        c.width = c.height = size;
        c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
        URL.revokeObjectURL(src);
        resolve(c.toDataURL('image/jpeg', 0.86));
      };
      img.onerror = () => { URL.revokeObjectURL(src); reject(new Error('이미지를 읽을 수 없습니다. JPG나 PNG 파일을 골라 주세요.')); };
      img.src = src;
    });
  }

  // ── 화면 ────────────────────────────────────────────
  function avatarEl() {
    const u = data.user;
    if (u.hasAvatar) return h('img', { class: 'avatar', src: `/avatar/${u.username}?v=${u.updatedAt}`, alt: '프로필 사진' });
    return h('div', { class: 'avatar initial', 'aria-hidden': 'true', text: (Array.from((u.name || u.username).trim())[0] || '?').toUpperCase() });
  }

  function header() {
    const copyBtn = h('button', {
      class: 'btn primary small', type: 'button', text: '복사',
      onclick: async () => {
        try { await navigator.clipboard.writeText(data.pageUrl); toast('주소를 복사했습니다'); }
        catch { toast('복사하지 못했습니다. 주소를 직접 선택해 복사해 주세요.', true); }
      },
    });
    return h('div', { class: 'dash-head' }, [
      h('h1', { text: '내 페이지 관리' }),
      h('div', { class: 'share' }, [h('code', { text: data.pageUrl }), copyBtn]),
    ]);
  }

  function profileSection() {
    const u = data.user;
    const file = h('input', {
      type: 'file', id: 'avatar-file', accept: 'image/jpeg,image/png,image/webp', hidden: true,
      onchange: (e) => {
        const f = e.target.files[0];
        if (!f) return;
        run(async () => {
          const dataUrl = await resizeImage(f);
          await api('PUT', '/api/avatar', { dataUrl });
          data = await api('GET', '/api/me');
        }, '프로필 사진을 바꿨습니다');
      },
    });
    const name = h('input', { id: 'f-name', value: u.name, maxlength: 40, placeholder: '화면에 보일 이름' });
    const bio = h('textarea', { id: 'f-bio', maxlength: 160, rows: 2, placeholder: '예: 일러스트레이터 · 매주 금요일 작업 업로드' });
    bio.value = u.bio;
    const bioCount = h('small', { text: `${u.bio.length} / 160` });
    bio.addEventListener('input', () => { bioCount.textContent = `${bio.value.length} / 160`; });

    return h('section', { class: 'section', 'aria-labelledby': 'h-profile' }, [
      h('h2', { id: 'h-profile', text: '프로필' }),
      h('div', { class: 'avatar-row' }, [
        avatarEl(),
        h('div', { class: 'btns' }, [
          file,
          h('button', { class: 'btn small', type: 'button', text: u.hasAvatar ? '사진 바꾸기' : '사진 올리기', onclick: () => file.click() }),
          u.hasAvatar ? h('button', { class: 'btn ghost small', type: 'button', text: '사진 삭제', onclick: () => run(async () => { await api('DELETE', '/api/avatar'); data = await api('GET', '/api/me'); }, '사진을 삭제했습니다') }) : null,
        ]),
      ]),
      h('div', { class: 'field' }, [h('label', { for: 'f-name', text: '이름' }), name]),
      h('div', { class: 'field' }, [h('label', { for: 'f-bio', text: '한 줄 소개' }), bio, bioCount]),
      h('div', { class: 'row-end' }, [
        h('span'),
        h('button', {
          class: 'btn primary', type: 'button', id: 'save-profile', text: '프로필 저장',
          onclick: () => run(async () => {
            await api('PUT', '/api/profile', { name: name.value, bio: bio.value });
            data = await api('GET', '/api/me');
          }, '프로필을 저장했습니다'),
        }),
      ]),
    ]);
  }

  function linkItem(l, i, all) {
    const title = h('input', { id: `t-${l.id}`, value: l.title, maxlength: 80, placeholder: l.platform.name, 'aria-label': '링크 제목' });
    const url = h('input', { id: `u-${l.id}`, value: l.url, inputmode: 'url', 'aria-label': '링크 주소' });
    const save = () => {
      if (title.value === l.title && url.value === l.url) return;
      run(async () => { data = await api('PUT', `/api/links/${l.id}`, { title: title.value, url: url.value }); }, '저장했습니다');
    };
    title.addEventListener('change', save);
    url.addEventListener('change', save);
    const move = (d) => {
      const ids = all.map((x) => x.id);
      [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
      run(async () => { data = await api('PUT', '/api/links/order', { ids }); });
    };
    const armed = armedDelete === l.id;
    return h('li', { class: `link-item kind-${l.platform.kind}` }, [
      h('span', { class: 'badge', 'aria-hidden': 'true', text: l.platform.abbr }),
      h('div', { class: 'inputs' }, [
        title, url,
        h('span', { class: 'count' }, [h('b', { text: l.clicks.toLocaleString('ko-KR') }), ` 클릭 · 최근 7일 ${l.clicks7d.toLocaleString('ko-KR')}`]),
      ]),
      h('div', { class: 'tools' }, [
        h('button', { class: 'icon', type: 'button', title: '위로', 'aria-label': '위로', disabled: i === 0, text: '↑', onclick: () => move(-1) }),
        h('button', { class: 'icon', type: 'button', title: '아래로', 'aria-label': '아래로', disabled: i === all.length - 1, text: '↓', onclick: () => move(1) }),
        h('button', {
          class: 'icon del' + (armed ? ' armed' : ''), type: 'button',
          title: armed ? '한 번 더 누르면 삭제' : '삭제', 'aria-label': armed ? '한 번 더 누르면 삭제' : '삭제', text: armed ? '!' : '✕',
          onclick: () => {
            if (!armed) { armedDelete = l.id; render(); setTimeout(() => { if (armedDelete === l.id) { armedDelete = null; render(); } }, 3000); return; }
            armedDelete = null;
            run(async () => { data = await api('DELETE', `/api/links/${l.id}`); }, '링크를 삭제했습니다');
          },
        }),
      ]),
    ]);
  }

  function linksSection() {
    const links = data.links;
    const total = links.reduce((s, l) => s + l.clicks, 0);
    const week = links.reduce((s, l) => s + l.clicks7d, 0);
    const top = links.reduce((best, l) => (!best || l.clicks > best.clicks ? l : best), null);

    const title = h('input', { id: 'new-title', placeholder: '제목 (예: 유튜브 채널)', maxlength: 80, 'aria-label': '새 링크 제목' });
    const url = h('input', { id: 'new-url', placeholder: 'youtube.com/@내채널', inputmode: 'url', required: true, 'aria-label': '새 링크 주소' });
    const form = h('form', {
      class: 'add-form',
      onsubmit: (e) => {
        e.preventDefault();
        run(async () => {
          data = await api('POST', '/api/links', { title: title.value, url: url.value });
          setTimeout(() => document.getElementById('new-title')?.focus(), 0);
        }, '링크를 추가했습니다');
      },
    }, [title, url, h('button', { class: 'btn primary', type: 'submit', text: '추가' })]);

    return h('section', { class: 'section', 'aria-labelledby': 'h-links' }, [
      h('h2', { id: 'h-links' }, ['링크 카드', h('small', { text: `${links.length}개` })]),
      h('div', { class: 'stats' }, [
        h('div', {}, [h('b', { text: total.toLocaleString('ko-KR') }), h('span', { text: '전체 클릭' })]),
        h('div', {}, [h('b', { text: week.toLocaleString('ko-KR') }), h('span', { text: '최근 7일' })]),
        h('div', {}, [h('b', { text: top && top.clicks ? (top.title || top.platform.name) : '–', class: 'top-name' }), h('span', { text: '가장 많이 눌린 링크' })]),
      ]),
      form,
      links.length
        ? h('ul', { class: 'link-list' }, links.map((l, i) => linkItem(l, i, links)))
        : h('p', { class: 'msg', text: '아직 링크가 없습니다. 위에 주소를 넣고 추가를 누르면 첫 카드가 생깁니다.' }),
      h('div', { class: 'row-end' }, [
        h('span', { class: 'msg', text: '제목이나 주소를 고친 뒤 칸을 벗어나면 자동으로 저장됩니다.' }),
        h('button', { class: 'btn small', type: 'button', text: '클릭 수 새로고침', onclick: () => run(async () => { data = await api('GET', '/api/me'); }, '최신 클릭 수를 불러왔습니다') }),
      ]),
    ]);
  }

  function render() {
    const focusId = document.activeElement?.id;
    root.replaceChildren(header(), profileSection(), linksSection());
    if (focusId) document.getElementById(focusId)?.focus();
  }

  render();
})();
