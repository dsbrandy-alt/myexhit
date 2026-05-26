/* global React, ReactDOM, TweaksPanel, useTweaks, TweakSection, TweakSlider, TweakRadio, TweakToggle, TweakColor */
const { useState, useMemo, useEffect, useRef } = React;

/* ---------------------------------------------------------------- */
/* MOCK DATA — 성수/성동 인근 전시·미술관 (메종 나비 포함)               */
/* origin: 성수동 일대 (37.5447, 127.0557) 기준 거리 사전계산           */
/* ---------------------------------------------------------------- */
const VENUES = [
  {
    id: "maison-nabi",
    name: "메종 나비",
    nameEn: "Maison Nabi",
    category: "갤러리",
    address: "서울 성동구 금호로3길 14",
    addressDetail: "1F · 응봉역 도보 6분",
    lat: 37.5497, lng: 127.0203,
    dist: 3.4,
    show: {
      title: "대비, 그 사이의 시학",
      titleEn: "Poetics of Contrast",
      period: "2026.04.10 — 2026.07.30",
      endDate: "2026-07-30",
      status: "전시 중",
      curator: "기획 · 정민",
      artists: ["김연수", "오하영", "장우식"],
    },
    fee: "무료",
    hours: "화–일 12:00–19:00 · 월 휴관",
    phone: "0507-1342-8861",
    links: {
      naver: "https://map.naver.com/p/search/메종 나비",
      review: "https://m.blog.naver.com/moses_0707/224260836912",
    },
    tags: ["회화", "독립갤러리", "신진작가"],
    confidence: "low",
    note: "네이버 지역검색 미인덱싱 — 블로그 후기 기준",
  },
  {
    id: "d-museum",
    name: "디뮤지엄",
    nameEn: "D Museum",
    category: "사립미술관",
    address: "서울 성동구 왕십리로 83-21",
    addressDetail: "성수 1F~B1",
    lat: 37.5443, lng: 127.0440,
    dist: 1.2,
    show: {
      title: "우리는 끝없이 펼쳐지는 풍경 속에서",
      titleEn: "An Endless Landscape",
      period: "2025.09.05 — 2026.08.15",
      endDate: "2026-08-15",
      status: "전시 중",
      curator: "디뮤지엄 큐레토리얼팀",
      artists: ["국내외 12팀"],
    },
    fee: "성인 18,000원 · 청소년 13,000원",
    hours: "화–일 10:00–19:00 · 월 휴관",
    phone: "070-5097-0020",
    links: {
      naver: "https://map.naver.com/p/search/디뮤지엄",
      site: "https://daelimmuseum.org",
    },
    tags: ["사진", "설치", "기획전"],
    confidence: "high",
  },
  {
    id: "groundseesaw",
    name: "그라운드시소 성수",
    nameEn: "Ground Seesaw Seongsu",
    category: "미디어아트",
    address: "서울 성동구 아차산로 84",
    addressDetail: "1·2호점",
    lat: 37.5447, lng: 127.0557,
    dist: 0.4,
    show: {
      title: "빛의 정원: 클로드 모네",
      titleEn: "Light Garden: Monet",
      period: "2025.07.20 — 2026.09.30",
      endDate: "2026-09-30",
      status: "전시 중",
      curator: "미디어앤아트",
      artists: ["몰입형 미디어아트"],
    },
    fee: "성인 22,000원 · 청소년 17,000원",
    hours: "매일 10:00–20:00 · 입장마감 19:00",
    phone: "1522-1796",
    links: {
      naver: "https://map.naver.com/p/search/그라운드시소 성수",
      site: "https://groundseesaw.co.kr",
    },
    tags: ["몰입형", "미디어", "포토존"],
    confidence: "high",
  },
  {
    id: "seoulforest-gallery",
    name: "서울숲 갤러리아 포레",
    nameEn: "Galleria Foret",
    category: "갤러리",
    address: "서울 성동구 서울숲2길 32-14",
    addressDetail: "지하1층",
    lat: 37.5454, lng: 127.0413,
    dist: 1.5,
    show: {
      title: "정적의 표면",
      titleEn: "Surface of Silence",
      period: "2026.04.15 — 2026.06.20",
      endDate: "2026-06-20",
      status: "전시 중",
      curator: "이수경",
      artists: ["박서영", "한지민"],
    },
    fee: "무료",
    hours: "화–토 11:00–18:00 · 일·월 휴관",
    phone: "02-6952-7000",
    links: {
      naver: "https://map.naver.com/p/search/서울숲 갤러리아 포레",
    },
    tags: ["조각", "추상"],
    confidence: "medium",
  },
  {
    id: "ararioo",
    name: "아라리오뮤지엄 인 스페이스",
    nameEn: "Arario Museum in Space",
    category: "사립미술관",
    address: "서울 종로구 율곡로 83",
    addressDetail: "구 공간 사옥",
    lat: 37.5797, lng: 126.9858,
    dist: 7.1,
    show: {
      title: "Really? Really!",
      titleEn: "Really? Really!",
      period: "상설전 · 일부 교체",
      endDate: null,
      status: "전시 중",
      curator: "아라리오 컬렉션",
      artists: ["트레이시 에민", "키스 해링 외"],
    },
    fee: "성인 14,000원 · 학생 7,000원",
    hours: "화–일 10:00–19:00 · 월 휴관",
    phone: "02-736-5700",
    links: {
      naver: "https://map.naver.com/p/search/아라리오뮤지엄 인 스페이스",
      site: "https://www.arariomuseum.org",
    },
    tags: ["컨템포러리", "컬렉션"],
    confidence: "high",
  },
  {
    id: "leeum",
    name: "리움미술관",
    nameEn: "Leeum Museum of Art",
    category: "사립미술관",
    address: "서울 용산구 이태원로55길 60-16",
    addressDetail: "한남동",
    lat: 37.5384, lng: 126.9990,
    dist: 6.3,
    show: {
      title: "이불 — 1998년 이후",
      titleEn: "Lee Bul: 1998–",
      period: "2025.12.04 — 2026.07.04",
      endDate: "2026-07-04",
      status: "전시 중",
      curator: "리움미술관",
      artists: ["이불"],
    },
    fee: "성인 20,000원 · 상설전 무료",
    hours: "화–일 10:00–18:00 · 월 휴관",
    phone: "02-2014-6900",
    links: {
      naver: "https://map.naver.com/p/search/리움미술관",
      site: "https://www.leeum.org",
    },
    tags: ["기획전", "한국현대"],
    confidence: "high",
  },
  {
    id: "mmca-seoul",
    name: "국립현대미술관 서울",
    nameEn: "MMCA Seoul",
    category: "국립미술관",
    address: "서울 종로구 삼청로 30",
    addressDetail: "소격동",
    lat: 37.5786, lng: 126.9803,
    dist: 7.6,
    show: {
      title: "올해의 작가상 2025",
      titleEn: "Korea Artist Prize 2025",
      period: "2025.10.31 — 2026.07.29",
      endDate: "2026-07-29",
      status: "전시 중",
      curator: "MMCA",
      artists: ["4인 후보"],
    },
    fee: "통합권 4,000원 · 수·토 야간 무료",
    hours: "월–일 10:00–18:00 · 수·토 21:00",
    phone: "02-3701-9500",
    links: {
      naver: "https://map.naver.com/p/search/국립현대미술관 서울",
      site: "https://www.mmca.go.kr",
    },
    tags: ["국립", "기획전"],
    confidence: "high",
  },
  {
    id: "apma",
    name: "아모레퍼시픽미술관",
    nameEn: "Amorepacific Museum of Art",
    category: "사립미술관",
    address: "서울 용산구 한강대로 100",
    addressDetail: "아모레퍼시픽 본사 B1",
    lat: 37.5290, lng: 126.9650,
    dist: 8.4,
    show: {
      title: "엘름그린 & 드라그셋",
      titleEn: "Elmgreen & Dragset",
      period: "2025.09.03 — 2026.08.23",
      endDate: "2026-08-23",
      status: "전시 중",
      curator: "APMA",
      artists: ["엘름그린 & 드라그셋"],
    },
    fee: "성인 18,000원",
    hours: "화–일 10:00–18:00 · 월 휴관",
    phone: "02-6040-2345",
    links: {
      naver: "https://map.naver.com/p/search/아모레퍼시픽미술관",
      site: "https://apma.amorepacific.com",
    },
    tags: ["조각", "설치"],
    confidence: "high",
  },
  {
    id: "pace",
    name: "페이스갤러리 서울",
    nameEn: "Pace Gallery Seoul",
    category: "갤러리",
    address: "서울 용산구 이태원로 262",
    addressDetail: "한남동 르베이지 빌딩",
    lat: 37.5375, lng: 127.0008,
    dist: 6.1,
    show: {
      title: "Lee Ufan: Quiet Resonance",
      titleEn: "Lee Ufan: Quiet Resonance",
      period: "2026.04.07 — 2026.06.10",
      endDate: "2026-06-10",
      status: "전시 중",
      curator: "Pace",
      artists: ["이우환"],
    },
    fee: "무료",
    hours: "화–토 10:00–18:00",
    phone: "02-790-9388",
    links: {
      naver: "https://map.naver.com/p/search/페이스갤러리 서울",
      site: "https://www.pacegallery.com",
    },
    tags: ["블루칩", "회화"],
    confidence: "high",
  },
  {
    id: "artsonje",
    name: "아트선재센터",
    nameEn: "Art Sonje Center",
    category: "비영리미술관",
    address: "서울 종로구 율곡로3길 87",
    addressDetail: "안국역 도보 8분",
    lat: 37.5808, lng: 126.9839,
    dist: 7.4,
    show: {
      title: "사라지는 것들에 관하여",
      titleEn: "On Vanishings",
      period: "2026.04.10 — 2026.06.28",
      endDate: "2026-06-28",
      status: "전시 중",
      curator: "김선정",
      artists: ["국내 5인"],
    },
    fee: "성인 5,000원",
    hours: "화–일 12:00–19:00 · 월 휴관",
    phone: "02-733-8945",
    links: {
      naver: "https://map.naver.com/p/search/아트선재센터",
      site: "https://artsonje.org",
    },
    tags: ["비영리", "실험"],
    confidence: "high",
  },
  {
    id: "whanki",
    name: "환기미술관",
    nameEn: "Whanki Museum",
    category: "사립미술관",
    address: "서울 종로구 자하문로40길 63",
    addressDetail: "부암동 · 경복궁역 3번 출구 마을버스",
    lat: 37.5942, lng: 126.9628,
    dist: 8.7,
    show: {
      title: "시(視)의 이: PART II — 디지털 신소장품",
      titleEn: "The Eye of the Poem: PART II",
      period: "2026.04.30 — 2026.07.31",
      endDate: "2026-07-31",
      status: "전시 중",
      curator: "환기재단",
      artists: ["김환기 외 디지털 신소장품"],
    },
    fee: "성인 22,000원 · 경로 11,000원 · 청소년 11,000원",
    hours: "화–일 10:00–17:00 · 월 휴관",
    phone: "02-391-7701",
    links: {
      naver: "https://map.naver.com/p/search/환기미술관",
      site: "https://whankimuseum.org",
    },
    tags: ["김환기", "수화", "부암동"],
    confidence: "high",
  },
];

/* ---------------------------------------------------------------- */
/* HELPERS                                                          */
/* ---------------------------------------------------------------- */
const TODAY = new Date(); // 오늘 기준
const MS_DAY = 86400000;

// 필수 필드 검증: 상호명 · 주소 · 전시명이 모두 있는 항목만 표시
function isShowable(v) {
  if (!v) return false;
  if (!v.name || !v.address) return false;
  if (!v.show?.title) return false;
  if (v.show.title.includes("정보 보강 필요")) return false;
  return true;
}

// 종료일까지 남은 일 — endDate 없으면 null (상설전)
function daysLeft(v) {
  if (!v.show?.endDate) return null;
  const end = new Date(v.show.endDate);
  return Math.ceil((end - TODAY) / MS_DAY);
}

// 기간 필터
function passesPeriodFilter(v, mode) {
  const dl = daysLeft(v);
  if (mode === "all")   return true;
  if (mode === "soon")  return dl != null && dl >= 0 && dl <= 14;
  // default "active": 종료되지 않은 것만 (endDate null = 상설, 또는 dl>=0)
  return dl == null || dl >= 0;
}

// 입장료 문자열 → 숫자 세긴 (성인 기준 원)
function feeNumeric(feeStr) {
  if (!feeStr) return null;
  if (/(무료|free)/i.test(feeStr)) return 0;
  const m = feeStr.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*원/);
  if (m) return parseInt(m[1].replace(/,/g, ""), 10);
  return null;
}
function passesFeeFilter(v, mode) {
  if (mode === "all") return true;
  const f = feeNumeric(v.fee);
  if (mode === "free")     return f === 0;
  if (mode === "under10k") return f != null && f <= 10000;
  if (mode === "paid")     return f != null && f > 0;
  return true;
}

const ZONE = (km) => (km == null ? null : km <= 10 ? 10 : km <= 20 ? 20 : 30);
const ZONE_LABEL = (km) => km == null ? "〔거리 미상〕" : `〔${ZONE(km)}km권〕`;
const CATEGORY_ICON = (cat) => ({
  "갤러리": "◇",
  "사립미술관": "◆",
  "국립미술관": "★",
  "비영리미술관": "◈",
  "미디어아트": "◉",
  "박물관": "◐",
  "분류 미상": "○",
}[cat] || "◇");

// Naver mapx/mapy → lat/lng (네이버는 곱셈 단위가 일관되지 않아 분기 시도)
function parseCoords(mapx, mapy) {
  if (mapx == null || mapy == null) return null;
  const x = Number(mapx), y = Number(mapy);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  for (const d of [1e7, 1e6, 1e5, 1e4, 1]) {
    const lng = x / d, lat = y / d;
    if (lng >= 124 && lng <= 132 && lat >= 33 && lat <= 39) return { lat, lng };
  }
  return null;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r, dLng = (lng2 - lng1) * r;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin(dLng/2)**2;
  return +(2*R*Math.asin(Math.sqrt(a))).toFixed(1);
}

// 네이버 검색 응답 item → Venue 객체로 매핑
function itemToVenue(item, idx, origin) {
  const coords = parseCoords(item.mapx, item.mapy);
  const dist = coords ? haversineKm(origin.lat, origin.lng, coords.lat, coords.lng) : null;
  return {
    id: `api-${idx}-${(item.title || "").slice(0, 12)}`,
    name: item.title || "이름 미상",
    nameEn: "네이버 검색 결과",
    category: item.category || "분류 미상",
    address: item.roadAddress || item.address || "주소 정보 없음",
    addressDetail: item._matchedVariant && item._matchedVariant !== item.title ? `조회어: “${item._matchedVariant}”` : "",
    lat: coords?.lat, lng: coords?.lng,
    dist,
    show: {
      title: "전시 정보 보강 필요",
      titleEn: "Verify with venue",
      period: "확인 필요",
      status: "확인 필요",
      curator: "—",
      artists: ["공식 홈페이지 확인"],
    },
    fee: "확인 필요",
    hours: "확인 필요",
    phone: item.telephone || "—",
    links: {
      naver: `https://map.naver.com/p/search/${encodeURIComponent((item.title || "").replace(/<[^>]+>/g,""))}`,
      site: item.link || undefined,
    },
    tags: ["네이버 검색"],
    confidence: "medium",
    _apiSource: "local",
  };
}

function blogToVenue(item, idx) {
  return {
    id: `blog-${idx}`,
    name: item.title || "블로그 결과",
    nameEn: "블로그 폴백",
    category: "분류 미상",
    address: "블로그 후기에서 확인",
    addressDetail: (item.description || "").slice(0, 90),
    dist: null,
    show: {
      title: (item.description || "").slice(0, 70) || "정보 보강 필요",
      titleEn: "From blog post",
      period: "확인 필요",
      status: "확인 필요",
      curator: item.bloggerName || "블로거",
      artists: ["블로그 내용 참고"],
    },
    fee: "확인 필요",
    hours: "확인 필요",
    phone: "—",
    links: {
      naver: `https://map.naver.com/p/search/${encodeURIComponent(item.title || "")}`,
      review: item.link,
    },
    tags: ["블로그 폴백"],
    confidence: "low",
    note: "네이버 지역검색에서 명확한 매칭이 없어 블로그 검색에서 폴백된 결과입니다.",
    _apiSource: "blog",
  };
}

/* ---------------------------------------------------------------- */
/* APP                                                              */
/* ---------------------------------------------------------------- */
function App() {
  const [t, setTweak] = useTweaks({
    accent: "#0f5044",
    density: "regular",       // compact | regular
    showMap: true,
    showConfidence: true,
    sortBy: "distance",       // distance | category
  });

  const [query, setQuery] = useState("");
  const [origin, setOrigin] = useState({ label: "성수동 · 현재 위치 추정", lat: 37.5447, lng: 127.0557 });
  const [radius, setRadius] = useState(10);
  const [selectedId, setSelectedId] = useState(null);
  const [filterCat, setFilterCat] = useState("전체");
  const [feeFilter, setFeeFilter] = useState("all");        // all | free | under10k | paid
  const [periodFilter, setPeriodFilter] = useState("active"); // active | soon | all
  const [gpsState, setGpsState] = useState("idle");           // idle | loading | denied | ok

  // GPS 설정
  const useGPS = () => {
    if (!navigator.geolocation) { setGpsState("denied"); return; }
    setGpsState("loading");
    navigator.geolocation.getCurrentPosition(
      pos => {
        setOrigin({
          label: `현재 위치 (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setGpsState("ok");
      },
      () => setGpsState("denied"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  };

  // ---- Live Naver API integration ----
  const [apiVenues, setApiVenues] = useState([]);
  const [apiState, setApiState] = useState("idle"); // idle | loading | ok | empty | error | unavailable
  const [apiMeta, setApiMeta] = useState(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setApiVenues([]); setApiState("idle"); setApiMeta(null);
      return;
    }
    const ctrl = new AbortController();
    setApiState("loading");
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/naver-search?query=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!r.ok) {
          if (r.status === 404) { setApiState("unavailable"); return; }
          throw new Error("API " + r.status);
        }
        const data = await r.json();
        const localVs = (data.items || []).map((it, i) => itemToVenue(it, i, origin));
        const blogVs  = (data.blog  || []).map((it, i) => blogToVenue(it, i));
        const all = [...localVs, ...blogVs];
        setApiVenues(all);
        setApiMeta(data.meta || null);
        setApiState(all.length ? "ok" : "empty");
      } catch (e) {
        if (e.name === "AbortError") return;
        setApiVenues([]);
        setApiState("unavailable");
      }
    }, 400);
    return () => { ctrl.abort(); clearTimeout(timer); };
  }, [query, origin.lat, origin.lng]);

  // ESC closes modal
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e) => { if (e.key === "Escape") setSelectedId(null); };
    window.addEventListener("keydown", onKey);
    // lock body scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [selectedId]);

  // 동적 거리 계산: origin이 바뀌면 모든 거리 재계산
  const venuesWithDist = useMemo(() =>
    VENUES.map(v => (v.lat != null && v.lng != null)
      ? { ...v, dist: haversineKm(origin.lat, origin.lng, v.lat, v.lng) }
      : v
    ),
  [origin.lat, origin.lng]);

  const filtered = useMemo(() => {
    // Mock VENUES — 조건: 필수필드 + 반경 + 카테고리 + 입장료 + 기간 + 검색어
    let mockArr = venuesWithDist
      .filter(v => isShowable(v))
      .filter(v => v.dist == null || v.dist <= radius)
      .filter(v => passesPeriodFilter(v, periodFilter))
      .filter(v => passesFeeFilter(v, feeFilter));
    if (filterCat !== "전체") mockArr = mockArr.filter(v => v.category === filterCat);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      mockArr = mockArr.filter(v =>
        v.name.toLowerCase().includes(q) ||
        v.nameEn.toLowerCase().includes(q) ||
        v.show.title.toLowerCase().includes(q) ||
        v.address.toLowerCase().includes(q)
      );
    }

    // API venues — 가벼운 조건 (상호명 + 주소만 필요, 전시명 없어도 허용)
    let apiArr = [];
    if (query.trim().length >= 2 && apiVenues.length > 0) {
      const existingNames = new Set(mockArr.map(v => v.name.toLowerCase().trim()));
      apiArr = apiVenues
        .filter(v => v.name && v.address)   // 전시명 없어도 통과
        .filter(v => {
          // 기간 필터: endDate 없으면 (정보 미상) 진행 중으로 간주
          if (periodFilter === "all") return true;
          if (!v.show?.endDate) return periodFilter === "active" || periodFilter === "soon" ? false : true;
          return passesPeriodFilter(v, periodFilter);
        })
        .filter(v => passesFeeFilter(v, feeFilter))
        .filter(v => !existingNames.has(v.name.toLowerCase().trim()));
      if (filterCat !== "전체") {
        apiArr = apiArr.filter(v => v.category === filterCat || v._apiSource === "blog");
      }
    }

    let arr = [...mockArr, ...apiArr];
    if (t.sortBy === "distance") {
      arr = [...arr].sort((a,b) => (a.dist ?? 9999) - (b.dist ?? 9999));
    } else if (t.sortBy === "ending") {
      arr = [...arr].sort((a,b) => (daysLeft(a) ?? 99999) - (daysLeft(b) ?? 99999));
    } else {
      arr = [...arr].sort((a,b) => a.category.localeCompare(b.category) || (a.dist ?? 9999) - (b.dist ?? 9999));
    }
    return arr;
  }, [query, radius, filterCat, t.sortBy, apiVenues, venuesWithDist, feeFilter, periodFilter]);

  // auto-select first if current selection filtered out
  useEffect(() => {
    if (selectedId && !filtered.find(v => v.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filtered, selectedId]);

  const selected = [...venuesWithDist, ...apiVenues].find(v => v.id === selectedId);

  const cats = ["전체", "갤러리", "사립미술관", "국립미술관", "비영리미술관", "미디어아트"];

  return (
    <div className="page" style={{ "--accent": t.accent }} data-density={t.density}>
      <Header origin={origin} setOrigin={setOrigin} />

      <main className="main" data-screen-label="01 Search & List">
        <SearchBar query={query} setQuery={setQuery} onGPS={useGPS} gpsState={gpsState} />

        <div className="filter-row">
          <RadiusPicker radius={radius} setRadius={setRadius} />
          <SortPicker sortBy={t.sortBy} setSort={(v) => setTweak("sortBy", v)} />
        </div>

        <CategoryChips cats={cats} active={filterCat} setActive={setFilterCat} />

        <div className="filter-row-2">
          <FilterGroup label="입장료" value={feeFilter} setValue={setFeeFilter} options={[
            { v: "all",      l: "전체" },
            { v: "free",     l: "무료" },
            { v: "under10k", l: "1만원 이하" },
            { v: "paid",     l: "유료" },
          ]} />
          <FilterGroup label="기간" value={periodFilter} setValue={setPeriodFilter} options={[
            { v: "active", l: "진행 중" },
            { v: "soon",   l: "곷 종료(2주)" },
            { v: "all",    l: "종료 포함" },
          ]} />
        </div>

        <ApiBanner state={apiState} meta={apiMeta} query={query} />

        <div className="result-bar">
          <span className="result-count">
            <span className="num">{filtered.length}</span>곳 발견
          </span>
          <span className="result-meta">{origin.label} · {radius}km 이내</span>
        </div>

        <ul className="venue-list">
          {filtered.map((v, i) => (
            <VenueCard
              key={v.id}
              v={v}
              idx={i + 1}
              active={v.id === selectedId}
              onClick={() => setSelectedId(v.id)}
              showConfidence={t.showConfidence}
            />
          ))}
          {filtered.length === 0 && (
            <li className="empty">
              <div className="empty-mark">◯</div>
              <p>이 반경에서 결과를 찾지 못했어요</p>
              <p className="empty-sub">반경을 늘리거나 검색어를 줄여보세요</p>
            </li>
          )}
        </ul>

        <FooterNote />
      </main>

      {selected && (
        <Modal onClose={() => setSelectedId(null)}>
          <DetailPanel v={selected} showMap={t.showMap} onClose={() => setSelectedId(null)} />
        </Modal>
      )}

      <TweaksPanel title="Tweaks">
        <TweakSection title="Theme">
          <TweakColor
            label="액센트 컬러"
            value={t.accent}
            onChange={(v) => setTweak("accent", v)}
            options={["#0f5044", "#b03a1a", "#0a0908", "#2c3e75"]}
          />
          <TweakRadio
            label="카드 밀도"
            value={t.density}
            onChange={(v) => setTweak("density", v)}
            options={[{ value: "regular", label: "Regular" }, { value: "compact", label: "Compact" }]}
          />
        </TweakSection>
        <TweakSection title="Display">
          <TweakToggle
            label="지도 미리보기"
            value={t.showMap}
            onChange={(v) => setTweak("showMap", v)}
          />
          <TweakToggle
            label="검색 신뢰도 표시"
            value={t.showConfidence}
            onChange={(v) => setTweak("showConfidence", v)}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* HEADER                                                           */
/* ---------------------------------------------------------------- */
function Header({ origin }) {
  return (
    <header className="header">
      <div className="brand">
        <div className="brand-mark">
          <LogoE5 size={48}/>
        </div>
        <div>
          <h1 className="brand-name">MYEXHIT</h1>
          <p className="brand-sub">전시·미술관 권역 탐색</p>
        </div>
      </div>
      <div className="header-meta">
        <span className="meta-dot" />
        <span className="meta-text">{origin.label}</span>
      </div>
    </header>
  );
}

/* ---------------------------------------------------------------- */
/* LOGO E5 — 본 사이트의 정식 보호 멈                                 */
/* color grid 4×4 · blur σ14 · paper wash 60% · ink pin           */
/* ---------------------------------------------------------------- */
const LOGO_GRID = [
  ["#00bcd9","#fde100","#2451d0","#d12bbc"],
  ["#ed7a13","#732a96","#1d9c4f","#ffffff"],
  ["#a8052e","#abe628","#1ec0c0","#322385"],
  ["#d8a017","#322f30","#ee7fb3","#de4a14"],
];
function LogoE5({ size = 48 }){
  const cx = size/2, cy = size/2, k = size/160, cs = size/4;
  const uid = "e5-" + size;
  const blur = (14 * size/160).toFixed(2);
  const cells = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    cells.push(<rect key={`${r}-${c}`} x={c*cs} y={r*cs} width={cs} height={cs} fill={LOGO_GRID[r][c]}/>);
  }
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-label="MYEXHIT">
      <defs>
        <clipPath id={`c-${uid}`}>
          <circle cx={cx} cy={cy} r={size/2 - 1}/>
        </clipPath>
        <filter id={`b-${uid}`} x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation={blur}/>
        </filter>
      </defs>
      <g clipPath={`url(#c-${uid})`}>
        <g filter={`url(#b-${uid})`}>{cells}</g>
        <rect width={size} height={size} fill="#fbf8f1" opacity="0.60"/>
      </g>
      <circle cx={cx} cy={cy} r={size/2 - 1}
              fill="none" stroke="#0a0907" strokeWidth={Math.max(1.2, size*0.012)}/>
      <ellipse cx={cx} cy={cy + 22*k} rx={10*k} ry={2.6*k} fill="#0a0907" opacity="0.22"/>
      <path d={`M${cx},${cy-22*k} C${cx+13*k},${cy-22*k} ${cx+13*k},${cy-2*k} ${cx},${cy+18*k} C${cx-13*k},${cy-2*k} ${cx-13*k},${cy-22*k} ${cx},${cy-22*k} Z`}
            fill="#0a0907" stroke="#fbf8f1"
            strokeWidth={Math.max(1.4, 2.4*k)} strokeLinejoin="round"/>
      <circle cx={cx} cy={cy - 9*k} r={5*k} fill="#fbf8f1"/>
    </svg>
  );
}

/* ---------------------------------------------------------------- */
/* SEARCH                                                           */
/* ---------------------------------------------------------------- */
function SearchBar({ query, setQuery, onGPS, gpsState }) {
  return (
    <div className="search">
      <span className="search-icon" aria-hidden>⌕</span>
      <input
        className="search-input"
        placeholder="전시명, 갤러리, 작가, 지역을 검색"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button className="search-loc" title="현재 위치 사용" onClick={onGPS}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
          <circle cx="8" cy="8" r="2.2" fill="currentColor"/>
          <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M8 .8 L8 3 M8 13 L8 15.2 M.8 8 L3 8 M13 8 L15.2 8" stroke="currentColor" strokeWidth="1.2"/>
        </svg>
        {gpsState === "loading" ? "위치 찾는 중…" : gpsState === "denied" ? "권한 없음" : "현재 위치"}
      </button>
    </div>
  );
}

function FilterGroup({ label, value, setValue, options }) {
  return (
    <div className="fg">
      <span className="fg-label">{label}</span>
      {options.map((o, i) => (
        <React.Fragment key={o.v}>
          {i > 0 && <span className="fg-sep">·</span>}
          <button
            className={"fg-btn " + (value === o.v ? "is-active" : "")}
            onClick={() => setValue(o.v)}
          >{o.l}</button>
        </React.Fragment>
      ))}
    </div>
  );
}

function RadiusPicker({ radius, setRadius }) {
  return (
    <div className="radius">
      <span className="radius-label">반경</span>
      <div className="radius-pills">
        {[10, 20, 30].map(km => (
          <button
            key={km}
            className={"pill " + (radius === km ? "is-active" : "")}
            onClick={() => setRadius(km)}
          >{km}<span className="pill-unit">km</span></button>
        ))}
      </div>
    </div>
  );
}

function SortPicker({ sortBy, setSort }) {
  return (
    <div className="sort">
      <span className="sort-label">정렬</span>
      <button
        className={"sort-btn " + (sortBy === "distance" ? "is-active" : "")}
        onClick={() => setSort("distance")}
      >거리순</button>
      <span className="sort-sep">·</span>
      <button
        className={"sort-btn " + (sortBy === "ending" ? "is-active" : "")}
        onClick={() => setSort("ending")}
      >종료임박</button>
      <span className="sort-sep">·</span>
      <button
        className={"sort-btn " + (sortBy === "category" ? "is-active" : "")}
        onClick={() => setSort("category")}
      >종류순</button>
    </div>
  );
}

function CategoryChips({ cats, active, setActive }) {
  return (
    <div className="chips">
      {cats.map(c => (
        <button
          key={c}
          className={"chip " + (active === c ? "is-active" : "")}
          onClick={() => setActive(c)}
        >{c}</button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* API BANNER — shows search status (loading / fallback / failure)  */
/* ---------------------------------------------------------------- */
function ApiBanner({ state, meta, query }) {
  if (state === "idle") return null;
  if (state === "loading") {
    return (
      <div className="api-banner is-loading">
        <span className="api-dot" />
        <span>네이버 검색 중… <strong>{query}</strong></span>
      </div>
    );
  }
  if (state === "ok") {
    const fallbackUsed = meta?.blogFallbackUsed;
    return (
      <div className={"api-banner " + (fallbackUsed ? "is-warn" : "is-ok")}>
        <span className="api-dot" />
        {fallbackUsed ? (
          <span>지역검색에 없어서 <strong>블로그 후기</strong>로 폴백했어요 ({meta.localCount} + {meta.blogCount}건)</span>
        ) : (
          <span>네이버 지역검색에서 <strong>{meta?.localCount ?? 0}</strong>건 매칭</span>
        )}
      </div>
    );
  }
  if (state === "empty") {
    return (
      <div className="api-banner is-warn">
        <span className="api-dot" />
        <span>네이버에서 결과를 찾지 못했어요. 목업 데이터만 표시됩니다.</span>
      </div>
    );
  }
  if (state === "unavailable") {
    return (
      <div className="api-banner is-info">
        <span className="api-dot" />
        <span>네이버 API 미연결 환경 — 데모 데이터로 표시 중</span>
      </div>
    );
  }
  return null;
}

/* ---------------------------------------------------------------- */
/* VENUE CARD                                                       */
/* ---------------------------------------------------------------- */
function VenueCard({ v, idx, active, onClick, showConfidence }) {
  const zone = ZONE(v.dist);
  const isApi = !!v._apiSource;
  return (
    <li
      className={"venue " + (active ? "is-active " : "") + (zone ? ("z" + zone) : "z-na") + (isApi ? " is-api" : "")}
      onClick={onClick}
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
    >
      <div className="venue-idx">
        <span className="idx-num">{String(idx).padStart(2, "0")}</span>
        <span className="idx-icon">{CATEGORY_ICON(v.category)}</span>
      </div>
      <div className="venue-body">
        <div className="venue-head">
          <h3 className="venue-name">
            {v.name}
            {isApi && <span className={"src-badge src-" + v._apiSource}>{v._apiSource === "blog" ? "블로그" : "네이버"}</span>}
          </h3>
          <span className="venue-dist">
            {v.dist == null ? <small style={{fontStyle:"normal",fontFamily:"var(--font-mono)"}}>—</small> : <>{v.dist}<small>km</small></>}
          </span>
        </div>
        <div className="venue-sub">
          <span className="venue-cat">{v.category}</span>
          <span className="dot" />
          <span className="venue-en">{v.nameEn}</span>
        </div>
        <p className="venue-show">
          {v.show?.title && !v.show.title.includes("정보 보강") ? (
            <>「{v.show.title}」 <span className="venue-period">{v.show.period}</span>
              {(() => { const dl = daysLeft(v); return (dl != null && dl >= 0 && dl <= 30) ? <span className={"d-day " + (dl <= 7 ? "d-day-urgent" : "")}>D-{dl}</span> : null; })()}
            </>
          ) : (
            <span className="venue-unverified">⚠ 전시 정보 미확인 — 네이버 지도에서 확인</span>
          )}
        </p>
        <div className="venue-foot">
          <span className="venue-addr">{v.address}</span>
          {showConfidence && v.confidence === "low" && (
            <span className="conf conf-low" title={v.note || ""}>! 정보 보강 필요</span>
          )}
        </div>
      </div>
      <div className="venue-zone-tag">{ZONE_LABEL(v.dist)}</div>
    </li>
  );
}

/* ---------------------------------------------------------------- */
/* DETAIL PANEL — 10 fields max                                     */
/* ---------------------------------------------------------------- */
function DetailPanel({ v, showMap, onClose }) {
  return (
    <div className="detail" key={v.id}>
      <div className="detail-head">
        <div className="detail-head-top">
          <div className="detail-tag">{v.category} · {ZONE_LABEL(v.dist)}</div>
          {onClose && (
            <button className="detail-close" onClick={onClose} aria-label="닫기">
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
                <path d="M3 3 L13 13 M13 3 L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
        <h2 className="detail-name">{v.name}</h2>
        <p className="detail-name-en">{v.nameEn}</p>
        <div className="detail-status">
          <span className="status-dot" />
          {v.show.status} · 직선거리 {v.dist}km
        </div>
      </div>

      {showMap && <MapPreview v={v} />}

      <div className="detail-show">
        <div className="show-label">현재 전시</div>
        <h3 className="show-title">「{v.show.title}」</h3>
        <p className="show-title-en">{v.show.titleEn}</p>
        <p className="show-period">{v.show.period}</p>
      </div>

      <dl className="detail-grid">
        <Field label="주소" value={v.address} sub={v.addressDetail} />
        <Field label="입장료" value={v.fee} highlight={v.fee === "무료"} />
        <Field label="운영시간" value={v.hours} />
        <Field label="작가" value={v.show.artists.join(", ")} />
        <Field label="기획" value={v.show.curator} />
        <Field label="연락처" value={v.phone} />
      </dl>

      {v.tags && v.tags.length > 0 && (
        <div className="detail-tags">
          {v.tags.map(t => <span key={t} className="d-tag">#{t}</span>)}
        </div>
      )}

      <div className="detail-links">
        {v.links.naver && (
          <a className="d-link primary" href={v.links.naver} target="_blank" rel="noopener">
            네이버 지도로 길찾기 <span aria-hidden>↗</span>
          </a>
        )}
        {v.links.site && (
          <a className="d-link" href={v.links.site} target="_blank" rel="noopener">
            공식 홈페이지 <span aria-hidden>↗</span>
          </a>
        )}
        {v.links.review && (
          <a className="d-link" href={v.links.review} target="_blank" rel="noopener">
            관람 후기 <span aria-hidden>↗</span>
          </a>
        )}
      </div>

      {v.confidence === "low" && (
        <div className="detail-warn">
          <div className="warn-mark">!</div>
          <div>
            <strong>정보 보강 필요</strong>
            <p>{v.note || "네이버 지역검색에 인덱싱되지 않은 공간입니다. 운영시간·전시 정보는 공식 채널에서 다시 확인해주세요."}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, sub, highlight }) {
  return (
    <div className="field">
      <dt>{label}</dt>
      <dd className={highlight ? "is-highlight" : ""}>
        {value}
        {sub && <span className="field-sub">{sub}</span>}
      </dd>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* MODAL                                                            */
/* ---------------------------------------------------------------- */
function Modal({ children, onClose }) {
  const ref = useRef(null);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => { if (e.target === ref.current) onClose(); }}
      ref={ref}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-card" onMouseDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* MAP PREVIEW — stylized placeholder                                */
/* ---------------------------------------------------------------- */
function MapPreview({ v }) {
  // Simple svg "map" with origin & venue dot
  return (
    <div className="map">
      <svg viewBox="0 0 320 120" className="map-svg" aria-hidden>
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="320" height="120" fill="url(#grid)"/>
        {/* roads */}
        <path d="M0 80 Q 80 60, 160 70 T 320 50" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1.2" fill="none"/>
        <path d="M40 0 L 60 120" stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" fill="none"/>
        <path d="M220 0 L 200 120" stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" fill="none"/>
        {/* origin */}
        <circle cx="90" cy="80" r="4" fill="currentColor"/>
        <circle cx="90" cy="80" r="10" fill="none" stroke="currentColor" strokeOpacity="0.3"/>
        <text x="90" y="100" fontSize="9" textAnchor="middle" fill="currentColor" opacity="0.6">기준점</text>
        {/* venue */}
        <circle cx="220" cy="50" r="5" fill="var(--accent)"/>
        <circle cx="220" cy="50" r="10" fill="none" stroke="var(--accent)" strokeWidth="1.4"/>
        <text x="220" y="36" fontSize="9" textAnchor="middle" fill="var(--accent)" fontWeight="600">{v.name}</text>
        {/* connector */}
        <line x1="90" y1="80" x2="220" y2="50" stroke="var(--accent)" strokeWidth="1" strokeDasharray="3 3"/>
        <text x="155" y="60" fontSize="8.5" textAnchor="middle" fill="var(--accent)" opacity="0.85">직선 {v.dist}km</text>
      </svg>
      <a className="map-cta" href={v.links.naver} target="_blank" rel="noopener">네이버 지도에서 열기 ↗</a>
    </div>
  );
}

function FooterNote() {
  return (
    <p className="footnote">
      거리는 하버사인(직선) 기준이며 실제 이동거리와 다를 수 있습니다.<br/>
      독립 갤러리 등 일부 공간은 네이버 지역검색에 인덱싱되지 않을 수 있어요 — 후기/블로그 검색으로 자동 보강됩니다.
    </p>
  );
}

/* ---------------------------------------------------------------- */
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
