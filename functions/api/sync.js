// functions/api/sync.js — Cloudflare Pages Function (기기 간 동기화, KV 기반)
// 경로: 파일 위치(functions/api/sync.js)가 곧 URL(/api/sync) 입니다.
// 저장소: Cloudflare KV. Pages 설정에서 변수명 LINKVAULT 로 KV 네임스페이스를 바인딩하세요.
// 식별: 비밀 '동기화 코드' → SHA-256 해시 → 저장 키. (나중에 로그인 userId로 확장 가능)
// 병합: 레코드 id별 updated 타임스탬프(LWW) + tombstone(삭제 표식) → 무손실.

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };
}
const emptyDoc = () => ({ items: [], topics: [], tomb: {}, rev: 0 });

function mergeList(a = [], b = [], tomb = {}) {
  const map = {};
  for (const it of [...a, ...b]) {
    if (!it || !it.id) continue;
    const ex = map[it.id];
    if (!ex || (it.updated || 0) >= (ex.updated || 0)) map[it.id] = it;
  }
  return Object.values(map).filter(
    (it) => !(tomb[it.id] && tomb[it.id] >= (it.updated || 0))
  );
}
function mergeDoc(a, b) {
  a = a || emptyDoc();
  b = b || emptyDoc();
  const tomb = { ...(a.tomb || {}) };
  for (const [k, v] of Object.entries(b.tomb || {})) tomb[k] = Math.max(tomb[k] || 0, v);
  return {
    items: mergeList(a.items, b.items, tomb),
    topics: mergeList(a.topics, b.topics, tomb),
    tomb,
    rev: Math.max(a.rev || 0, b.rev || 0) + 1,
  };
}
async function sha256hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequest(context) {
  const { request, env } = context;
  const headers = corsHeaders();
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  const url = new URL(request.url);
  const code = url.searchParams.get('code') || '';
  if (!code || code.length < 8) {
    return new Response(JSON.stringify({ error: '동기화 코드는 8자 이상이어야 해요' }), { status: 400, headers });
  }

  const KV = env.LINKVAULT;
  if (!KV) {
    return new Response(JSON.stringify({ error: 'KV 네임스페이스(LINKVAULT)가 연결되지 않았어요. Pages 설정에서 바인딩하세요.' }), { status: 500, headers });
  }

  try {
    const key = 'vault_' + (await sha256hex(code));

    if (request.method === 'GET') {
      const remote = (await KV.get(key, { type: 'json' })) || emptyDoc();
      return new Response(JSON.stringify({ doc: remote }), { status: 200, headers });
    }

    if (request.method === 'POST') {
      let incoming = emptyDoc();
      try { incoming = (await request.json()).doc || emptyDoc(); } catch {}
      const remote = (await KV.get(key, { type: 'json' })) || emptyDoc();
      const merged = mergeDoc(remote, incoming);
      await KV.put(key, JSON.stringify(merged));
      return new Response(JSON.stringify({ doc: merged }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e && e.message) || e) }), { status: 500, headers });
  }
}
