# 법그물 — 한국 법의 언어 그물

한국 법령 5,775개(헌법·법률·대통령령·부령·규칙)의 조문이 서로를 가리키는 줄을 뽑아 보여 주는 정적 웹.

- `pipeline/extract.py` — 법령 마크다운에서 조→조·조→법 줄, 정의 낱말을 뽑아 `web/data/`에 JSON으로 씀
- `pipeline/layout.mjs` — 전체 지도의 점 자리를 미리 셈함
- `web/` — 서버 없이 도는 화면

```
git clone --depth 1 https://github.com/legalize-kr/legalize-kr.git data/legalize-kr
python3 -I pipeline/extract.py data/legalize-kr/kr web/data
(cd pipeline && npm install) && node pipeline/layout.mjs web/data
```

자료: 법제처 국가법령정보센터 공개 법령(legalize-kr 저장소 경유). 줄은 글자 규칙으로 뽑은 것이라 빠지거나 틀린 것이 있을 수 있음.
