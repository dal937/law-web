'use strict';
// 전체 지도: 법령 하나 = 점 하나, 서로 부르는 법끼리 줄. 자리는 pipeline/layout.mjs가 미리 셈함.
const LawMap = (() => {
  const COL = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#3fae3f', '#9085e9', '#e66767'];
  const KCOL = ['#8fc1ff', '#ff9a5c', '#4fd6a0'];      // 법 종류 색(베틀과 같음): 헌법·법률 · 대통령령 · 그 밖 규칙
  const BG = '#07090d';
  let M = null, raf = 0, alive = false;
  const data = () => M || (M = fetch('data/map.json').then(r => r.json()));

  async function mount(box, IDX, onPick, focusId, onEnter = () => {}) {
    stop(); alive = true;
    const m = await data(); if (!alive) return;
    const N = m.x.length, E = m.e, ne = E.length / 3, deg = IDX.laws.map(l => l[4] + l[5]);
    const cv = box.querySelector('canvas'), ctx = cv.getContext('2d'), base = document.createElement('canvas'), bx = base.getContext('2d');
    const dpr = Math.min(2, devicePixelRatio || 1); let W = 0, H = 0;
    const V = { s: 1, x: 0, y: 0 }, B = { s: 1, x: 0, y: 0 };       // V = 지금 보는 자리, B = 바탕 그림을 그린 자리
    let sel = -1, adj = null, adjW = null, selTop = [], timer = 0, byKind = false;
    const KI = IDX.laws.map(l => (l[1] === '헌법' || l[1] === '법률') ? 0 : l[1] === '대통령령' ? 1 : 2), cg = i => byKind ? KI[i] : m.g[i], pal = () => byKind ? KCOL : COL;
    const order = [...Array(N).keys()].sort((a, b) => IDX.laws[b][4] - IDX.laws[a][4]);
    const sx = i => m.x[i] * V.s + V.x, sy = i => m.y[i] * V.s + V.y;
    const zoom0 = () => V.s / fit;
    const rad = i => (0.55 + Math.sqrt(IDX.laws[i][4]) * 0.085) * Math.max(1, Math.pow(V.s / fit, .38)) * dpr;
    let fit = 1;
    function size() {
      const r = cv.getBoundingClientRect(); W = Math.round(r.width * dpr); H = Math.round(r.height * dpr);
      cv.width = base.width = W; cv.height = base.height = H; fit = Math.min(W / 10400, H / 12200);
      if (V.s === 1 && V.x === 0) { V.s = fit; V.x = W / 2; V.y = H / 2; }
    }
    function drawBase() {
      Object.assign(B, V); box.querySelector('.ttl').style.opacity = zoom0() > 1.6 ? 0 : 1; bx.globalCompositeOperation = 'source-over'; bx.fillStyle = BG; bx.fillRect(0, 0, W, H);
      bx.lineWidth = Math.max(.5, .4 * dpr); const far = zoom0() < 1.8;
      const zoom = zoom0(), lim = Math.min(ne, Math.round(30000 * Math.max(1, zoom)));       // 멀리서는 굵은 줄만
      const PAL = pal(), ng = PAL.length;
      for (let g = ng - 1; g >= 0; g--) {
        bx.beginPath(); bx.strokeStyle = PAL[g]; bx.globalAlpha = (far ? .11 : .2) * (byKind ? .6 : 1);
        for (let k = 0; k < lim; k++) { const a = E[k * 3], b = E[k * 3 + 1]; if (cg(a) !== g) continue;
          const x1 = sx(a), y1 = sy(a), x2 = sx(b), y2 = sy(b), in1 = x1 > 0 && x1 < W && y1 > 0 && y1 < H, in2 = x2 > 0 && x2 < W && y2 > 0 && y2 < H;
          if (!in1 && !in2) continue; if (!far && !(in1 && in2) && k > 6000) continue;      // 가까이서는 화면을 그냥 지나가는 가는 줄은 뺌
          bx.moveTo(x1, y1); bx.lineTo(x2, y2); }
        bx.stroke();
      }
      for (let g = ng - 1; g >= 0; g--) {                   // 점 + 큰 법의 빛무리
        bx.fillStyle = PAL[g];
        bx.globalAlpha = .12; bx.beginPath();
        for (let i = 0; i < N; i++) if (cg(i) === g && IDX.laws[i][4] > 150) { const x = sx(i), y = sy(i); bx.moveTo(x, y); bx.arc(x, y, rad(i) * 3.2, 0, 6.3); }
        bx.fill(); bx.globalAlpha = .95; bx.beginPath();
        for (let i = 0; i < N; i++) if (cg(i) === g) { const x = sx(i), y = sy(i); if (x < -9 || y < -9 || x > W + 9 || y > H + 9) continue; bx.moveTo(x, y); bx.arc(x, y, rad(i), 0, 6.3); }
        bx.fill();
      }
      bx.globalCompositeOperation = 'source-over'; bx.globalAlpha = 1; bx.font = `${11.5 * dpr}px system-ui,"Noto Sans KR","WenQuanYi Zen Hei",sans-serif`; bx.textAlign = 'center';
      if (far) {                                              // 멀리서는 분야 이름표만
        for (let g = 0; g < 8; g++) { const an = g / 8 * 2 * Math.PI - Math.PI / 2, x = Math.cos(an) * 3900 * V.s + V.x, y = Math.sin(an) * 5000 * V.s + V.y; bx.font = `700 ${13 * dpr}px system-ui,"Noto Sans KR","WenQuanYi Zen Hei",sans-serif`;
          bx.strokeStyle = BG; bx.lineWidth = 4 * dpr; bx.strokeText(m.groups[g], x, y); bx.fillStyle = '#ffffff'; bx.fillText(m.groups[g], x, y);
          bx.font = `${11 * dpr}px system-ui,"Noto Sans KR","WenQuanYi Zen Hei",sans-serif`; const t = `법령 ${m.cen[g][2].toLocaleString('ko-KR')}개`; bx.strokeText(t, x, y + 15 * dpr); bx.fillStyle = '#c3c2b7'; bx.fillText(t, x, y + 15 * dpr); }
        const cx = sx(IDX.const), cy = sy(IDX.const); bx.font = `700 ${12.5 * dpr}px system-ui,"Noto Sans KR","WenQuanYi Zen Hei",sans-serif`; bx.fillStyle = '#ffffff'; bx.beginPath(); bx.arc(cx, cy, 5 * dpr, 0, 6.3); bx.fill();
        bx.strokeStyle = BG; bx.lineWidth = 4 * dpr; bx.strokeText('헌법', cx, cy - 9 * dpr); bx.fillText('헌법', cx, cy - 9 * dpr); return; }
      const boxes = [], want = Math.round(Math.min(26, 10 + 7 * Math.log2(Math.max(1, zoom)))); let put = 0;      // 이름: 많이 이어진 법부터, 겹치면 건너뜀
      for (const i of order) { if (put >= want) break; const x = sx(i), y = sy(i); if (x < 30 || y < 16 || x > W - 30 || y > H - 8) continue;
        const t = IDX.laws[i][0].length > 13 ? IDX.laws[i][0].slice(0, 12) + '…' : IDX.laws[i][0], w = bx.measureText(t).width / 2 + 4, yy = y - rad(i) - 5 * dpr;
        if (boxes.some(b => Math.abs(b[0] - x) < b[2] + w && Math.abs(b[1] - yy) < 15 * dpr)) continue;
        boxes.push([x, yy, w]); bx.strokeStyle = BG; bx.lineWidth = 3 * dpr; bx.strokeText(t, x, yy); bx.fillStyle = '#f0efec'; bx.fillText(t, x, yy); put++; }
    }
    // 흐르는 신호: 굵은 줄 위를 작은 빛이 지나감
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches, P = [];
    const spawn = () => { const k = Math.floor(Math.pow(Math.random(), 2.2) * Math.min(ne, 14000)); return { a: E[k * 3], b: E[k * 3 + 1], t: 0, v: .006 + Math.random() * .012 }; };
    if (!still) for (let i = 0; i < 220; i++) { const p = spawn(); p.t = Math.random(); P.push(p); }
    function frame() {
      if (!alive) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
      const k = V.s / B.s; ctx.drawImage(base, V.x - B.x * k, V.y - B.y * k, W * k, H * k);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < P.length; i++) { const p = P[i]; p.t += p.v; if (p.t >= 1) { P[i] = spawn(); continue; }
        const x = sx(p.a) + (sx(p.b) - sx(p.a)) * p.t, y = sy(p.a) + (sy(p.b) - sy(p.a)) * p.t; if (x < 0 || y < 0 || x > W || y > H) continue;
        ctx.globalAlpha = Math.sin(p.t * Math.PI) * .9; ctx.fillStyle = pal()[cg(p.a)]; ctx.beginPath(); ctx.arc(x, y, 1.5 * dpr, 0, 6.3); ctx.fill(); }
      if (sel >= 0) {                                         // 고른 법과 그 줄: 바탕을 어둡게 하고, 많이 주고받는 법은 이름을 띄움
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = .58; ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
        const many = adj[sel].length > 150; ctx.globalAlpha = many ? .1 : .4; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = .7 * dpr; ctx.beginPath();
        for (const j of adj[sel]) { ctx.moveTo(sx(sel), sy(sel)); ctx.lineTo(sx(j), sy(j)); } ctx.stroke();
        ctx.globalAlpha = many ? .45 : .9; ctx.beginPath(); for (const j of adj[sel]) { ctx.fillStyle = '#ffffff'; ctx.moveTo(sx(j), sy(j)); ctx.arc(sx(j), sy(j), 1.6 * dpr, 0, 6.3); } ctx.fill();
        ctx.globalAlpha = 1; ctx.font = `600 ${11.5 * dpr}px system-ui,"Noto Sans KR","WenQuanYi Zen Hei",sans-serif`; ctx.textAlign = 'center'; const boxes = [];
        const name = (i, bold) => { const x = sx(i), y = sy(i); if (x < 20 || y < 14 || x > W - 20 || y > H - 6) return; const n = IDX.laws[i][0], t = n.length > 13 ? n.slice(0, 12) + '…' : n, w = ctx.measureText(t).width / 2 + 4, yy = y - rad(i) - 7 * dpr;
          if (boxes.some(b => Math.abs(b[0] - x) < b[2] + w && Math.abs(b[1] - yy) < 14 * dpr)) return; boxes.push([x, yy, w]); ctx.strokeStyle = BG; ctx.lineWidth = 3.5 * dpr; ctx.strokeText(t, x, yy); ctx.fillStyle = bold ? '#ffffff' : pal()[cg(i)]; ctx.fillText(t, x, yy); };
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * dpr; ctx.beginPath(); ctx.arc(sx(sel), sy(sel), rad(sel) + 4 * dpr, 0, 6.3); ctx.stroke(); name(sel, true);
        for (const [j] of selTop) { ctx.strokeStyle = pal()[cg(j)]; ctx.lineWidth = 1.8 * dpr; ctx.globalAlpha = .95; ctx.beginPath(); ctx.moveTo(sx(sel), sy(sel)); ctx.lineTo(sx(j), sy(j)); ctx.stroke(); ctx.fillStyle = pal()[cg(j)]; ctx.beginPath(); ctx.arc(sx(j), sy(j), 3.2 * dpr, 0, 6.3); ctx.fill(); }
        for (const [j] of selTop) name(j, false);
      }
      raf = (still && sel < 0 && !moving) ? 0 : requestAnimationFrame(frame);
    }
    let moving = false;
    const kick = () => { if (!raf && alive) raf = requestAnimationFrame(frame); };
    const settle = () => { clearTimeout(timer); timer = setTimeout(() => { moving = false; drawBase(); kick(); }, 140); };
    let lastTop = []; const emit = () => onPick(sel, sel >= 0 ? adj[sel].length : 0, sel >= 0 ? m.groups[m.g[sel]] : '', sel >= 0 ? m.g[sel] : 0, lastTop, m.g);
    function pick(i) {
      if (!adj) { adj = Array.from({ length: N }, () => []); adjW = Array.from({ length: N }, () => []); for (let k = 0; k < ne; k++) { const a = E[k * 3], b = E[k * 3 + 1], w = E[k * 3 + 2]; adj[a].push(b); adjW[a].push(w); adj[b].push(a); adjW[b].push(w); } }
      const L = IDX.laws, kin = j => L[i][6] === j || L[j][6] === i || (L[i][6] >= 0 && L[i][6] === L[j][6]);       // 딸린 시행령·시행규칙은 뺌(줄은 굵은 차례로 들어 있음)
      const top = i >= 0 ? adj[i].map((j, k) => [j, adjW[i][k]]).filter(x => !kin(x[0])) : [];
      sel = i; selTop = top.slice(0, 6); lastTop = top; if (i >= 0) frameSel(); emit(); kick();
    }
    // 고른 법과 많이 주고받는 법 여섯이 한 화면에 들게 자리를 옮김
    function frameSel() { const ids = [sel, ...selTop.map(x => x[0])], xs = ids.map(i => m.x[i]), ys = ids.map(i => m.y[i]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      V.s = Math.max(fit * 1.9, Math.min(fit * 9, W * .7 / Math.max(1, x1 - x0), H * .7 / Math.max(1, y1 - y0))); V.x = W / 2 - (x0 + x1) / 2 * V.s; V.y = H / 2 - (y0 + y1) / 2 * V.s; moving = true; settle(); }
    box.focus = i => { pick(i); }; box.col = i => pal()[cg(i)];
    function zoomAt(px, py, f) { const s = Math.max(fit * .7, Math.min(fit * 60, V.s * f)); f = s / V.s; V.x = px - (px - V.x) * f; V.y = py - (py - V.y) * f; V.s = s; moving = true; kick(); settle(); }
    // 손가락: 하나로 끌기, 둘로 벌려 키우기, 톡 눌러 고르기
    const pts = new Map(); let moved = 0, pd = 0;
    const pos = ev => { const r = cv.getBoundingClientRect(); return [(ev.clientX - r.left) * dpr, (ev.clientY - r.top) * dpr]; };
    cv.onpointerdown = ev => { cv.setPointerCapture(ev.pointerId); pts.set(ev.pointerId, pos(ev)); moved = 0; if (pts.size === 2) { const [a, b] = [...pts.values()]; pd = Math.hypot(a[0] - b[0], a[1] - b[1]); } };
    cv.onpointermove = ev => { if (!pts.has(ev.pointerId)) return; const o = pts.get(ev.pointerId), p = pos(ev); pts.set(ev.pointerId, p);
      if (pts.size === 1) { V.x += p[0] - o[0]; V.y += p[1] - o[1]; moved += Math.abs(p[0] - o[0]) + Math.abs(p[1] - o[1]); if (moved > 6 * dpr) { moving = true; kick(); settle(); } }
      else if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pd > 0) zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, d / pd); pd = d; moved = 99; } };
    cv.onpointerup = cv.onpointercancel = ev => { const p = pts.get(ev.pointerId); pts.delete(ev.pointerId); pd = 0;
      if (p && moved <= 6 * dpr && ev.type === 'pointerup' && zoom0() < 1.8) {       // 멀리서 누르면 가장 가까운 분야로 들어감
        let g = 0, bd = 1e18; m.cen.forEach((c, k) => { const d = (c[0] * V.s + V.x - p[0]) ** 2 + (c[1] * V.s + V.y - p[1]) ** 2; if (d < bd) { bd = d; g = k; } }); enter(g); }
      else if (p && moved <= 6 * dpr && ev.type === 'pointerup') { let best = -1, bd = (22 * dpr) ** 2; for (let i = 0; i < N; i++) { const d = (sx(i) - p[0]) ** 2 + (sy(i) - p[1]) ** 2; if (d < bd) { bd = d; best = i; } } pick(best); } };
    cv.onwheel = ev => { ev.preventDefault(); const p = pos(ev); zoomAt(p[0], p[1], ev.deltaY < 0 ? 1.25 : .8); };
    function enter(g) { V.s = fit * 2.6; V.x = W / 2 - m.cen[g][0] * V.s; V.y = H / 2 - m.cen[g][1] * V.s; pick(-1); onEnter(g); moving = true; kick(); settle(); }
    box.enter = enter;
    box.kind = on => { byKind = on; drawBase(); if (sel >= 0) emit(); kick(); };
    box.querySelector('.zin').onclick = () => zoomAt(W / 2, H / 2, 1.6);
    box.querySelector('.zout').onclick = () => zoomAt(W / 2, H / 2, 1 / 1.6);
    box.querySelector('.zall').onclick = () => { pick(-1); onEnter(-1); V.s = fit; V.x = W / 2; V.y = H / 2; moving = true; kick(); settle(); };
    size();
    if (focusId != null && focusId >= 0 && focusId < N) pick(focusId);
    drawBase(); kick();
    addEventListener('resize', onResize);
    function onResize() { if (!alive || !cv.isConnected) return; const s = V.s / fit, cx = (W / 2 - V.x) / V.s, cy = (H / 2 - V.y) / V.s; size(); V.s = fit * s; V.x = W / 2 - cx * V.s; V.y = H / 2 - cy * V.s; drawBase(); kick(); }
    return m;
  }
  function stop() { alive = false; cancelAnimationFrame(raf); raf = 0; }
  return { mount, stop, COL, KCOL };
})();
