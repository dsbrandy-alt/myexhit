/* global React, ReactDOM, TweaksPanel, useTweaks, TweakSection, TweakSlider, TweakRadio, TweakToggle, TweakColor */
const { useState, useMemo, useEffect, useRef } = React;

/* ---------------------------------------------------------------- */
/* API HELPERS — Naver 응답 → venue 객체 변환                       */
/* ---------------------------------------------------------------- */
function mapCategory(cat) {
  if (!cat) return '갤러리';
  if (/국립/.test(cat) && /미술관/.test(cat)) return '국립미술관';
  if (/미술관/.test(cat)) return '사립미술관';
  if (/박물관/.test(cat)) return '박물관';
  if (/센터|재단|미디어/.test(cat)) return '비영리미술관';
  if (/갤러리/.test(cat)) return '갤러리';
  return '갤러리';
}

// Stage 5: 신뢰도 점수 → 표시 tier
function confidenceTier(score) {
  if (!score || score <= 0) return 'none';
  if (score >= 0.75) return 'high';
  if (score >= 0.45) return 'medium';
  return 'low';
}

function parseApiItem(it, idx, origin) {
  const coords = parseCoords(it.mapx, it.mapy);
  const dist   = coords ? haversineKm(origin.lat, origin.lng, coords.lat, coords.lng) : null;
  const e      = it.enriched || {};
  const now    = new Date();
  const ended  = e.endDate ? new Date(e.endDate) < now : false;
  const titleConf = e.titleConfidence || 0;
  const tier      = confidenceTier(titleConf);

  return {
    id:          `nv-${idx}-${(it.title || '').slice(0,8).replace(/\s/g,'')}`,
    name:        it.title        || '이름 없음',
    nameEn:      it.category     || '',
    category:    mapCategory(it.category),
    address:     it.address      || '',
    addressDetail: '',
    lat:         coords?.lat,
    lng:         coords?.lng,
    dist,
    show: {
      title:   e.showTitle  || '',
      titleEn: '',
      period:  e.period     || '',
      endDate: e.endDate    || null,
      status:  ended ? '종료' : (e.endDate ? '전시 중' : (e.showTitle ? '전시 중' : '확인 필요')),
      curator: e.curator    || '',
      artists: e.artist ? [e.artist] : [],
      // Stage 5: 신뢰도 정보
      confidence:      titleConf,
      confidenceTier:  tier,    // high | medium | low | none
    },
    fee:   e.fee   || '확인 필요',
    hours: e.hours || '확인 필요',
    phone: it.telephone || '—',
    links: {
      naver:   `https://map.naver.com/p/search/${encodeURIComponent(it.title || '')}`,
      site:    it.link || undefined,
      ...(e.blogLinks || []).reduce((acc, b, i) => { acc[`blog${i+1}`] = b.link; return acc; }, {}),
    },
    tags:       [it.category || '검색결과'].filter(Boolean),
    confidence: tier === 'high' ? 'high' : (tier === 'medium' ? 'medium' : 'low'),
    _apiSource: 'local',
    _blogLinks: e.blogLinks || [],
    _venueTier: it._tier || null, // A | B | null
  };
}


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

// 좌표 → 한국 행정구역 레이블 변환
// 예) 서울특별시 은평구 역촌동 → "서울 역촌동"
//     경기도 고양시 덕양구 행신동 → "고양시 행신동"
//     경기도 수원시 영통구 매탄3동 → "수원시 매탄동"
async function reverseGeocodeKR(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ko`;
    const r = await fetch(url, { headers: { 'User-Agent': 'MYEXHIT/1.0' } });
    if (!r.ok) throw new Error('geocode fail');
    const data = await r.json();
    const a = data.address || {};

    // Nominatim: 한국에서는 city 필드에 특별시/광역시/시·군이 혼재
    const city = (a.city || a.town || a.county || '').trim();

    let part1 = '';
    if (/특별시|광역시|특별자치시/.test(city)) {
      // 서울특별시 → 서울, 부산광역시 → 부산
      part1 = city.replace(/특별시|광역시|특별자치시/, '').trim();
    } else {
      // 파주시, 고양시, 수원시 등 일반 시/군 그대로
      part1 = city;
    }

    // 동/읍/면 레벨: suburb 우선, 숫자만 제거 (응암1동 → 응암동, 매탄3동 → 매탄동)
    const dong = (a.suburb || a.neighbourhood || a.quarter || '').trim();
    const part2 = dong.replace(/([가-힣]+)\d+(동|읍|면)/, '$1$2');

    const label = [part1, part2].filter(Boolean).join(' ');
    return label || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

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
      async pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        // 좌표 → 행정구역 역지오코딩 (실패 시 좌표 폴백)
        const label = await reverseGeocodeKR(lat, lng);
        setOrigin({ label, lat, lng });
        setGpsState("ok");
      },
      () => setGpsState("denied"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  };

  // ---- Naver API: discover(초기화면) + query(검색) ----
  const [apiVenues, setApiVenues] = useState([]);
  const [apiState, setApiState]   = useState("idle");
  const [apiMeta, setApiMeta]     = useState(null);

  useEffect(() => {
    const q = query.trim();
    const ctrl = new AbortController();
    setApiState("loading");

    // discover 모드: 쿼리 없을 때 주변 전시 자동 탐색
    // origin.label에서 시/군 추출하여 discover 쿼리에 지역 반영
    const regionPart = origin.label.match(/([가-힣]+시|[가-힣]+군)/)?.[1] || '';
    const url = q.length >= 2
      ? `/api/naver-search?query=${encodeURIComponent(q)}`
      : `/api/naver-search?discover=1${regionPart ? '&region=' + encodeURIComponent(regionPart) : ''}`;

    const delay = q.length >= 2 ? 400 : 0;

    const timer = setTimeout(async () => {
      try {
        const r = await fetch(url, { signal: ctrl.signal });
        if (!r.ok) {
          if (r.status === 404) { setApiState("unavailable"); return; }
          throw new Error("API " + r.status);
        }
        const data = await r.json();
        const venues = (data.items || []).map((it, i) => parseApiItem(it, i, origin));
        setApiVenues(venues);
        setApiMeta(data.meta || null);
        setApiState(venues.length ? "ok" : "empty");
      } catch (e) {
        if (e.name === "AbortError") return;
        setApiVenues([]);
        setApiState("unavailable");
      }
    }, delay);
    return () => { ctrl.abort(); clearTimeout(timer); };
  }, [query, origin.lat, origin.lng]); // mount 시 자동 실행

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

  const filtered = useMemo(() => {
    // API venues only — 목업 없음
    let arr = apiVenues
      .filter(v => v.name && v.address)
      .filter(v => v.dist == null || v.dist <= radius)
      .filter(v => passesPeriodFilter(v, periodFilter))
      .filter(v => passesFeeFilter(v, feeFilter));

    if (filterCat !== "전체") arr = arr.filter(v => v.category === filterCat);

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      arr = arr.filter(v =>
        v.name.toLowerCase().includes(q) ||
        (v.show?.title || "").toLowerCase().includes(q) ||
        (v.address || "").toLowerCase().includes(q)
      );
    }

    if (t.sortBy === "distance") {
      arr = [...arr].sort((a,b) => (a.dist ?? 9999) - (b.dist ?? 9999));
    } else if (t.sortBy === "ending") {
      arr = [...arr].sort((a,b) => (daysLeft(a) ?? 99999) - (daysLeft(b) ?? 99999));
    } else {
      arr = [...arr].sort((a,b) => a.category.localeCompare(b.category) || (a.dist ?? 9999) - (b.dist ?? 9999));
    }
    return arr;
  }, [query, radius, filterCat, t.sortBy, apiVenues, feeFilter, periodFilter]);

  // auto-select first if current selection filtered out
  useEffect(() => {
    if (selectedId && !filtered.find(v => v.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filtered, selectedId]);

  const selected = apiVenues.find(v => v.id === selectedId);

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
          <li className="footnote-item"><FooterNote /></li>
        </ul>
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
        >{c === "전체" ? c : <>{CATEGORY_ICON(c)} {c}</>}</button>
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
        <span className="idx-icon" data-tip={v.category}>{CATEGORY_ICON(v.category)}</span>
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
        {/* Phase F: 후기 링크 — venue-dist 바로 아래, 우측 정렬 */}
        {(v.show?.confidenceTier === 'none' || v.show?.confidenceTier === 'low') && v._blogLinks?.length > 0 && (
          <div className="venue-reviews">
            <span className="reviews-label">후기</span>
            {v._blogLinks.slice(0, 3).map((b, i) => (
              <a key={i} href={b.link} target="_blank" rel="noopener" className="review-link"
                 title={b.title} onClick={(e) => e.stopPropagation()}>
                {['①','②','③'][i]}
              </a>
            ))}
          </div>
        )}
        <div className="venue-sub">
          <span className="venue-cat">{v.category}</span>
          <span className="dot" />
          <span className="venue-en">{v.nameEn}</span>
        </div>
        <p className="venue-show">
          {(() => {
            const tier = v.show?.confidenceTier || 'none';
            if (tier === 'high' && v.show?.title) {
              return (
                <>「{v.show.title}」 <span className="venue-period">{v.show.period}</span>
                  {(() => { const dl = daysLeft(v); return (dl != null && dl >= 0 && dl <= 30) ? <span className={"d-day " + (dl <= 7 ? "d-day-urgent" : "")}>D-{dl}</span> : null; })()}
                </>
              );
            }
            if (tier === 'medium' && v.show?.title) {
              return (
                <>「{v.show.title}」 <span className="conf-warn" title="신뢰도 보통 — 네이버 지도에서 재확인 권장">⚠</span> <span className="venue-period">{v.show.period}</span></>
              );
            }
            if (tier === 'low' && v.show?.title) {
              return <span className="conf-low">전시 정보 불확실 — 네이버 지도에서 확인</span>;
            }
            return <span className="venue-unverified">⚠ 전시 정보 없음 — 네이버 지도에서 확인</span>;
          })()}
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
          {v.links.naver && (
            <a className="status-map-link" href={v.links.naver} target="_blank" rel="noopener">
              네이버 지도에서 열기 ↗
            </a>
          )}
        </div>
      </div>

      <dl className="detail-grid">
        <FieldWithReviews label="전시"
               tier={v.show?.confidenceTier}
               title={v.show?.title}
               period={v.show?.period} />
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
        {/* Phase F: 블로그 후기 링크 (상세 패널 최하단, 공식 홈페이지 아래) */}
        {v._blogLinks?.length > 0 && v._blogLinks.slice(0, 3).map((b, i) => (
          <a key={i} className="d-link d-link-blog" href={b.link} target="_blank" rel="noopener">
            <span className="d-link-blog-content">
              <span className="d-link-review-num">{['①','②','③'][i]}</span>
              <span className="d-link-blog-title">{b.title}</span>
            </span>
            <span className="d-link-arrow" aria-hidden>↗</span>
          </a>
        ))}
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

// 전시 필드 — tier별 제목 표시 (블로그 링크는 detail-links 섹션으로 이동)
function FieldWithReviews({ label, tier, title, period }) {
  const noTitle = !title;
  let mainText;
  if (noTitle)              mainText = '정보 없음';
  else if (tier === 'high') mainText = `「${title}」`;
  else if (tier === 'medium') mainText = `「${title}」 ⚠`;
  else                      mainText = `「${title}」 (불확실)`;

  return (
    <div className="field">
      <dt>{label}</dt>
      <dd>
        {mainText}
        {period && <span className="field-sub">{period}</span>}
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
