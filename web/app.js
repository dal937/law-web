'use strict';
// 법그물 — 정적 JSON(data/index.json, data/law/{id}.json)만 읽는 화면. 서버 없음.
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = k => { const m = /^(\d+)의(\d+)$/.exec(k); return m ? `제${m[1]}조의${m[2]}` : `제${k}조`; };
const nf = n => n.toLocaleString('ko-KR');
const kc = kind => (kind === '헌법' || kind === '법률') ? 'k1' : kind === '대통령령' ? 'k2' : 'k3';
const cut = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;
const norm = s => s.replace(/[\s·ㆍ‧]/g, '');
const app = $('#app'), sheet = $('#sheet'), sheetIn = $('#sheet-in');
let IDX, CUR = null;            // CUR = 지금 그려진 법(풀어 놓은 것)
const cache = new Map();
const L = i => { const r = IDX.laws[i]; return { id: i, name: r[0], kind: r[1], min: r[2], n: r[3], ind: r[4], outd: r[5], plaw: r[6], nb: r[7] }; };
const load = id => { if (!cache.has(id)) cache.set(id, fetch(`data/law/${id}.json`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })); return cache.get(id); };
const href = (id, key) => `#/l/${id}` + (key != null ? '/' + encodeURIComponent(key) : '');
const lawRow = (l, num) => `<li><a href="${href(l.id)}"><i class="dot ${kc(l.kind)}"></i><span class="nm">${esc(l.name)}</span><span class="num">${num}</span></a></li>`;

// ── 첫 화면 ────────────────────────────────────────────────────
let MAPG = null, MAPM = null;
function home(focus) {
  CUR = null; document.title = '법그물 — 한국 법의 언어 그물';
  const all = IDX.laws.map((_, i) => L(i)), arts = all.reduce((s, l) => s + l.n, 0);
  const top = all.slice().sort((a, b) => b.ind - a.ind).slice(0, 15);
  app.innerHTML = `<div class="map"><canvas aria-label="법령 전체 지도"></canvas><div class="ttl">한국 법의 언어 그물<small>법령 ${nf(all.length)}개 · 조 ${nf(arts)}개 · 점 하나가 법 하나</small></div>
<div class="zb"><button class="zin" aria-label="키우기">＋</button><button class="zout" aria-label="줄이기">－</button><button class="zall">전체</button></div></div>
<div class="pick mpick"><span class="nm muted">가운데가 헌법, 둘레 여덟 덩어리가 분야입니다. 덩어리를 누르면 그 분야로 들어갑니다.</span></div>
<div class="mlegend" id="mleg"></div>
<div class="card" id="mread" hidden></div>
<p class="note pad">점 하나 = 법 하나, 클수록 많이 불리는 법. 줄 = 한 법의 조가 다른 법을 부름. 분야는 맡은 부처로 나눔. 흐르는 빛은 꾸밈.</p>
<div class="card"><h2>베틀로 보기</h2><p class="sub">법률과 그 시행령·시행규칙이 한 집안으로 짜이는 모습. 법을 열면 맨 위에 나옵니다.</p><ul class="list">${['도로교통법', '개인정보 보호법', '건축법', '근로기준법', '소득세법', '국민건강보험법'].map(n => all.find(l => l.name === n)).filter(Boolean).map(l => lawRow(l, nf(l.n) + '조')).join('')}</ul></div>
<input type="search" id="q" placeholder="법 이름 찾기 (예: 민법, 개인정보)" autocomplete="off" enterkeyhint="search">
<div class="card" id="res" hidden><ul class="list"></ul></div>
<div class="card"><h2>헌법에서 시작</h2><p class="sub">모든 법의 꼭대기. 헌법이 "법률로 정한다"며 아래로 넘기는 곳을 봅니다.</p><a class="btn" href="${href(IDX.const)}">대한민국헌법 열기</a></div>
<div class="card"><h2>가장 많이 불리는 법</h2><p class="sub">다른 법의 조가 이 법의 조를 가리킨 줄 수.</p><ul class="list">${top.map(l => lawRow(l, nf(l.ind) + '줄')).join('')}</ul>
<div class="legend"><span><i class="k1"></i>헌법·법률</span><span><i class="k2"></i>대통령령</span><span><i class="k3"></i>부령·그 밖 규칙</span></div></div>
<p class="note pad">자료: 법제처 국가법령정보센터 공개 자료(legalize-kr 저장소, ${esc(IDX.made)} 기준). 줄은 글자 규칙으로 뽑아 빠지거나 틀린 것이 있을 수 있습니다.</p>`;
  const mp = $('.mpick');
  LawMap.mount($('.map'), IDX, (i, nb, grp, gi) => {
    if (i < 0) return;
    const l = L(i); mp.innerHTML = `<i class="dot" style="background:${LawMap.COL[gi]}"></i><span class="nm">${esc(l.name)}<br><span class="num">${esc(l.kind)} · ${esc(grp)} · 이어진 법 ${nf(nb)}개</span></span><a class="btn" href="${href(i)}">열기</a>`;
  }, focus, g => {
    if (g < 0 || !MAPM) { mp.innerHTML = `<span class="nm muted">가운데가 헌법, 둘레 여덟 덩어리가 분야입니다. 덩어리를 누르면 그 분야로 들어갑니다.</span>`; return; }
    const m = MAPM, top = all.filter(l => m.g[l.id] === g).sort((a, b) => b.ind - a.ind).slice(0, 3), to = m.flow[g].map((n, k) => [k, n + m.flow[k][g]]).filter(x => x[0] !== g).sort((a, b) => b[1] - a[1])[0];
    mp.innerHTML = `<i class="dot" style="background:${LawMap.COL[g]}"></i><span class="nm"><b>${esc(m.groups[g])}</b> · 법령 ${nf(m.cen[g][2])}개<br><span class="num">많이 불리는 법: ${top.map(l => esc(cut(l.name, 12))).join(', ')} · 가장 많이 주고받는 분야: ${esc(m.groups[to[0]])}</span><br><span class="num">점을 누르면 그 법의 줄이 켜집니다.</span></span>`;
  }).then(m => { if (!m) return; MAPM = m; MAPG = m.g;
    $('#mleg').innerHTML = m.groups.map((g, k) => `<button class="btn" data-g="${k}"><i style="background:${LawMap.COL[k]}"></i>${esc(g)}</button>`).join('');
    $('#mleg').onclick = ev => { const b = ev.target.closest('button[data-g]'); if (b) { $('.map').enter(+b.dataset.g); $('.map').scrollIntoView({ block: 'start' }); } };
    const tot = m.flow.flat().reduce((a, b) => a + b, 0), self = m.flow.reduce((a, r, k) => a + r[k], 0), prs = [];
    for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) prs.push([a, b, m.flow[a][b] + m.flow[b][a]]); prs.sort((x, y) => y[2] - x[2]);
    const big = all.slice().sort((a, b) => b.ind - a.ind)[0], lone = all.filter(l => l.nb === 0).length;
    const r = $('#mread'); r.hidden = false; r.innerHTML = `<h2>이 그림에서 읽히는 것</h2><ul class="list">
<li><span class="nm" style="padding:9px 2px;display:block">법이 다른 법을 부른 ${nf(tot)}번 가운데 <b>${Math.round(self / tot * 100)}%</b>는 같은 분야 안에서 — 그래서 분야마다 덩어리가 집니다.</span></li>
<li><span class="nm" style="padding:9px 2px;display:block">분야 사이 가장 굵은 줄은 <b>${esc(m.groups[prs[0][0]])} ↔ ${esc(m.groups[prs[0][1]])}</b> (${nf(prs[0][2])}번), 다음은 ${esc(m.groups[prs[1][0]])} ↔ ${esc(m.groups[prs[1][1]])}.</span></li>
<li><span class="nm" style="padding:9px 2px;display:block">온 분야에서 가장 많이 불리는 법은 <b>${esc(big.name)}</b> — 다른 법의 조 ${nf(big.ind)}곳이 가리킵니다.</span></li>
<li><span class="nm" style="padding:9px 2px;display:block">어느 법과도 줄이 없는 법은 ${nf(lone)}개 — 바깥에 흩어진 점들입니다.</span></li></ul>`; });
  const q = $('#q'), res = $('#res');
  q.oninput = () => {
    const v = norm(q.value); if (!v) { res.hidden = true; return; }
    const hit = all.filter(l => norm(l.name).includes(v)).sort((a, b) => (norm(a.name).startsWith(v) ? 0 : 1) - (norm(b.name).startsWith(v) ? 0 : 1) || a.name.length - b.name.length);
    res.hidden = false;
    $('ul', res).innerHTML = hit.length ? hit.slice(0, 40).map(l => lawRow(l, l.kind)).join('') + (hit.length > 40 ? `<li><span class="note">외 ${nf(hit.length - 40)}개 — 더 길게 적어 좁혀 주세요</span></li>` : '') : '<li><span class="note">맞는 법이 없습니다</span></li>';
  };
}

// ── 법 하나 풀기 ───────────────────────────────────────────────
function prep(d) {
  const n = d.arts.length, fam = new Set([d.plaw, d.pdec, ...d.kids].filter(x => x != null)), kids = new Set(d.kids);
  const P = { d, n, fam, kids, internal: [], outA: Array.from({ length: n }, () => []), inInt: Array.from({ length: n }, () => []), inExt: Array.from({ length: n }, () => []),
    outLaw: new Map(), inLaw: new Map(), below: new Array(n).fill(0) };
  const add = (m, k, v) => m.set(k, (m.get(k) || 0) + v);
  for (const e of d.out) { P.outA[e[0]].push(e); if (e[1] === -1) { P.internal.push(e); P.inInt[e[2]].push(e[0]); } else add(P.outLaw, e[1], e[3]); }
  for (const e of d.in) { P.inExt[e[2]].push(e); add(P.inLaw, e[0], e[3]); if (kids.has(e[0])) P.below[e[2]] += 1; }
  for (const e of d.lawout) add(P.outLaw, e[1], e[2]);
  for (const e of d.lawin) add(P.inLaw, e[0], e[2]);
  P.indeg = P.inInt.map((a, i) => a.length + P.inExt[i].length);
  if (d.kind === '헌법') P.below = d.arts.map(a => (a[3].match(/법률이 정하는|법률이 정한|법률로 정한다|법률로써|법률에 의하/g) || []).length);
  return P;
}

function lawPage(P) {
  const d = P.d, me = L(d.id); document.title = d.name + ' — 법그물';
  const extOut = d.out.length - P.internal.length;
  const layer = (id, label) => id == null ? '' : `<a href="${href(id)}"><i class="dot ${kc(L(id).kind)}"></i><span class="nm">${esc(L(id).name)}</span><span class="tag">${label}</span></a>`;
  const up = d.plaw != null ? layer(d.plaw, '윗법') + (d.pdec != null ? layer(d.pdec, '시행령') : '') + '<span class="arrow">▼ 받아서 풀어 씀</span>' : (d.kind === '헌법' ? '' : (d.kind === '법률' ? `<a href="${href(IDX.const)}"><i class="dot k1"></i><span class="nm">대한민국헌법</span><span class="tag">꼭대기</span></a><span class="arrow">▼</span>` : ''));
  const down = d.kids.length ? '<span class="arrow">▼ 아래로 맡김</span>' + d.kids.map(k => layer(k, L(k).kind)).join('') : '';
  app.innerHTML = `<h1>${esc(d.name)}</h1>
<div class="chips"><span class="chip"><i class="dot ${kc(d.kind)}"></i>${esc(d.kind || '법령')}</span>${d.min ? `<span class="chip">${esc(d.min)}</span>` : ''}${d.date ? `<span class="chip">시행 ${esc(d.date)}${d.date > IDX.made ? ' · 아직 시행 전 글' : ''}</span>` : ''}</div>
<p class="pad" style="margin:0 0 10px"><a class="btn" href="#/m/${d.id}">전체 지도에서 이 법 보기</a></p>
<div class="stats"><div class="stat"><b>${nf(P.n)}</b><span>조</span></div><div class="stat"><b>${nf(P.internal.length)}</b><span>안에서 잇는 줄</span></div><div class="stat"><b>${nf(extOut)}</b><span>밖으로 나가는 줄</span></div><div class="stat"><b>${nf(d.in.length)}</b><span>밖에서 오는 줄</span></div></div>
${P.n ? '' : '<p class="lead" style="margin-top:14px">본문에 조가 없는 법입니다(폐지되었거나 한 줄짜리).</p>'}
<div id="c-loom"></div>
${up || down ? `<div class="card"><h2>위아래 층</h2><p class="sub">헌법 → 법률 → 시행령 → 시행규칙으로 내려가는 줄기에서 이 법의 자리.</p><div class="layers">${up}<span class="me"><i class="dot ${kc(d.kind)}"></i>${esc(d.name)}</span>${down}</div></div>` : ''}
<div id="c-nb"></div><div id="c-arc"></div><div id="c-grid"></div><div id="c-term"></div><div id="c-list"></div>`;
  loom(P); neighbours(P); arcs(P); grid(P); terms(P); artList(P);
}

// 베틀: 법 한 집안(법률·시행령·시행규칙)을 가로줄로 놓고, 아래 법이 윗법을 받아 쓰는 실을 세로로 건다
async function loom(P) {
  const d = P.d, rk = x => (x.kind === '법률' || x.kind === '헌법') ? 0 : x.kind === '대통령령' ? 1 : 2, RC = ['#8fc1ff', '#ff9a5c', '#4fd6a0'], BG = '#07090d';
  let fam;
  try { const root = d.plaw != null ? await load(d.plaw) : d; if (!root.kids.length) return; fam = [root, ...(await Promise.all(root.kids.slice(0, 6).map(load))).sort((a, b) => rk(a) - rk(b) || b.arts.length - a.arts.length)]; } catch (e) { return; }
  fam = fam.filter(x => x.arts.length > 1).slice(0, 4); if (CUR !== P || fam.length < 2) return;
  const row = new Map(fam.map((x, r) => [x.id, r])), kix = fam.map(x => new Map(x.arts.map((a, i) => [a[0], i]))), T = [], A = fam.map(() => []);
  fam.forEach((S, r) => { for (const e of S.out) { if (e[1] === -1) A[r].push([e[0], e[2]]); else if (row.has(e[1])) { const j = kix[row.get(e[1])].get(e[2]); if (j != null) T.push([r, e[0], row.get(e[1]), j]); } } });
  $('#c-loom').innerHTML = `<div class="card"><h2>베틀 — 이 법 집안이 짜이는 모습</h2><p class="sub">가로줄 = 조를 제1조부터 차례로 놓은 것. 위로 솟은 활 = 같은 법 안에서 조가 조를 부름. 세로 실 = 아래 법이 윗법의 조를 받아 풀어 씀(${nf(T.length)}가닥).</p>
<canvas class="loom" aria-label="법률과 시행령·시행규칙 사이에 걸린 줄"></canvas><div class="pick"></div></div>`;
  const cv = $('#c-loom canvas'), pick = $('#c-loom .pick'), W = cv.clientWidth, pad = 12, top = 78, gy = fam.length > 3 ? 165 : 195, H = top + (fam.length - 1) * gy + 40, dpr = Math.min(devicePixelRatio || 1, 3);
  cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px'; const c = cv.getContext('2d'); c.scale(dpr, dpr);
  const X = (r, i) => pad + i * (W - 2 * pad) / Math.max(1, fam[r].arts.length - 1), Y = r => top + r * gy, col = r => RC[Math.min(rk(fam[r]), 2)];
  const thread = t => { const x1 = X(t[0], t[1]), y1 = Y(t[0]), x2 = X(t[2], t[3]), y2 = Y(t[2]), my = (y1 + y2) / 2; c.moveTo(x1, y1); c.bezierCurveTo(x1, my, x2, my, x2, y2); };
  const arc = (r, a) => { const p = X(r, Math.min(a[0], a[1])), q = X(r, Math.max(a[0], a[1])), rad = (q - p) / 2; c.moveTo(p, Y(r)); c.ellipse(p + rad, Y(r), rad, Math.min(rad, 58), 0, Math.PI, 2 * Math.PI); };
  const stroke = (f, color, w, al) => { c.beginPath(); f(); c.strokeStyle = color; c.lineWidth = w; c.globalAlpha = al; c.stroke(); c.globalAlpha = 1; };
  const chrome = () => fam.forEach((x, r) => { stroke(() => { c.moveTo(pad, Y(r)); c.lineTo(W - pad, Y(r)); }, col(r), 2.5, 1); c.fillStyle = col(r); c.font = `${x.id === d.id ? 800 : 600} 12px system-ui,"Noto Sans KR",sans-serif`; c.fillText(`${x.id === d.id ? '● ' : ''}${cut(x.name, 22)} · ${nf(x.arts.length)}조`, pad, Y(r) + 17); });
  const arcsAll = () => A.forEach((as, r) => { const st = Math.ceil(as.length / 1500); stroke(() => { for (let k = 0; k < as.length; k += st) arc(r, as[k]); }, col(r), .5, .42); });
  T.sort((a, b) => X(a[0], a[1]) - X(b[0], b[1])); const st = Math.ceil(T.length / 6000), al = T.length > 1500 ? .22 : .34; let base = null, sel = null;
  const hint = () => { pick.innerHTML = '<span class="nm muted">그림을 좌우로 문지르면 조 하나에 걸린 실만 켜집니다.</span>'; };
  const snap = () => { base = document.createElement('canvas'); base.width = cv.width; base.height = cv.height; base.getContext('2d').drawImage(cv, 0, 0); };
  const full = () => { c.fillStyle = BG; c.fillRect(0, 0, W, H); arcsAll(); for (let r = 0; r < fam.length; r++) stroke(() => { for (let k = 0; k < T.length; k += st) if (T[k][0] === r) thread(T[k]); }, col(r), .6, al); chrome(); snap(); };
  const choose = (r, i) => {
    sel = [r, i]; c.drawImage(base, 0, 0, W, H); c.fillStyle = 'rgba(7,9,13,.72)'; c.fillRect(0, 0, W, H); chrome();
    const up = T.filter(t => t[0] === r && t[1] === i), dn = T.filter(t => t[2] === r && t[3] === i), ar = A[r].filter(a => a[0] === i || a[1] === i);
    stroke(() => ar.forEach(a => arc(r, a)), '#f0efec', 1, .8);
    for (const t of [...up, ...dn]) stroke(() => thread(t), col(t[0]), 1.3, .95);
    const dot = (rr, ii, rad, f) => { c.beginPath(); c.arc(X(rr, ii), Y(rr), rad, 0, 7); c.fillStyle = f; c.fill(); };
    up.forEach(t => dot(t[2], t[3], 2.5, col(t[2]))); dn.forEach(t => dot(t[0], t[1], 2.5, col(t[0]))); dot(r, i, 5.5, '#f0efec');
    const a = fam[r].arts[i]; pick.innerHTML = `<i class="dot" style="background:${col(r)}"></i><span class="nm"><b>${esc(cut(fam[r].name, 14))} ${fmt(a[0])}</b> ${esc(a[1])}<br><span class="num" style="white-space:normal">${up.length ? `윗법의 조 ${nf(up.length)}곳을 받아 씀 · ` : ''}${dn.length ? `아래 법의 조 ${nf(dn.length)}곳이 받아 감 · ` : ''}같은 법 안 ${nf(ar.length)}줄</span></span><a class="btn" href="${href(fam[r].id, a[0])}">읽기</a><button class="btn" id="lm-all">전체</button>`;
  };
  const deg = fam.map(x => new Uint16Array(x.arts.length)); T.forEach(t => { deg[t[0]][t[1]]++; deg[t[2]][t[3]]++; });
  const at = ev => { if (!base) return; const b = cv.getBoundingClientRect(), x = ev.clientX - b.left, y = ev.clientY - b.top; let r = 0; for (let k = 1; k < fam.length; k++) if (Math.abs(y + 20 - Y(k)) < Math.abs(y + 20 - Y(r))) r = k;
    const n = fam[r].arts.length; let i = Math.max(0, Math.min(n - 1, Math.round((x - pad) / (W - 2 * pad) * (n - 1)))), best = i; const reach = Math.max(1, Math.round(n / (W - 2 * pad) * 5));
    for (let k = Math.max(0, i - reach); k <= Math.min(n - 1, i + reach); k++) if (deg[r][k] > deg[r][best]) best = k;
    if (!sel || sel[0] !== r || sel[1] !== best) choose(r, best); };
  cv.onpointerdown = ev => { at(ev); cv.onpointermove = at; }; cv.onpointerup = cv.onpointercancel = cv.onpointerleave = () => { cv.onpointermove = null; };
  pick.onclick = ev => { if (ev.target.closest('#lm-all')) { sel = null; c.drawImage(base, 0, 0, W, H); hint(); } };
  hint();
  if (matchMedia('(prefers-reduced-motion:reduce)').matches || !T.length) return full();
  // 실이 왼쪽부터 걸리며 짜임
  c.fillStyle = BG; c.fillRect(0, 0, W, H); arcsAll(); chrome(); let k0 = 0; const t0 = performance.now(), dur = 1800;
  const step = now => { if (CUR !== P || !cv.isConnected) return; const u = Math.min(1, (now - t0) / dur), k1 = Math.round(T.length * (1 - Math.pow(1 - u, 2)));
    for (let k = k0 - k0 % st; k < k1; k += st) if (k >= k0) stroke(() => thread(T[k]), col(T[k][0]), .6, al); k0 = k1;
    if (u < 1) requestAnimationFrame(step); else full(); };
  requestAnimationFrame(step);
}

// 둘레 그물: 이 법을 부르는 법(왼쪽) · 이 법이 부르는 법(오른쪽)
function neighbours(P) {
  const top = m => [...m].filter(([id]) => !P.fam.has(id) && id !== P.d.id).sort((a, b) => b[1] - a[1]);
  const ins = top(P.inLaw), outs = top(P.outLaw); if (!ins.length && !outs.length) return;
  const A = ins.slice(0, 8), B = outs.slice(0, 8), rows = Math.max(A.length, B.length), rh = 30, H = rows * rh + 34, W = 360, cy = 26 + rows * rh / 2;
  const mx = Math.max(...A.map(x => x[1]), ...B.map(x => x[1]), 1), wd = c => (1 + 7 * Math.sqrt(c / mx)).toFixed(1);
  let s = `<text x="118" y="12" text-anchor="end" font-size="11" font-weight="700">이 법을 부르는 법</text>${outs.length ? '<text x="242" y="12" font-size="11" font-weight="700">이 법이 부르는 법</text>' : ''}`;
  const side = (arr, left) => arr.forEach(([id, c], i) => {
    const l = L(id), y = 26 + (i + .5) * rh + (rows - arr.length) * rh / 2, x = left ? 124 : 236;
    s += `<g data-id="${id}" data-c="${c}" data-left="${left ? 1 : 0}" style="cursor:pointer"><path d="M${x},${y} C${left ? 152 : 208},${y} ${left ? 152 : 208},${cy} 180,${cy}" fill="none" stroke="var(--${kc(l.kind)})" stroke-width="${wd(c)}" stroke-linecap="round" opacity=".5"/>
<circle cx="${x}" cy="${y}" r="4.5" fill="var(--${kc(l.kind)})" stroke="var(--surf)" stroke-width="2"/><text x="${left ? 116 : 244}" y="${y + 4}" text-anchor="${left ? 'end' : 'start'}" font-size="11.5" style="fill:var(--ink)">${esc(cut(l.name, 10))}</text><rect x="${left ? 0 : 236}" y="${y - rh / 2}" width="124" height="${rh}" fill="transparent"/></g>`;
  });
  side(A, true); side(B, false);
  s += `<circle cx="180" cy="${cy}" r="10" fill="var(--${kc(P.d.kind)})" stroke="var(--surf)" stroke-width="2"/>`;
  $('#c-nb').innerHTML = `<div class="card"><h2>둘레 그물</h2><p class="sub">다른 법과 주고받는 줄. 굵을수록 많이 부름. 이름을 누르면 아래에 온 이름이 나옵니다.</p>
<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="이 법과 이어진 법들">${s}</svg><div class="pick"><span class="nm muted">법 이름을 눌러 보세요</span></div>
<div class="legend"><span><i class="k1"></i>법률</span><span><i class="k2"></i>대통령령</span><span><i class="k3"></i>부령·규칙</span></div>
<p class="note">부르는 법 ${nf(ins.length)}개 · 불리는 법 ${nf(outs.length)}개 가운데 많은 차례로 8개씩. 딸린 시행령·시행규칙은 '위아래 층'에 따로 둠. <button class="btn" id="nb-all">모두 보기</button></p></div>`;
  const pick = $('#c-nb .pick');
  $('#c-nb svg').onclick = ev => { const g = ev.target.closest('g[data-id]'); if (!g) return; const l = L(+g.dataset.id);
    pick.innerHTML = `<i class="dot ${kc(l.kind)}"></i><span class="nm">${esc(l.name)}<br><span class="num">${g.dataset.left === '1' ? '이 법을' : '이 법이'} ${nf(+g.dataset.c)}번 부름</span></span><a class="btn" href="${href(l.id)}">열기</a>`; };
  $('#nb-all').onclick = () => openSheet(`<h2>${esc(P.d.name)}와 이어진 법</h2><h3>이 법을 부르는 법 ${nf(ins.length)}</h3><ul class="list">${ins.slice(0, 150).map(([id, c]) => lawRow(L(id), nf(c) + '번')).join('')}</ul><h3>이 법이 부르는 법 ${nf(outs.length)}</h3><ul class="list">${outs.slice(0, 150).map(([id, c]) => lawRow(L(id), nf(c) + '번')).join('')}</ul>`);
}

// 활 그림: 같은 법 안에서 조가 조를 가리킴
function arcs(P) {
  const E = P.internal, n = P.n; if (!E.length || n < 3) return;
  const W = 360, x0 = 10, x1 = 350, X = i => x0 + i * (x1 - x0) / (n - 1), span = Math.max(...E.map(e => Math.abs(e[0] - e[2]))) * (x1 - x0) / (n - 1) / 2;
  const base = Math.min(170, Math.max(40, span)) + 8, H = base + 20, ry = r => Math.min(r, 170);
  const arc = (a, b) => { const p = X(Math.min(a, b)), q = X(Math.max(a, b)), r = (q - p) / 2; return `M${p.toFixed(1)},${base} A${r.toFixed(1)},${ry(r).toFixed(1)} 0 0 1 ${q.toFixed(1)},${base}`; };
  const stride = Math.ceil(E.length / 3500), ind = P.inInt.map(a => a.length);
  let bg = ''; for (let i = 0; i < E.length; i += stride) bg += arc(E[i][0], E[i][2]);
  let dots = ''; for (let i = 0; i < n; i++) if (ind[i] || n <= 400) dots += `<circle cx="${X(i).toFixed(1)}" cy="${base}" r="${(1 + Math.sqrt(ind[i]) * .8).toFixed(1)}" fill="var(--ink2)"/>`;
  $('#c-arc').innerHTML = `<div class="card"><h2>안쪽 그물</h2><p class="sub">조를 차례대로 늘어놓고, "제○조에 따라"처럼 한 조가 다른 조를 가리키면 활로 이음. 그림을 좌우로 문지르면 조를 고릅니다.</p>
<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="조문 사이 가리킴"><path d="${bg}" fill="none" stroke="var(--arc)" stroke-width=".6" opacity=".3"/><line x1="${x0}" x2="${x1}" y1="${base}" y2="${base}" stroke="var(--axis)"/>${dots}<g id="sel"></g>
<text x="${x0}" y="${H - 2}" font-size="10">${fmt(P.d.arts[0][0])}</text><text x="${x1}" y="${H - 2}" font-size="10" text-anchor="end">${fmt(P.d.arts[n - 1][0])}</text></svg>
<div class="pick"></div><div class="legend"><span><i class="k1"></i>고른 조가 가리킴</span><span><i class="k2"></i>고른 조를 가리킴</span></div>
${stride > 1 ? `<p class="note">줄이 ${nf(E.length)}개라 바탕에는 ${stride}개에 하나만 그림. 고른 조의 줄은 모두 그림.</p>` : ''}</div>`;
  const svg = $('#c-arc svg'), sel = $('#sel', svg), pick = $('#c-arc .pick');
  const choose = i => {
    const outs = P.outA[i].filter(e => e[1] === -1).map(e => e[2]), ins = P.inInt[i];
    sel.innerHTML = `<path d="${ins.map(s => arc(s, i)).join('')}" fill="none" stroke="var(--k2)" stroke-width="1.3" opacity=".85"/><path d="${outs.map(t => arc(i, t)).join('')}" fill="none" stroke="var(--k1)" stroke-width="1.3" opacity=".9"/><circle cx="${X(i).toFixed(1)}" cy="${base}" r="5" fill="var(--ink)" stroke="var(--surf)" stroke-width="2"/>`;
    const a = P.d.arts[i]; pick.innerHTML = `<span class="nm"><b>${fmt(a[0])}</b> ${esc(a[1])}<br><span class="num">가리킴 ${outs.length} · 가리켜짐 ${ins.length}</span></span><a class="btn" href="${href(P.d.id, a[0])}">읽기</a>`;
  };
  const at = ev => { const r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * W; choose(Math.max(0, Math.min(n - 1, Math.round((x - x0) / (x1 - x0) * (n - 1))))); };
  svg.onpointerdown = ev => { at(ev); svg.onpointermove = at; }; svg.onpointerup = svg.onpointercancel = svg.onpointerleave = () => { svg.onpointermove = null; };
  choose(ind.indexOf(Math.max(...ind)));
}

// 맡김 격자: 조 하나 = 네모 하나
function grid(P) {
  const d = P.d, isC = d.kind === '헌법', tot = P.below.reduce((a, b) => a + b, 0); if (!tot) return;
  const groups = []; d.arts.forEach((a, i) => { const c = a[2] >= 0 ? d.chaps[a[2]].split(' › ')[0] : ''; if (!groups.length || groups[groups.length - 1].c !== c) groups.push({ c, a: [] }); groups[groups.length - 1].a.push(i); });
  const cell = i => `<button data-k="${esc(d.arts[i][0])}" title="${fmt(d.arts[i][0])} ${P.below[i]}곳" style="background:var(--s${Math.min(P.below[i], 3)})"></button>`;
  $('#c-grid').innerHTML = `<div class="card"><h2>${isC ? '법률에 맡기는 곳' : '아래 법이 받아 가는 곳'}</h2><p class="sub">네모 하나 = 조 하나. ${isC ? `짙을수록 "법률로 정한다"며 법률에 넘기는 곳이 많음. 모두 ${nf(tot)}곳.` : `짙을수록 시행령·시행규칙의 조가 이 조를 받아 풀어 쓴 곳이 많음. 모두 ${nf(tot)}줄.`} 네모를 누르면 그 조를 읽습니다.</p>
<style>.g{display:flex;flex-wrap:wrap;gap:2px;margin:3px 0 10px}.g button{width:17px;height:17px;border:0;border-radius:3px;padding:0;cursor:pointer}.gl{font-size:12px;font-weight:600;color:var(--ink2)}</style>
${groups.map(g => `${g.c ? `<div class="gl">${esc(g.c)} <span class="num">${g.a.filter(i => P.below[i]).length}/${g.a.length}</span></div>` : ''}<div class="g">${g.a.map(cell).join('')}</div>`).join('')}
<div class="legend"><span><i style="background:var(--s0)"></i>없음</span><span><i style="background:var(--s1)"></i>1</span><span><i style="background:var(--s2)"></i>2</span><span><i style="background:var(--s3)"></i>3 이상</span></div>
${isC ? '<p class="note">헌법 글에는 받는 법의 이름이 없어, 어느 법률이 받았는지는 아직 잇지 못했습니다(헌법 조 번호를 적어 부르는 법만 조마다 표시).</p>' : ''}</div>`;
  $('#c-grid').onclick = ev => { const b = ev.target.closest('button[data-k]'); if (b) location.hash = href(d.id, b.dataset.k); };
}

// 정의 낱말 띠
function terms(P) {
  const d = P.d; if (!d.terms.length || P.n < 2) return;
  const T = d.terms.map(([t, u]) => ({ t, own: u[d.id] || [], kid: Object.entries(u).filter(([f]) => +f !== d.id) })).map(o => ({ ...o, tot: o.own.length + o.kid.reduce((s, [, v]) => s + v.length, 0) })).sort((a, b) => b.tot - a.tot);
  const draw = lim => {
    const R = T.slice(0, lim), rh = 26, W = 360, x0 = 122, x1 = 318, H = R.length * rh + 18, st = (x1 - x0) / Math.max(1, P.n - 1);
    let s = ''; R.forEach((o, i) => { const y = 13 + i * rh;
      s += `<g data-i="${i}" style="cursor:pointer"><rect x="0" y="${y - rh / 2}" width="${W}" height="${rh}" fill="transparent"/><text x="${x0 - 8}" y="${y + 4}" text-anchor="end" font-size="11.5" font-weight="700" style="fill:var(--ink)">${esc(cut(o.t, 10))}</text><line x1="${x0}" x2="${x1}" y1="${y}" y2="${y}" stroke="var(--grid)"/><path d="${o.own.map(a => `M${(x0 + a * st).toFixed(1)},${y - 7}v14`).join('')}" stroke="var(--k1)" stroke-width="1.3" opacity=".8"/><text x="${W - 2}" y="${y + 4}" text-anchor="end" font-size="11">${o.tot}</text></g>`; });
    s += `<text x="${x0}" y="${H - 2}" font-size="10">${fmt(d.arts[0][0])}</text><text x="${x1}" y="${H - 2}" font-size="10" text-anchor="end">${fmt(d.arts[P.n - 1][0])}</text><text x="${W - 2}" y="${H - 2}" font-size="10" text-anchor="end">조 수</text>`;
    $('#c-term').innerHTML = `<div class="card"><h2>정의 낱말이 퍼지는 그물</h2><p class="sub">이 법이 뜻을 정한 낱말 ${nf(T.length)}개. 세로 금 하나 = 그 낱말을 쓰는 조. 낱말을 누르면 쓰는 조가 나옵니다.</p><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="정의 낱말이 쓰이는 조">${s}</svg>
<p class="note">오른쪽 숫자는 딸린 시행령·시행규칙까지 합친 조 수. ${T.length > lim ? `<button class="btn" id="t-more">낱말 ${nf(T.length)}개 모두</button>` : ''}</p></div>`;
    $('#c-term svg').onclick = ev => { const g = ev.target.closest('g[data-i]'); if (!g) return; const o = R[+g.dataset.i];
      openSheet(`<h2>"${esc(o.t)}"</h2><p class="muted">${esc(d.name)}이 뜻을 정한 낱말 · 쓰는 조 ${o.tot}개</p><h3>이 법 ${o.own.length}</h3><ul class="list">${o.own.map(a => artRow(d.id, d.arts[a][0], d.arts[a][1])).join('')}</ul>${o.kid.map(([f, v]) => `<h3>${esc(L(+f).name)} ${v.length}</h3><p class="note">조 ${v.length}개에서 씀. <a class="btn" href="${href(+f)}">이 법 열기</a></p>`).join('')}`); };
    const m = $('#t-more'); if (m) m.onclick = () => draw(T.length);
  };
  draw(10);
}
const artRow = (id, key, title, extra = '') => `<li><a href="${href(id, key)}"><span class="nm"><b>${fmt(key)}</b> ${esc(title || '')}</span>${extra}</a></li>`;

// 조 목록
function artList(P) {
  const d = P.d; if (!P.n) return;
  const groups = []; d.arts.forEach((a, i) => { const c = a[2] >= 0 ? d.chaps[a[2]].split(' › ')[0] : ''; if (!groups.length || groups[groups.length - 1].c !== c) groups.push({ c, a: [] }); groups[groups.length - 1].a.push(i); });
  const rows = g => g.a.map(i => artRow(d.id, d.arts[i][0], d.arts[i][1], `<span class="num">${P.outA[i].length ? '→' + P.outA[i].length : ''} ${P.indeg[i] ? '←' + P.indeg[i] : ''}</span>`)).join('');
  $('#c-list').innerHTML = `<div class="card"><h2>조 목록</h2><p class="sub">→ 이 조가 가리키는 줄 · ← 이 조를 가리키는 줄</p>${groups.length > 1 ? groups.map((g, gi) => `<details data-g="${gi}"><summary><span>${esc(g.c || '앞머리')}</span><span class="num">${g.a.length}조</span></summary><ul class="list"></ul></details>`).join('') : `<ul class="list">${rows(groups[0])}</ul>`}</div>`;
  $('#c-list').querySelectorAll('details').forEach(el => el.ontoggle = () => { const ul = $('ul', el); if (el.open && !ul.children.length) ul.innerHTML = rows(groups[+el.dataset.g]); });
}

// ── 조 하나 읽기(아래에서 올라오는 판) ───────────────────────────
function artSheet(P, key) {
  const d = P.d, i = d.arts.findIndex(a => a[0] === key); if (i < 0) return openSheet(`<h2>${fmt(key)}</h2><p class="muted">이 법에 그런 조가 없습니다.</p>`);
  const a = d.arts[i], text = a[3].replace(/\*\*/g, '').replace(/\\([.\-()])/g, '$1').replace(/^ {2,}/gm, m => ' '.repeat(Math.min(m.length, 6)));
  const outI = P.outA[i].filter(e => e[1] === -1), outE = P.outA[i].filter(e => e[1] !== -1), inI = P.inInt[i], inE = P.inExt[i];
  const named = d.lawout.filter(e => e[0] === i);
  const ext = (id, k, tag) => `<li><a href="${href(id, k)}"><i class="dot ${kc(L(id).kind)}"></i><span class="nm">${esc(L(id).name)} <b>${fmt(k)}</b></span>${tag ? `<span class="tag">${tag}</span>` : ''}</a></li>`;
  const cap = (arr, f, n = 80) => arr.slice(0, n).map(f).join('') + (arr.length > n ? `<li><span class="note">외 ${nf(arr.length - n)}개</span></li>` : '');
  inE.sort((x, y) => (P.kids.has(y[0]) - P.kids.has(x[0])) || x[0] - y[0]);
  openSheet(`<h2>${fmt(a[0])} ${esc(a[1])}</h2><p class="muted" style="margin:2px 0 0;font-size:13px">${esc(d.name)}${a[2] >= 0 ? ' · ' + esc(d.chaps[a[2]]) : ''}</p>
<div class="arttext">${esc(text) || '<span class="muted">(본문 없음)</span>'}</div>
<h3>이 조가 가리키는 조 ${outI.length + outE.length}</h3><ul class="list">${cap(outI, e => artRow(d.id, d.arts[e[2]][0], d.arts[e[2]][1]))}${cap(outE, e => ext(e[1], e[2], P.fam.has(e[1]) ? '윗법' : ''))}</ul>
${named.length ? `<h3>이름만 부른 법 ${named.length}</h3><ul class="list">${cap(named, e => lawRow(L(e[1]), ''))}</ul>` : ''}
<h3>이 조를 가리키는 조 ${inI.length + inE.length}</h3><ul class="list">${cap(inI, s => artRow(d.id, d.arts[s][0], d.arts[s][1]))}${cap(inE, e => ext(e[0], e[1], P.kids.has(e[0]) ? '아래 법' : ''))}</ul>
${!(outI.length + outE.length + inI.length + inE.length + named.length) ? '<p class="note">이 조는 번호로 가리키거나 가리켜지는 줄이 없습니다.</p>' : ''}`);
}
function openSheet(html) { sheetIn.innerHTML = html; sheet.hidden = false; $('.sheet-body').scrollTop = 0; document.body.style.overflow = 'hidden'; }
function closeSheet() { sheet.hidden = true; document.body.style.overflow = ''; if (CUR && location.hash.split('/').length > 3) history.replaceState(null, '', href(CUR.d.id)); }
$('.close').onclick = closeSheet; $('.sheet-bg').onclick = closeSheet;
addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });

// ── 길 찾기 ────────────────────────────────────────────────────
async function route() {
  const m = /^#\/l\/(\d+)(?:\/(.+))?$/.exec(location.hash);
  sheet.hidden = true; document.body.style.overflow = '';
  const f = /^#\/m\/(\d+)$/.exec(location.hash);
  if (!m || !IDX.laws[+m[1]]) { home(f ? +f[1] : null); scrollTo(0, 0); return; }
  LawMap.stop();
  const id = +m[1];
  try {
    if (!CUR || CUR.d.id !== id) { app.innerHTML = '<p class="muted pad" style="margin-top:20px">불러오는 중…</p>'; CUR = prep(await load(id)); lawPage(CUR); scrollTo(0, 0); }
    if (m[2]) artSheet(CUR, decodeURIComponent(m[2]));
  } catch (e) { CUR = null; app.innerHTML = `<p class="pad" style="margin-top:20px">이 법을 불러오지 못했습니다(${esc(e.message)}). <a href="#/">처음으로</a></p>`; }
}
addEventListener('hashchange', route);
fetch('data/index.json').then(r => r.json()).then(d => { IDX = d; route(); }).catch(e => { app.innerHTML = `<p class="pad">자료를 불러오지 못했습니다(${esc(e.message)}).</p>`; });
