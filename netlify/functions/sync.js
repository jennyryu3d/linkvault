// netlify/functions/sync.js
// 기기 간 동기화 백엔드 (Netlify Blobs 기반).
// - 식별: 비밀 "동기화 코드" 하나로 여러 기기를 묶음 (코드 → 해시 → 저장 키)
// - GET  /api/sync?code=CODE         → 현재 클라우드 문서 반환
// - POST /api/sync?code=CODE  {doc}  → 서버가 기존 문서와 병합 후 저장, 병합 결과 반환
//
// 병합 규칙(LWW/CRDT 유사): 레코드 id별로 updated 타임스탬프가 큰 쪽 채택,
// tombstone(삭제 표식)이 더 최근이면 삭제 유지. 동시 편집에도 데이터 유실 없음.
// 나중에 로그인(구글 등)으로 확장 시: code 대신 인증된 userId를 키로 쓰면 됨.

const crypto = require('crypto');

const keyForCode = (code) =>
  'vault_' + crypto.createHash('sha256').update(String(code)).digest('hex');

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
  for (const [k, v] of Object.entries(b.tomb || {})) {
    tomb[k] = Math.max(tomb[k] || 0, v);
  }
  return {
    items: mergeList(a.items, b.items, tomb),
    topics: mergeList(a.topics, b.topics, tomb),
    tomb,
    rev: Math.max(a.rev || 0, b.rev || 0) + 1,
  };
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  const code = (event.queryStringParameters || {}).code || '';
  if (!code || String(code).length < 8) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: '동기화 코드는 8자 이상이어야 해요' }) };
  }

  try {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore({ name: 'linkvault', consistency: 'strong' });
    const key = keyForCode(code);

    if (event.httpMethod === 'GET') {
      const remote = (await store.get(key, { type: 'json' })) || emptyDoc();
      return { statusCode: 200, headers, body: JSON.stringify({ doc: remote }) };
    }

    if (event.httpMethod === 'POST') {
      let incoming = emptyDoc();
      try { incoming = JSON.parse(event.body || '{}').doc || emptyDoc(); } catch {}
      const remote = (await store.get(key, { type: 'json' })) || emptyDoc();
      const merged = mergeDoc(remote, incoming);
      await store.setJSON(key, merged);
      return { statusCode: 200, headers, body: JSON.stringify({ doc: merged }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(e && e.message || e) }) };
  }
};
