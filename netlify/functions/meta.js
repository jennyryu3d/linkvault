// netlify/functions/meta.js
// 링크의 제목/채널/썸네일을 가져오는 프록시.
// 1) 유튜브·비메오 등은 oEmbed 사용  2) 그 외 사이트는 HTML의 og: 메타태그를 파싱
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=86400'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  const target = (event.queryStringParameters || {}).url;
  if (!target) return { statusCode: 400, headers, body: JSON.stringify({ error: 'url 파라미터가 필요합니다' }) };

  let url;
  try { url = new URL(target); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: '잘못된 URL' }) }; }

  const fetchText = async (u, opts = {}) => {
    const r = await fetch(u, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LinkVault/1.0)', 'Accept-Language': 'ko,en;q=0.8' },
      ...opts
    });
    return r.ok ? await r.text() : null;
  };

  try {
    const host = url.hostname.replace(/^www\./, '');

    // --- oEmbed 우선 (유튜브 / 비메오) ---
    let oembed = null;
    if (/youtube\.com|youtu\.be/.test(host)) oembed = 'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(target);
    else if (/vimeo\.com/.test(host)) oembed = 'https://vimeo.com/api/oembed.json?url=' + encodeURIComponent(target);
    if (oembed) {
      const txt = await fetchText(oembed);
      if (txt) {
        try {
          const d = JSON.parse(txt);
          return { statusCode: 200, headers, body: JSON.stringify({ title: d.title, author_name: d.author_name || '', thumbnail_url: d.thumbnail_url || '' }) };
        } catch {}
      }
    }

    // --- 그 외 사이트: HTML 메타태그 파싱 ---
    const html = await fetchText(target);
    if (!html) return { statusCode: 200, headers, body: JSON.stringify({}) };

    const pick = (props) => {
      for (const p of props) {
        const re = new RegExp('<meta[^>]+(?:property|name)=["\']' + p + '["\'][^>]*>', 'i');
        const tag = html.match(re);
        if (tag) {
          const c = tag[0].match(/content=["\']([^"\']*)["\']/i);
          if (c && c[1]) return c[1].trim();
        }
      }
      return '';
    };

    let title = pick(['og:title', 'twitter:title']);
    if (!title) { const t = html.match(/<title[^>]*>([^<]*)<\/title>/i); if (t) title = t[1].trim(); }
    let thumb = pick(['og:image', 'twitter:image', 'twitter:image:src']);
    if (thumb && thumb.startsWith('/')) thumb = url.origin + thumb;
    const author = pick(['og:site_name', 'author']);

    // HTML 엔티티 간단 디코드
    const dec = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(n));

    return { statusCode: 200, headers, body: JSON.stringify({ title: dec(title || ''), author_name: dec(author || ''), thumbnail_url: thumb || '' }) };
  } catch (e) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: String(e) }) };
  }
};
