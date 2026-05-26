// MYEXHIT — Naver search proxy with multi-query + blog fallback
// Solves: "메종 나비" 같은 소규모 갤러리가 단일 local 검색에서 누락되는 문제
//
// 동작:
//   1) 받은 query를 5가지 변형으로 동시에 local 검색 (display=5 max per call)
//   2) 결과를 title+address 기준으로 dedupe → 최대 25개
//   3) 사용자가 입력한 첫 단어가 어떤 결과에도 포함되지 않으면 → blog 검색 폴백
//   4) blog 결과는 좌표는 없지만 후기 링크로 활용 가능
//
// 응답 예:
// {
//   items: [{ title, link, category, address, roadAddress, mapx, mapy, _source, _matchedVariant }],
//   blog:  [{ title, link, description, _source }],
//   meta:  { variantsTried, localCount, blogCount, originalQuery }
// }

const fetchNaver = async (endpoint, q, display, clientId, clientSecret) => {
  const url = `https://openapi.naver.com/v1/search/${endpoint}.json?query=${encodeURIComponent(q)}&display=${display}&sort=random`;
  const r = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
  });
  if (!r.ok) {
    return { items: [], _httpStatus: r.status };
  }
  return r.json();
};

const stripTags = (s) => (s || '').replace(/<[^>]+>/g, '').trim();

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=300', // 5분 캐시
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { query, mode = 'multi', skipBlog } = event.queryStringParameters || {};

    if (!query) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'query 파라미터가 필요합니다.' }) };
    }

    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'API 키가 설정되지 않았습니다. Netlify 환경변수 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 확인.' }),
      };
    }

    const q = query.trim();

    // ---------- 1) Multi-query LOCAL search ----------
    const variants =
      mode === 'single'
        ? [q]
        : [
            q,
            `${q} 갤러리`,
            `${q} 미술관`,
            `${q} 전시`,
            `${q} 서울`,
          ];

    const localResponses = await Promise.all(
      variants.map((v) =>
        fetchNaver('local', v, 5, clientId, clientSecret).catch(() => ({ items: [] }))
      )
    );

    // dedupe by (stripped title) + (address). Keep first-seen.
    const seen = new Set();
    const merged = [];
    localResponses.forEach((resp, idx) => {
      (resp.items || []).forEach((it) => {
        const cleanTitle = stripTags(it.title);
        const key = cleanTitle + '|' + (it.address || it.roadAddress || '');
        if (seen.has(key)) return;
        seen.add(key);
        merged.push({
          ...it,
          title: cleanTitle, // already stripped, replaces <b>highlights</b>
          _source: 'local',
          _matchedVariant: variants[idx],
        });
      });
    });

    // ---------- 2) BLOG fallback if main keyword not in local results ----------
    const firstWord = q.split(/\s+/)[0];
    const localHasMatch = merged.some((it) => (it.title || '').includes(firstWord));

    let blogItems = [];
    if (!localHasMatch && skipBlog !== '1') {
      const blogResp = await fetchNaver(
        'blog',
        `${q} 전시 OR 갤러리 OR 미술관`,
        10,
        clientId,
        clientSecret
      ).catch(() => ({ items: [] }));

      blogItems = (blogResp.items || []).map((it) => ({
        title: stripTags(it.title),
        link: it.link,
        description: stripTags(it.description),
        bloggerName: it.bloggername,
        postdate: it.postdate,
        _source: 'blog',
      }));
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        items: merged,
        blog: blogItems,
        meta: {
          originalQuery: q,
          variantsTried: variants,
          localCount: merged.length,
          blogCount: blogItems.length,
          blogFallbackUsed: !localHasMatch && skipBlog !== '1',
        },
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '서버 오류 발생', detail: error.message }),
    };
  }
};
