// 법 전체 지도의 자리를 미리 셈한다(힘으로 밀고 당기는 배치).  쓰기: node pipeline/layout.mjs web/data
import { readFileSync, writeFileSync } from 'node:fs';
import { forceSimulation, forceLink, forceManyBody, forceX, forceY } from 'd3-force';
const dir = process.argv[2], idx = JSON.parse(readFileSync(`${dir}/index.json`)), net = JSON.parse(readFileSync(`${dir}/lawnet.json`));
const GROUPS = ['경제·금융·세금', '국토·교통·바다', '복지·노동', '사법·치안', '행정·국방·외교', '산업·과학', '환경·농림', '교육·문화'];
const M = [
  ['재정경제부', '기획재정부', '기획예산처', '금융위원회', '공정거래위원회', '조달청', '관세청', '국세청', '국가데이터처'],
  ['국토교통부', '해양수산부', '해양경찰청', '행정중심복합도시건설청', '새만금개발청'],
  ['보건복지부', '고용노동부', '노동부', '성평등가족부', '식품의약품안전처', '질병관리청', '국가보훈부'],
  ['법무부', '법원행정처', '대법원', '헌법재판소', '경찰청', '대검찰청', '고위공직자범죄수사처', '법제처', '국가인권위원회'],
  [],
  ['산업통상부', '과학기술정보통신부', '중소벤처기업부', '지식재산처', '원자력안전위원회', '방송미디어통신위원회', '우주항공청', '개인정보보호위원회'],
  ['기후에너지환경부', '농림축산식품부', '산림청', '농촌진흥청', '기상청'],
  ['교육부', '문화체육관광부', '국가유산청', '국가교육위원회']];
const gOf = new Map(); M.forEach((a, g) => a.forEach(m => gOf.set(m, g)));
const nodes = idx.laws.map((l, i) => ({ i, g: gOf.has(l[2]) ? gOf.get(l[2]) : 4 }));
// 읽기 쉽게: 헌법은 한가운데, 여덟 분야는 둘레의 제자리로 끌어당김
nodes.forEach(n => { const a = (n.g / 8) * 2 * Math.PI - Math.PI / 2; n.ax = n.i === idx.const ? 0 : Math.cos(a) * 1150; n.ay = n.i === idx.const ? 0 : Math.sin(a) * 1150; });
const pair = new Map();
for (const [s, t, n] of net) { const k = s < t ? s + '_' + t : t + '_' + s; pair.set(k, (pair.get(k) || 0) + n); }
idx.laws.forEach((l, i) => { if (l[6] >= 0) { const k = l[6] < i ? l[6] + '_' + i : i + '_' + l[6]; pair.set(k, (pair.get(k) || 0) + 50); } });
const links = [...pair].map(([k, w]) => { const [s, t] = k.split('_').map(Number); return { source: s, target: t, w }; });
// 배치에는 굵은 줄(3번 넘게 부름)과 윗법–아랫법 줄만 써서 덩어리가 드러나게 함. 줄 힘은 d3 기본(이웃이 많은 법일수록 약하게)
const best = new Map();           // 굵은 줄이 하나도 없는 법은 가장 굵은 줄 하나로 몸통에 붙임
for (const l of links) for (const e of [l.source, l.target]) if (!best.has(e) || best.get(e).w < l.w) best.set(e, l);
const has = new Set(); for (const l of links) if (l.w >= 3) { has.add(l.source); has.add(l.target); }
const strong = links.filter(l => l.w >= 3 || (!has.has(l.source) && best.get(l.source) === l) || (!has.has(l.target) && best.get(l.target) === l));
const sim = forceSimulation(nodes).force('link', forceLink(strong).distance(l => l.w >= 50 ? 10 : 46))
  .force('charge', forceManyBody().strength(-70).theta(1.1)).force('x', forceX(n => n.ax).strength(n => n.i === idx.const ? 1 : .3)).force('y', forceY(n => n.ay).strength(n => n.i === idx.const ? 1 : .3)).stop();
const T = 360; for (let i = 0; i < T; i++) { sim.tick(); if (i % 60 === 0) console.error('tick', i); }
const rs = nodes.map(n => Math.hypot(n.x, n.y)).sort((a, b) => a - b), r = rs[Math.floor(rs.length * .9)], q = v => Math.round(v / r * 4000);
const id = v => typeof v === 'object' ? v.i : v;
const edges = links.filter(l => l.w >= 2).sort((a, b) => b.w - a.w).flatMap(l => [id(l.source), id(l.target), Math.min(l.w, 999)]);
const med = a => a.sort((x, y) => x - y)[a.length >> 1];
const cen = GROUPS.map((_, g) => { const ns = nodes.filter(n => n.g === g && n.i !== idx.const); return [q(med(ns.map(n => n.x))), q(med(ns.map(n => n.y))), ns.length]; });
const flow = GROUPS.map(() => GROUPS.map(() => 0)); for (const [s, t, n] of net) flow[nodes[s].g][nodes[t].g] += n;
writeFileSync(`${dir}/map.json`, JSON.stringify({ groups: GROUPS, cen, flow, x: nodes.map(n => q(n.x)), y: nodes.map(n => q(n.y)), g: nodes.map(n => n.g), e: edges }));
console.log('법', nodes.length, '줄(배치용)', links.length, '줄(그림용)', edges.length / 3, '갈래', GROUPS.map((g, i) => g + ' ' + nodes.filter(n => n.g === i).length).join(' · '));
