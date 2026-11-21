"""법령 마크다운(legalize-kr) 전체에서 그물을 뽑아 정적 JSON으로 쓴다.

쓰기: python3 -I pipeline/extract.py <legalize-kr/kr 폴더> <출력 폴더> [--sample N]

뽑는 줄
  ref   : 조 → 조 (같은 법 안 / 「다른 법」 제N조 / 법·영 제N조)
  law   : 조 → 법 (조 번호 없이 「법 이름」만 부름)
  term  : 정의 조항이 뜻을 정한 낱말 → 그 낱말을 쓰는 조(같은 법 + 딸린 시행령·시행규칙)
"""
import datetime, json, random, re, sys
from collections import Counter, defaultdict
from pathlib import Path

SRC, OUT = Path(sys.argv[1]), Path(sys.argv[2])
SAMPLE = int(sys.argv[sys.argv.index('--sample') + 1]) if '--sample' in sys.argv else 0

norm = lambda s: re.sub(r'[\s·ㆍ‧]', '', s)
NOISE = re.compile(r'<[^<>\n]{0,300}>|\[[^\[\]\n]*(?:개정|신설|이동|삭제|제목변경|시행일|유효기간|한정위헌|헌법불합치|위헌)[^\[\]\n]*\]')
HEAD = re.compile(r'^#{2,6} 제(\d+)조(?:의(\d+))?\s*(?:\((.*)\))?\s*$')
ART = re.compile(r'제(\d+)조(?:의(\d+))?')
# 조 번호들을 한 덩이로 잇는 말(항·호·목, 쉼표, 및, 부터 …)
CONN = re.compile(r'(?:제\d+항(?:의\d+)?|제\d+호(?:의\d+)?|[가-하]목|각\s*호|본문|단서|전단|후단|[\s,ㆍ·]|및|또는|부터|까지|내지|[과와]\s)*$')
NAMED = re.compile(r'「([^」\n]{2,80})」\s*$')
SAME = re.compile(r'(?:같은\s*법|동법)\s*$')
SAMEDEC = re.compile(r'(?:같은\s*영|동령)\s*$')
PLAW = re.compile(r'(?<![가-힣])법\s*$')
PDEC = re.compile(r'(?<![가-힣])영\s*$')
CONSTI = re.compile(r'(?<![가-힣])헌법\s*$')
SUFDEC = re.compile(r'(같은\s*법|동법|(?<![가-힣])법|」)\s*(시행령|시행규칙)\s*$')
BARE = re.compile(r'([가-힣]+(?:법|법률|령|규칙|규정))\s*$')
RANGE = re.compile(r'(?:제\d+항(?:의\d+)?)?(?:제\d+호(?:의\d+)?)?\s*부터\s*')
TERM = re.compile(r'["“]([^"“”\n]{2,30})["”]\s*(?:이란|란|이라\s*함은|라\s*함은)')

def front(text):
    if not text.startswith('---'): return {}, text
    end = text.find('\n---', 3); meta, key = {}, None
    for line in text[3:end].split('\n'):
        m = re.match(r'^([^\s:-][^:]*):\s*(.*)$', line)
        if m:
            key = m.group(1); v = m.group(2).strip().strip("'\"")
            meta[key] = [] if v in ('', '[]') else v
        elif line.startswith('- ') and key and isinstance(meta.get(key), list) and ':' not in line:
            meta[key].append(line[2:].strip())
    return meta, text[end + 4:]

def parse(path):
    meta, body = front(path.read_text(encoding='utf-8'))
    chaps, arts, cur, stack = [], [], None, {}
    for line in body.split('\n'):
        if line.startswith('#'):
            if re.match(r'^#{1,6} *부칙', line): break
            m = HEAD.match(line)
            if m:
                cur = {'k': m.group(1) + ('의' + m.group(2) if m.group(2) else ''), 't': m.group(3) or '', 'c': len(chaps) - 1, 'b': []}
                arts.append(cur); continue
            m = re.match(r'^(#{2,5}) (제\d+(?:편|장|절|관)(?:의\d+)?.*)$', line)
            if m:
                lv = len(m.group(1)); stack = {l: v for l, v in stack.items() if l < lv}; stack[lv] = NOISE.sub('', m.group(2)).strip()
                chaps.append(' › '.join(stack[l] for l in sorted(stack))); cur = None
            continue
        if cur is not None: cur['b'].append(line)
    for a in arts:
        a['x'] = re.sub(r'\n{3,}', '\n\n', '\n'.join(a['b'])).strip(); del a['b']
    seen = {}
    for a in arts: seen.setdefault(a['k'], a)          # 같은 번호가 겹치면 처음 것
    name = meta.get('제목') or path.parent.name
    mins = meta.get('소관부처') or []
    return {'name': name if isinstance(name, str) else path.parent.name, 'kind': meta.get('법령구분') or '', 'min': mins[0] if isinstance(mins, list) and mins else '',
            'date': meta.get('시행일자') or '', 'dir': path.parent.name, 'file': path.name, 'chaps': chaps, 'arts': list(seen.values())}

files = sorted(SRC.glob('*/*.md'))
laws = [parse(p) for p in files]
for i, l in enumerate(laws): l['id'] = i; l['ix'] = {a['k']: j for j, a in enumerate(l['arts'])}
byname = {}
for l in laws:                     # 같은 이름이 여럿이면(옛 군정법령 등) 시행일이 가장 늦은 것
    k = norm(l['name']); c = byname.get(k)
    if c is None or (l['date'], len(l['arts'])) > (laws[c]['date'], len(laws[c]['arts'])): byname[k] = l['id']
CONST = byname.get('대한민국헌법')

def rank(l):
    k = l['kind']
    return 0 if k == '헌법' else 1 if k == '법률' else 2 if k == '대통령령' else 3
for l in laws:
    n = l['name']; l['rank'] = rank(l); l['plaw'] = l['pdec'] = None
    if n.endswith(' 시행령'): l['plaw'] = byname.get(norm(n[:-4]))
    elif n.endswith(' 시행규칙'):
        l['plaw'] = byname.get(norm(n[:-5])); l['pdec'] = byname.get(norm(n[:-5] + ' 시행령'))
kids = defaultdict(list)
for l in laws:
    if l['plaw'] is not None: kids[l['plaw']].append(l['id'])

stat = Counter(); unresolved = Counter()
edges = Counter()        # (법, 조번호칸, 대상법, 대상조번호칸) → 횟수
lawrefs = Counter()      # (법, 조번호칸, 대상법) → 횟수  (조 번호 없이 이름만)
samples = []

def resolve(name):
    k = norm(name)
    if k in byname: return byname[k]
    k2 = re.sub(r'\(.*?\)$', '', k)
    return byname.get(k2)

for l in laws:
    for ai, a in enumerate(l['arts']):
        txt = NOISE.sub('', a['x']); last_named = None; prev_end = 0; prev = None  # prev = (법, 조칸)
        hits = set()
        for m in ART.finditer(txt):
            gap = txt[prev_end:m.start()]; key = m.group(1) + ('의' + m.group(2) if m.group(2) else '')
            for nm in re.finditer(r'「([^」\n]{2,80})」', gap):
                r = resolve(nm.group(1)); last_named = r if r is not None else -1
                if r is None: unresolved[nm.group(1)] += 1
                elif r != l['id']: lawrefs[(l['id'], ai, r)] += 1
            tail = gap[-90:]; cm = CONN.search(tail); head = tail[:cm.start()] if cm else tail
            chain = prev is not None and cm is not None and cm.start() == 0 and len(gap) <= 90
            if chain: tl = prev[0]
            elif NAMED.search(head): tl = last_named
            elif SUFDEC.search(head):
                sm = SUFDEC.search(head); base = l['plaw'] if sm.group(1) == '법' else last_named
                if base is None and sm.group(1) == '법': base = l['id']
                tl = byname.get(norm(laws[base]['name'] + sm.group(2))) if base not in (None, -1) else None
            elif SAMEDEC.search(head): tl = last_named
            elif SAME.search(head): tl = last_named
            elif CONSTI.search(head): tl = CONST
            elif PLAW.search(head): tl = l['plaw'] if l['plaw'] is not None else (l['id'] if re.search(r'이\s*법\s*$', head) else None)
            elif PDEC.search(head): tl = l['pdec'] if l['pdec'] is not None else (l['id'] if l['rank'] == 2 else None)
            elif BARE.search(head):          # 「」 없이 적은 법 이름(민법 제○조). 못 찾으면 줄을 버림
                w = BARE.search(head).group(1)
                tl = l['id'] if w in ('규칙', '규정', '본법', '본령', '본규칙') else byname.get(w)
                if tl is not None and tl != l['id']: stat['「」 없는 법 이름으로 찾은 줄'] += 1
            else: tl = l['id']
            prev_end = m.end()
            if tl is None or tl == -1:
                stat['대상 법을 못 찾은 조 가리킴'] += 1; prev = (tl, None); continue
            T = laws[tl]; ti = T['ix'].get(key)
            if ti is None:
                stat['법은 찾았으나 그 조가 없음'] += 1; prev = (tl, None); continue
            targets = [ti]
            if chain and prev[1] is not None and RANGE.fullmatch(gap) and 0 < ti - prev[1] <= 80:
                targets = list(range(prev[1] + 1, ti + 1)); stat['범위(부터~까지)로 펼친 조'] += len(targets) - 1
            for t in targets:
                if tl == l['id'] and t == ai: continue
                edges[(l['id'], ai, tl, t)] += 1; hits.add((tl, t))
            prev = (tl, ti)
        for nm in re.finditer(r'「([^」\n]{2,80})」', txt[prev_end:]):
            r = resolve(nm.group(1))
            if r is None: unresolved[nm.group(1)] += 1
            elif r != l['id']: lawrefs[(l['id'], ai, r)] += 1
        if hits and SAMPLE and random.random() < .002: samples.append((l['name'], a['k'], sorted(hits), txt[:400]))

# 정의 낱말
terms = {}               # 법 → [(낱말, {법id: [조칸...]})]
for l in laws:
    defs = []
    for ai, a in enumerate(l['arts']):
        if '정의' in a['t']:
            for t in TERM.findall(NOISE.sub('', a['x'])):
                if t not in defs: defs.append(t)
    if not defs: continue
    fam = [l['id']] + kids.get(l['id'], [])
    use = {t: {} for t in defs}; order = sorted(defs, key=len, reverse=True)
    for f in fam:
        for ai, a in enumerate(laws[f]['arts']):
            if f == l['id'] and '정의' in a['t']: continue
            txt = a['x']
            for t in order:
                if t in txt: use[t].setdefault(f, []).append(ai); txt = txt.replace(t, '\0')
    terms[l['id']] = [(t, use[t]) for t in defs]
    stat['정의 낱말'] += len(defs)

# ── 쓰기 ─────────────────────────────────────────────────────────
(OUT / 'law').mkdir(parents=True, exist_ok=True)
out_by, in_by = defaultdict(list), defaultdict(list)
lawlevel = Counter(); indeg = Counter(); outdeg = Counter()
for (s, sa, t, ta), n in edges.items():
    if s == t: out_by[s].append([sa, -1, ta, n])
    else:
        out_by[s].append([sa, t, laws[t]['arts'][ta]['k'], n]); in_by[t].append([s, laws[s]['arts'][sa]['k'], ta, n])
        lawlevel[(s, t)] += n; indeg[t] += 1; outdeg[s] += 1
    stat['조→조 줄(같은 법 안)' if s == t else '조→조 줄(다른 법으로)'] += 1
for (s, sa, t), n in lawrefs.items():
    lawlevel[(s, t)] += n; stat['조→법 줄(이름만 부름)'] += 1
namedin = defaultdict(list)
for (s, sa, t), n in lawrefs.items(): namedin[t].append([s, laws[s]['arts'][sa]['k'], n])

size = 0
for l in laws:
    i = l['id']
    d = {'id': i, 'name': l['name'], 'kind': l['kind'], 'min': l['min'], 'date': l['date'], 'plaw': l['plaw'], 'pdec': l['pdec'], 'kids': kids.get(i, []),
         'chaps': l['chaps'], 'arts': [[a['k'], a['t'], a['c'], a['x']] for a in l['arts']],
         'out': sorted(out_by[i], key=str), 'in': sorted(in_by[i], key=str), 'lawout': sorted([sa, t, n] for (s, sa, t), n in lawrefs.items() if s == i) if False else [],
         'lawin': sorted(namedin[i], key=str), 'terms': [[t, {str(f): v for f, v in u.items()}] for t, u in terms.get(i, [])]}
    l['_d'] = d
lo = defaultdict(list)
for (s, sa, t), n in lawrefs.items(): lo[s].append([sa, t, n])
for l in laws:
    l['_d']['lawout'] = sorted(lo[l['id']])
    b = json.dumps(l['_d'], ensure_ascii=False, separators=(',', ':')).encode('utf-8'); size += len(b)
    (OUT / 'law' / f"{l['id']}.json").write_bytes(b)

nb = defaultdict(Counter)
for (s, t), n in lawlevel.items(): nb[s][t] += n; nb[t][s] += n
index = {'laws': [[l['name'], l['kind'], l['min'], len(l['arts']), indeg[l['id']], outdeg[l['id']], l['plaw'] if l['plaw'] is not None else -1, len(nb[l['id']])] for l in laws],
         'const': CONST, 'made': datetime.date.today().isoformat()}
ib = json.dumps(index, ensure_ascii=False, separators=(',', ':')).encode('utf-8'); (OUT / 'index.json').write_bytes(ib)
lb = json.dumps([[s, t, n] for (s, t), n in sorted(lawlevel.items())], separators=(',', ':')).encode(); (OUT / 'lawnet.json').write_bytes(lb)

stat['파일'] = len(laws); stat['조'] = sum(len(l['arts']) for l in laws); stat['조가 0개인 파일'] = sum(1 for l in laws if not l['arts'])
stat['법→법 줄(묶음)'] = len(lawlevel); stat['못 찾은 「이름」 부름'] = sum(unresolved.values())
stat['찾은 「이름」 부름(조 번호 없이)'] = sum(lawrefs.values())
stat['시행령·규칙 가운데 윗법을 찾은 것'] = sum(1 for l in laws if l['plaw'] is not None)
stat['헌법으로 가는 줄'] = sum(1 for (s, sa, t, ta) in edges if t == CONST and s != CONST) + sum(1 for (s, sa, t) in lawrefs if t == CONST)
for k, v in sorted(stat.items()): print(f'{k}\t{v:,}')
print(f'index.json {len(ib) / 1e6:.2f}MB · lawnet.json {len(lb) / 1e6:.2f}MB · law/*.json {size / 1e6:.0f}MB')
print('갈래', Counter(('헌법', '법률', '대통령령', '그 밖 규칙')[l['rank']] for l in laws))
print('못 찾은 이름 상위', unresolved.most_common(12))
print('가장 많이 가리켜지는 법', [(laws[i]['name'], n) for i, n in indeg.most_common(8)])
print('조 0개 파일 예', [l['dir'] + '/' + l['file'] for l in laws if not l['arts']][:8])
if SAMPLE:
    random.shuffle(samples)
    for name, k, hits, txt in samples[:SAMPLE]:
        print('──', name, '제' + k + '조', '→', [(laws[t]['name'], '제' + laws[t]['arts'][ti]['k'] + '조') for t, ti in hits][:8]); print('  ', txt.replace('\n', ' ')[:330])
