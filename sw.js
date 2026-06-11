// 링크 보관함 - 최소 서비스워커 (PWA 설치 가능하게만 함)
const CACHE='linkvault-v2.8';
self.addEventListener('install',e=>{self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim());});
self.addEventListener('fetch',e=>{
  // API(동기화·메타) 및 비-GET 요청은 캐시하지 않고 항상 네트워크로
  const isApi = e.request.url.includes('/api/') || e.request.url.includes('/.netlify/');
  if(e.request.method!=='GET' || isApi){ return; }
  // 그 외 정적 리소스: 네트워크 우선, 실패 시 캐시 (데이터는 localStorage라 영향 없음)
  e.respondWith(
    fetch(e.request).then(r=>{
      const copy=r.clone();
      caches.open(CACHE).then(c=>{try{c.put(e.request,copy);}catch(_){}});
      return r;
    }).catch(()=>caches.match(e.request))
  );
});
