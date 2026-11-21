"""헌법·개인정보 보호법으로 네 가지 그물 시안(폰 너비 SVG→HTML)을 만든다.
쓰기: python3 -I sketch/make.py <헌법.md> <개인정보보호법.md> <out폴더>"""
import re, sys, math, itertools, html
from pathlib import Path

CONST, PIPA, OUT = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
W = 390
INK, INK2, MUTED, GRID, SURF = '#0b0b0b', '#52514e', '#898781', '#e1e0d9', '#fcfcfb'
BLUE = '#2a78d6'
SEQ = ['#eeeeea', '#9ec5f4', '#3987e5', '#104281']  # 0 · 1 · 2 · 3곳 이상

def parse(path):
    """(장 이름, 조 키, 조 제목, 본문) 목록. 부칙은 뺀다."""
    arts, chap, cur = [], '', None
    for line in path.read_text(encoding='utf-8').split('\n'):
        if line.startswith('## '):
            if '부칙' in line: break
            chap = line[3:].strip(); continue
        m = re.match(r'#{2,6} 제(\d+)조(?:의(\d+))?\s*(?:\((.*?)\))?', line)
        if m:
            cur = [chap, m.group(1) + ('의' + m.group(2) if m.group(2) else ''), m.group(3) or '', []]
            arts.append(cur); continue
        if cur is not None and not line.startswith('#'): cur[3].append(line)
    return [(c, k, t, '\n'.join(b)) for c, k, t, b in arts]

def page(name, title, sub, svg, h, note):
    doc = f'''<!doctype html><meta charset="utf-8"><style>
body{{margin:0;background:{SURF};font-family:"Noto Sans KR","WenQuanYi Zen Hei",system-ui,sans-serif;color:{INK};width:{W}px}}
h1{{font-size:17px;margin:14px 16px 2px;font-weight:700}} p{{font-size:12.5px;color:{INK2};margin:0 16px 6px;line-height:1.45}}
.n{{color:{MUTED};font-size:11.5px;margin:4px 16px 14px}} text{{font-family:inherit}}
</style><h1>{title}</h1><p>{sub}</p><svg width="{W}" height="{h}" viewBox="0 0 {W} {h}">{svg}</svg><p class="n">{note}</p>'''
    (OUT / f'{name}.html').write_text(doc, encoding='utf-8')
    print(name, h + 78 + 18 * (len(sub) // 28 + len(note) // 31 + 2))

def T(x, y, s, size=11, fill=INK2, anchor='start', weight=400):
    return f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" fill="{fill}" text-anchor="{anchor}" font-weight="{weight}">{html.escape(str(s))}</text>'

# ── ① 가리킴: 개인정보 보호법 활 그림 ─────────────────────────────
pipa = parse(PIPA)
keys = [k for _, k, _, _ in pipa]; idx = {k: i for i, k in enumerate(keys)}
REF = r'제(\d+)조(?:의(\d+))?'
TAIL = r'(?:\s*' + REF + r'(?:제\d+항)?(?:제\d+호)?(?:[,ㆍ]|\s*및|\s*또는|부터|까지)*)+'
edges = {}
for _, k, _, body in pipa:
    body = re.sub(r'(?:「[^」]+」|같은 법|동법)' + TAIL, ' ', body)   # 다른 법의 조는 뺀다
    for m in re.finditer(REF, body):
        t = m.group(1) + ('의' + m.group(2) if m.group(2) else '')
        if t in idx and t != k: edges[(k, t)] = edges.get((k, t), 0) + 1
indeg = {}
for (s, t), n in edges.items(): indeg[t] = indeg.get(t, 0) + 1
n = len(keys); L, R = 14, W - 14; step = (R - L) / (n - 1); base = 190
X = lambda k: L + idx[k] * step
top = sorted(indeg, key=lambda k: -indeg[k])[:3]
svg = []
for (s, t) in edges:
    a, b = sorted((X(s), X(t))); r = (b - a) / 2; hot = t in top
    svg.append(f'<path d="M{a:.1f},{base} A{r:.1f},{min(r, 232) :.1f} 0 0 1 {b:.1f},{base}" fill="none" stroke="{BLUE if hot else MUTED}" stroke-width="{1 if hot else .6}" opacity="{.55 if hot else .28}"/>')
svg.append(f'<line x1="{L}" x2="{R}" y1="{base}" y2="{base}" stroke="#c3c2b7"/>')
for k in keys:
    d = indeg.get(k, 0); r = 1.2 + math.sqrt(d) * .9
    svg.append(f'<circle cx="{X(k):.1f}" cy="{base}" r="{r:.1f}" fill="{BLUE if k in top else INK2}" stroke="{SURF}" stroke-width=".8"/>')
title_of = {k: t for _, k, t, _ in pipa}
for i, k in enumerate(sorted(top, key=lambda k: idx[k])):
    y = base + 26 + i * 30; x = X(k)
    svg.append(f'<line x1="{x:.1f}" x2="{x:.1f}" y1="{base + 6}" y2="{y - 11}" stroke="{BLUE}" stroke-width=".8"/>')
    lab = f'제{k}조 {title_of[k][:10]} · {indeg[k]}개 조가 가리킴'
    svg.append(T(min(x + 5, W - 12 - len(lab) * 10.2), y, lab, 11.5, INK, 'start', 700))
svg.append(T(L, base + 122, '제1조', 10.5, MUTED)); svg.append(T(R, base + 122, f'제{keys[-1]}조', 10.5, MUTED, 'end'))
svg.append(T(W / 2, base + 122, '← 조문 차례 →', 10.5, MUTED, 'middle'))
page('1-가리킴', '① 가리킴 그물', f'개인정보 보호법 {n}개 조. 활 하나 = "제○조에 따라"처럼 한 조가 다른 조를 가리킴. 모두 {len(edges)}줄.',
     ''.join(svg), base + 132, '점이 클수록 많이 가리켜지는 조. 헌법 본문은 다른 조를 번호로 가리키는 곳이 0곳이라 이 그림이 비어서 일반 법으로 그림.')

# ── ② 맡김: 헌법이 법률에 맡기는 곳 ───────────────────────────────
con = parse(CONST)
DELE = r'법률이 정하는|법률이 정한|법률로 정한다|법률로써|법률에 의하'
chaps = []
for c, k, t, body in con:
    if not chaps or chaps[-1][0] != c: chaps.append((c, []))
    chaps[-1][1].append((k, len(re.findall(DELE, body))))
svg, y, cell, cols, x0 = [], 6, 15, 16, 118
tot = sum(d for _, a in chaps for _, d in a); hit = sum(1 for _, a in chaps for _, d in a if d)
for c, a in chaps:
    name = re.sub(r'^제\d+장\s*', '', c)
    svg.append(T(x0 - 8, y + 11, name, 11.5, INK, 'end', 700))
    svg.append(T(x0 - 8, y + 24, f'{sum(1 for _, d in a if d)}/{len(a)}조', 10, MUTED, 'end'))
    for i, (k, d) in enumerate(a):
        cx, cy = x0 + (i % cols) * (cell + 2), y + (i // cols) * (cell + 2)
        svg.append(f'<rect x="{cx}" y="{cy}" width="{cell}" height="{cell}" rx="3" fill="{SEQ[min(d, 3)]}"><title>제{k}조 {d}곳</title></rect>')
    y += max(2, math.ceil(len(a) / cols)) * (cell + 2) + 9
lx = x0
for lab, col in zip(['없음', '1곳', '2곳', '3곳 이상'], SEQ):
    svg.append(f'<rect x="{lx}" y="{y + 4}" width="12" height="12" rx="3" fill="{col}"/>'); svg.append(T(lx + 16, y + 14, lab, 10.5, INK2)); lx += 16 + len(lab) * 10 + 12
page('2-맡김', '② 맡김 그물', f'헌법 130개 조를 장별로 늘어놓음. 네모 하나 = 조 하나. 짙을수록 "법률로 정한다"며 법률에 넘기는 곳이 많음. {hit}개 조에서 {tot}곳.',
     ''.join(svg), y + 24, '전체 판에서는 네모를 누르면 그 조가 넘긴 법률 → 시행령 → 시행규칙으로 줄이 이어짐(헌법 글만으로는 받는 법 이름을 알 수 없어 시안에는 넘기는 쪽만 표시).')

# ── ③ 정의 낱말 퍼짐: 개인정보 보호법 제2조 ───────────────────────
defs = re.findall(r'^\s*\d+(?:의\d+)?\\?\.\s*"([^"]+)"', next(b for _, k, _, b in pipa if k == '2'), re.M)
order = sorted(defs, key=len, reverse=True)
use = {d: [] for d in defs}
for _, k, _, body in pipa:
    if k == '2': continue
    txt = body
    for d in order:                       # 긴 낱말부터 세고 지워 '처리'가 '개인정보처리자'에 겹쳐 세지지 않게
        if d in txt: use[d].append(k); txt = txt.replace(d, '▒')
rows = sorted(defs, key=lambda d: -len(use[d]))
svg, x0, x1, rh = [], 150, W - 40, 26
st = (x1 - x0) / (n - 1)
for i, d in enumerate(rows):
    y = 14 + i * rh
    svg.append(T(x0 - 8, y + 4, d if len(d) <= 11 else d[:10] + '…', 11.5, INK, 'end', 700))
    svg.append(f'<line x1="{x0}" x2="{x1}" y1="{y}" y2="{y}" stroke="{GRID}"/>')
    for k in use[d]:
        xx = x0 + idx[k] * st
        svg.append(f'<line x1="{xx:.1f}" x2="{xx:.1f}" y1="{y - 7}" y2="{y + 7}" stroke="{BLUE}" stroke-width="1.4" opacity=".8"/>')
    svg.append(T(W - 12, y + 4, len(use[d]), 11, INK2, 'end'))
yb = 14 + len(rows) * rh
svg.append(T(x0, yb + 6, '제1조', 10.5, MUTED)); svg.append(T(x1, yb + 6, f'제{keys[-1]}조', 10.5, MUTED, 'end')); svg.append(T(W - 12, yb + 6, '조 수', 10.5, MUTED, 'end'))
page('3-정의낱말', '③ 정의 낱말이 퍼지는 그물', f'개인정보 보호법 제2조가 뜻을 정한 낱말 {len(defs)}개. 세로 금 하나 = 그 낱말을 쓰는 조. 낱말 하나가 법 전체를 꿰는 실이 됨.',
     ''.join(svg), yb + 14, '전체 판에서는 낱말을 누르면 다른 법·시행령까지 따라감. 헌법에는 뜻을 정하는 조가 없어 일반 법으로 그림.')

# ── ④ 낱말이 같이 나오는 그물: 헌법 ───────────────────────────────
WORDS = ['국민', '국가', '법률', '대통령', '국회', '정부', '법원', '헌법재판소', '자유', '권리', '의무', '선거', '재판', '조약', '국무회의', '공무원']
has = {w: set() for w in WORDS}
for _, k, _, body in con:
    txt = body
    for w in sorted(WORDS, key=len, reverse=True):
        if w in txt: has[w].add(k); txt = txt.replace(w, '▒')
pairs = {(a, b): len(has[a] & has[b]) for a, b in itertools.combinations(WORDS, 2)}
cx, cy, rad = W / 2, 190, 128
pos = {w: (cx + rad * math.sin(2 * math.pi * i / len(WORDS)), cy - rad * math.cos(2 * math.pi * i / len(WORDS))) for i, w in enumerate(WORDS)}
svg, mx = [], max(pairs.values())
for (a, b), c in sorted(pairs.items(), key=lambda p: p[1]):
    if c < 3: continue
    (xa, ya), (xb, yb2) = pos[a], pos[b]
    svg.append(f'<path d="M{xa:.1f},{ya:.1f} Q{cx},{cy} {xb:.1f},{yb2:.1f}" fill="none" stroke="{BLUE}" stroke-width="{.5 + 7 * c / mx:.1f}" opacity="{.12 + .55 * c / mx:.2f}" stroke-linecap="round"/>')
for i, w in enumerate(WORDS):
    x, y = pos[w]; r = 3 + math.sqrt(len(has[w])) * 1.5
    svg.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{BLUE}" stroke="{SURF}" stroke-width="2"/>')
    ang = 2 * math.pi * i / len(WORDS); lx, ly = cx + (rad + r + 7) * math.sin(ang), cy - (rad + r + 7) * math.cos(ang)
    anchor = 'middle' if abs(math.sin(ang)) < .2 else ('start' if math.sin(ang) > 0 else 'end')
    svg.append(T(lx, ly + 4 + (-3 if math.cos(ang) > .8 else 6 if math.cos(ang) < -.8 else 0), f'{w} {len(has[w])}', 11.5, INK, anchor, 700))
best = max(pairs, key=pairs.get)
page('4-같이나옴', '④ 낱말이 같이 나오는 그물', f'헌법 130개 조에서 고른 낱말 {len(WORDS)}개. 줄이 굵을수록 같은 조에 함께 자주 나옴. 숫자는 그 낱말이 나오는 조 수.',
     ''.join(svg), 372, f'가장 굵은 줄: {best[0]}–{best[1]} {pairs[best]}개 조. 3개 조 이상 겹치는 줄만 그림. 낱말은 시안용으로 손으로 고름.')
print('가리킴', n, len(edges), [(k, indeg[k]) for k in top]); print('맡김', hit, tot); print('정의', [(d, len(use[d])) for d in rows]); print('같이', best, pairs[best])
