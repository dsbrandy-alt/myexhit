# MYEXHIT — 배포 패키지

전시·미술관 권역 탐색 사이트의 최종 호스팅 파일 묶음.

## 파일 구성

```
dist/
├── index.html                       # 메인 페이지
├── app.jsx                          # React 앱 (인라인 Babel)
├── tweaks-panel.jsx                 # Tweaks 패널 컴포넌트
├── favicon.svg                      # 사이트 파비콘 (E5 로고)
├── netlify.toml                     # Netlify 빌드/리다이렉트 설정
└── netlify/
    └── functions/
        └── naver-search.js          # 네이버 검색 프록시 (다중쿼리 + 블로그 폴백)
```

## 배포 (Netlify)

1. 이 폴더 전체를 Git 레포 루트로 푸시하거나 Netlify 사이트에 직접 업로드
2. Netlify **Site settings → Environment variables**에 다음 2개 추가:
   - `NAVER_CLIENT_ID` — 네이버 개발자센터에서 발급
   - `NAVER_CLIENT_SECRET` — 동일
3. 자동 배포 시작. `myexhit.netlify.app` 같은 도메인에 그대로 올라갑니다.

## 검색 동작

### 1) 다중 쿼리 (지역검색)
사용자가 "메종 나비"를 입력하면 백엔드에서 동시에 5개 쿼리 실행:
- `메종 나비`
- `메종 나비 갤러리`
- `메종 나비 미술관`
- `메종 나비 전시`
- `메종 나비 서울`

결과를 title+address 기준으로 중복 제거하고 머지.

### 2) 블로그 폴백
지역검색 결과에 검색어의 첫 단어가 하나도 안 보이면 → 자동으로 네이버 블로그 검색
API를 호출해 후기 글에서라도 잡아냅니다. 프론트에서는 "블로그" 출처 배지와
테라코타 폴백 배너로 명확히 구분 표시.

## 디자인 시스템

- **색** paper #fbf8f1 · ink #0a0907 · 에메랄드 #0f5044 · 테라코타 #b03a1a
- **타입** Pretendard (한글) + Fraunces (영문 serif) + JetBrains Mono (mono)
- **로고** E5 변형 — Color Grid 4×4 + σ14 블러 + 60% 베이지 워시 + 잉크 핀

## Tweaks (사용자 토글)

툴바에서 Tweaks 켜면 노출:
- 액센트 컬러 (4종)
- 카드 밀도 (regular / compact)
- 지도 미리보기 on/off
- 검색 신뢰도 표시 on/off

## 미해결 / 향후 작업

- 현재 위치 정확도 — Geolocation API 결과를 origin 갱신에 연결
- 거리 계산 — 직선거리 외 도보/대중교통 시간 옵션
- 사용자 직접 등록 — 네이버에도, 블로그에도 없는 공간을 수동으로 추가
- 즐겨찾기 — localStorage 기반 저장
