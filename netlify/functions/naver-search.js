// MYEXHIT — Naver Search Proxy v3
// 개선 사항:
//   - 장소별 타겟 블로그 검색 (per-venue targeted blog search)
//   - 개선된 기획전/개인전/특별전 파싱
//   - 네이버 뉴스 API 병행 (전시 정보 보강)
//   - 최신 블로그 우선 정렬

const stripTags = s => (s || '').replace(/<[^>]+>/g, '').trim();

async function fetchNaver(endpoint, query, display, id, secret) {
  const url = `https://openapi.naver.com/v1/search/${endpoint}.json`
    + `?query=${encodeURIComponent(query)}&display=${display}&sort=date`;
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

/* ── 파서 ─────────────────────────────────────── */
function parseFee(text) {
  if (!text) return null;
  if (/무료/.test(text)) return '무료';
  for (const re of [
    /성인\s*([\d,]+)\s*원/,
    /일반\s*([\d,]+)\s*원/,
    /입장료\s*([\d,]+)\s*원/,
    /어른\s*([\d,]+)\s*원/,
    /([\d,]+)\s*원\s*(?:입장|관람)/,
  ]) {
    const m = text.match(re);
    if (m) return `성인 ${m[1]}원`;
  }
  return null;
}

function parseHours(text) {
  if (!text) return null;
  let m = text.match(/(\d{1,2}:\d{2})\s*[-~–]\s*(\d{1,2}:\d{2})/);
  if (m) return `${m[1]} – ${m[2]}`;
  m = text.match(/(\d{1,2})시\s*[-~–]\s*(\d{1,2})시/);
  if (m) return `${m[1].padStart(2,'0')}:00 – ${m[2].padStart(2,'0')}:00`;
  return null;
}

// 전시명 파싱 (venue 이름 인지하여 제외)
function parseShowTitle(text, venueName) {
  if (!text) return null;

  // 1. 꺽쇠/괄호 패턴 「」≪≫《》
  for (const re of [
    /[「≪《〈‹](.*?)[」≫》〉›]/,
    /[\[【](.*?)[\]】]/,
  ]) {
    const m = text.match(re);
    if (m && m[1].length >= 2 && m[1].length <= 60) {
      const t = m[1].trim();
      if (!venueName || !t.includes(venueName.slice(0,4))) return t;
    }
  }

  // 2. "{이름} 기획전/개인전/특별전/단체전/초대전/그룹전" 패턴
  const m2 = text.match(/([가-힣a-zA-Z·\-\s]{1,20}?)\s*(기획전|개인전|특별전|단체전|초대전|그룹전|기념전|회고전)/);
  if (m2) {
    const candidate = `${m2[1].trim()} ${m2[2]}`;
    // 장소명 자체가 매칭되는 경우 제외
    if (venueName && m2[1].trim().length >= 2 && candidate.replace(/\s/g,'').includes((venueName||'').replace(/\s/g,'').slice(0,4))) {
      // 다음 패턴 시도
    } else if (m2[1].trim().length >= 1) {
      return candidate;
    }
  }

  // 3. "전시명: XXX" / "展名: XXX" 패턴
  const m3 = text.match(/(?:전시명|전시제목|展名)[：:\s]+([\w가-힣·\-\s]+?)(?=[.,。\n]|$)/);
  if (m3 && m3[1].trim().length >= 2) return m3[1].trim();

  // 4. "XXX 展" 패턴
  const m4 = text.match(/([가-힣a-zA-Z·\s]{2,25}?)展(?=[^시]|$)/);
  if (m4 && m4[1].trim().length >= 2) return `${m4[1].trim()} 展`;

  return null;
}

function parsePeriod(text) {
  if (!text) return null;
  const m = text.match(
    /(\d{4}[.\-\/]\d{1,2}[.\-\/]\d{1,2})\s*[-~–]\s*(\d{4}[.\-\/]\d{1,2}[.\-\/]\d{1,2})/
  );
  if (!m) return null;
  const endStr = m[2].replace(/[.\/]/g, '-');
  return { period: `${m[1]} — ${m[2]}`, endDate: endStr };
}

function parseArtist(text) {
  if (!text) return null;
  for (const re of [
    /작가[：:\s]+([\w가-힣\s,·]+?)(?=[.;,\n]|$)/,
    /아티스트[：:\s]+([\w가-힣\s,·]+?)(?=[.;,\n]|$)/,
    /참여\s*작가[：:\s]+([\w가-힣\s,·]+?)(?=[.;,\n]|$)/,
  ]) {
    const m = text.match(re);
    if (m && m[1].trim().length >= 2) return m[1].trim().slice(0, 40);
  }
  return null;
}

function parseCurator(text) {
  if (!text) return null;
  const m = text.match(/기획[：:\s]+([\w가-힣\s,·]+?)(?=[.;,\n]|$)/);
  return m ? m[1].trim().slice(0, 30) : null;
}

/* ── 장소별 블로그+뉴스 보강 (핵심 개선) ──────── */
async function enrichVenue(venue, clientId, clientSecret) {
  const vName = venue.title;
  // 타겟 검색: "장소명 전시 기획전 2025 2026"
  const bQuery = `"${vName}" 전시 기획전 2026`;
  const nQuery = `"${vName}" 전시`;

  const [blogResp, newsResp] = await Promise.all([
    fetchNaver('blog', bQuery, 5, clientId, clientSecret),
    fetchNaver('news', nQuery, 3, clientId, clientSecret),
  ]);

  const blogs = (blogResp.items || []).map(b => ({
    title:       stripTags(b.title),
    link:        b.link,
    description: stripTags(b.description),
    date:        b.postdate || '',
  }));
  const news = (newsResp.items || []).map(n => ({
    title:       stripTags(n.title),
    link:        n.link,
    description: stripTags(n.description),
    date:        n.pubDate || '',
  }));

  // 최신 순 정렬 후 텍스트 합산
  const allItems = [...blogs, ...news].sort((a,b) => b.date.localeCompare(a.date));
  const allText = allItems.map(i => `${i.title} ${i.description}`).join(' ');

  const periodParsed = parsePeriod(allText);
  const showTitle    = parseShowTitle(allText, vName);

  return {
    ...venue,
    enriched: {
      showTitle: showTitle || null,
      period:    periodParsed?.period  || null,
      endDate:   periodParsed?.endDate || null,
      fee:       parseFee(allText)     || null,
      hours:     parseHours(allText)   || null,
      artist:    parseArtist(allText)  || null,
      curator:   parseCurator(allText) || null,
      blogLinks: allItems.slice(0, 3).map(i => ({ title: i.title, link: i.link })),
    },
  };
}

/* ── Handler ─────────────────────────────────── */
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

    /* ── 1) 지역 검색 쿼리 ── */
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

    /* ── 2) 지역 검색 병렬 실행 ── */
    const localResps = await Promise.all(
      localVariants.map(v => fetchNaver('local', v, 5, clientId, clientSecret))
    );

    /* ── 3) 지역 결과 dedupe ── */
    const seen   = new Set();
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

    /* ── 4) 장소별 타겟 블로그+뉴스 보강 (최대 10개 병렬) ── */
    const TOP_N   = 10;
    const topList = merged.slice(0, TOP_N);
    const rest    = merged.slice(TOP_N);

    const enrichedTop = await Promise.all(
      topList.map(v => enrichVenue(v, clientId, clientSecret))
    );

    // 나머지는 enriched 없이 빈 값으로
    const enrichedRest = rest.map(v => ({
      ...v,
      enriched: { showTitle: null, period: null, endDate: null, fee: null, hours: null, artist: null, curator: null, blogLinks: [] },
    }));

    const enriched = [...enrichedTop, ...enrichedRest].map(v => ({
      title:     v.title,
      link:      v.link,
      category:  v.category || '',
      address:   v.roadAddress || v.address || '',
      telephone: v.telephone || '',
      mapx:      v.mapx,
      mapy:      v.mapy,
      enriched:  v.enriched,
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        items: enriched,
        meta: {
          localCount: merged.length,
          discover:   !!discover,
          query:      query || null,
        },
      }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '서버 오류', detail: err.message }),
    };
  }
};
