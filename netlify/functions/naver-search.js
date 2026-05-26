// MYEXHIT — Naver Search Proxy v2
// 동작:
//   [discover 모드] 초기화면: 주변 전시·미술관·갤러리 자동 탐색
//   [query 모드]   특정 장소 검색: 5가지 변형 쿼리 병렬 실행
//   [공통]         블로그 검색을 병렬 실행해 입장료·운영시간·전시명·작가 추출

const stripTags = s => (s || '').replace(/<[^>]+>/g, '').trim();

async function fetchNaver(endpoint, query, display, id, secret) {
  const url = `https://openapi.naver.com/v1/search/${endpoint}.json`
    + `?query=${encodeURIComponent(query)}&display=${display}&sort=random`;
  try {
    const r = await fetch(url, {
      headers: { 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret },
    });
    if (!r.ok) return { items: [], _err: r.status };
    return r.json();
  } catch (e) {
    return { items: [], _err: e.message };
  }
}

/* ── 블로그 텍스트 파서 ─────────────────────── */
function parseFee(text) {
  if (!text) return null;
  if (/무료/.test(text)) return '무료';
  // "성인 22,000원" / "일반 8,000원" / "입장료 10000원"
  for (const re of [
    /성인\s*([\d,]+)\s*원/,
    /일반\s*([\d,]+)\s*원/,
    /입장료\s*([\d,]+)\s*원/,
    /어른\s*([\d,]+)\s*원/,
  ]) {
    const m = text.match(re);
    if (m) return `성인 ${m[1]}원`;
  }
  return null;
}

function parseHours(text) {
  if (!text) return null;
  // "10:00 - 18:00" / "10시 ~ 18시"
  let m = text.match(/(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})/);
  if (m) return `${m[1]} – ${m[2]}`;
  m = text.match(/오전\s*(\d{1,2})시.*?오후\s*(\d{1,2})시/);
  if (m) return `0${m[1]}:00 – ${parseInt(m[2])+12}:00`;
  m = text.match(/(\d{1,2})시\s*[-~]\s*(\d{1,2})시/);
  if (m) return `${m[1].padStart(2,'0')}:00 – ${m[2].padStart(2,'0')}:00`;
  return null;
}

function parseShowTitle(text) {
  if (!text) return null;
  // 「...」 ≪...≫ 《...》 ‹...›
  for (const re of [
    /[「≪《〈‹](.*?)[」≫》〉›]/,
    /展名[：:]\s*(.*?)(?=[。.,\n]|$)/,
    /전시[명\s：:]+['"]?([\w가-힣\s]+?)['"]?(?=[.;,]|$)/,
  ]) {
    const m = text.match(re);
    if (m && m[1].length >= 2 && m[1].length <= 60) return m[1].trim();
  }
  return null;
}

function parsePeriod(text) {
  if (!text) return null;
  // "2025.05.01 ~ 2026.07.31" / "2025-05-01 ~ 2026-07-31"
  const m = text.match(
    /(\d{4}[.\-]\d{1,2}[.\-]\d{1,2})\s*[-~]\s*(\d{4}[.\-]\d{1,2}[.\-]\d{1,2})/
  );
  if (!m) return null;
  const endStr = m[2].replace(/\./g, '-'); // YYYY-MM-DD
  return { period: `${m[1]} — ${m[2]}`, endDate: endStr };
}

function parseArtist(text) {
  if (!text) return null;
  for (const re of [
    /작가[：:\s]+([\w가-힣\s,]+?)(?=[.;,\n]|$)/,
    /아티스트[：:\s]+([\w가-힣\s,]+?)(?=[.;,\n]|$)/,
    /참여\s*작가[：:\s]+([\w가-힣\s,]+?)(?=[.;,\n]|$)/,
  ]) {
    const m = text.match(re);
    if (m && m[1].trim().length >= 2) return m[1].trim().slice(0, 40);
  }
  return null;
}

function parseCurator(text) {
  if (!text) return null;
  const m = text.match(/기획[：:\s]+([\w가-힣\s,]+?)(?=[.;,\n]|$)/);
  return m ? m[1].trim().slice(0, 30) : null;
}

/* ── Handler ──────────────────────────────── */
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=300',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const { query, discover } = event.queryStringParameters || {};
    const clientId     = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return { statusCode: 500, headers,
        body: JSON.stringify({ error: 'NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수 미설정' }) };
    }

    /* ── 1) 지역 검색 쿼리 목록 ── */
    let localVariants;
    if (discover) {
      localVariants = [
        '미술관 전시', '갤러리 전시', '박물관 특별전',
        '아트센터 전시', '뮤지엄 전시',
      ];
    } else if (query?.trim()) {
      const q = query.trim();
      localVariants = [q, `${q} 갤러리`, `${q} 미술관`, `${q} 전시`, `${q} 서울`];
    } else {
      return { statusCode: 400, headers,
        body: JSON.stringify({ error: 'query 또는 discover=1 파라미터가 필요합니다.' }) };
    }

    /* ── 2) 블로그 검색 쿼리 ── */
    const blogQuery = query?.trim()
      ? `${query.trim()} 전시 입장료 운영시간 작가`
      : '서울 미술관 갤러리 전시 2025 2026 입장료 운영시간';

    /* ── 3) 병렬 실행: 지역 N개 + 블로그 1개 ── */
    const [blogResp, ...localResps] = await Promise.all([
      fetchNaver('blog', blogQuery, 10, clientId, clientSecret),
      ...localVariants.map(v => fetchNaver('local', v, 5, clientId, clientSecret)),
    ]);

    /* ── 4) 지역 결과 dedupe ── */
    const seen = new Set();
    const merged = [];
    localResps.forEach((resp, idx) => {
      (resp.items || []).forEach(it => {
        const clean = stripTags(it.title);
        const key   = `${clean}|${it.roadAddress || it.address || ''}`;
        if (seen.has(key)) return;
        seen.add(key);
        merged.push({ ...it, title: clean, _variant: localVariants[idx] });
      });
    });

    /* ── 5) 블로그 결과 정제 ── */
    const blogs = (blogResp.items || []).map(b => ({
      title:       stripTags(b.title),
      link:        b.link,
      description: stripTags(b.description),
      bloggername: b.bloggername,
      postdate:    b.postdate,
    }));

    /* ── 6) 각 venue에 블로그 정보 매핑 ── */
    const enriched = merged.map(venue => {
      // 이 venue 이름이 포함된 블로그 포스트 필터링
      const relevant = blogs.filter(b =>
        b.title.includes(venue.title) ||
        b.description.includes(venue.title)
      );
      const allText = relevant.map(b => `${b.title} ${b.description}`).join(' ');
      const periodParsed = parsePeriod(allText);

      return {
        title:     venue.title,
        link:      venue.link,
        category:  venue.category || '',
        address:   venue.roadAddress || venue.address || '',
        telephone: venue.telephone || '',
        mapx:      venue.mapx,
        mapy:      venue.mapy,
        enriched: {
          showTitle: parseShowTitle(allText) || null,
          period:    periodParsed?.period    || null,
          endDate:   periodParsed?.endDate   || null,
          fee:       parseFee(allText)       || null,
          hours:     parseHours(allText)     || null,
          artist:    parseArtist(allText)    || null,
          curator:   parseCurator(allText)   || null,
          blogLinks: relevant.slice(0, 3).map(b => ({ title: b.title, link: b.link })),
        },
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        items: enriched,
        meta: {
          localCount: merged.length,
          blogCount:  blogs.length,
          discover:   !!discover,
          query:      query || null,
        },
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers,
      body: JSON.stringify({ error: '서버 오류', detail: err.message }) };
  }
};
