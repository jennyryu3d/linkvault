# 링크 보관함 (Link Vault)

주제별로 모아 한눈에 보는 링크 보관함 PWA. 영상·사이트 링크를 저장하고
주제·태그·즐겨찾기로 정리하며, **기기 간 동기화**로 어디서나 같은 보관함을 봅니다.

## 주요 기능
- 📥 URL 붙여넣기 → 제목·종류·썸네일 자동 인식 (`/api/meta` 프록시 + oEmbed/og 파싱)
- 🗂️ 주제별 분류, 🏷️ 태그, ⭐ 즐겨찾기, 🔎 전체 검색
- 🔄 **기기 간 동기화** — 비밀 *동기화 코드* 하나로 여러 기기를 묶어 자동 동기화
- 🚫 중복 링크 감지 (같은 URL 저장 시 경고 → 기존 항목으로 이동)
- ↕ 정렬 (최신순 / 오래된순 / 가나다순)
- 🏷️ 카드의 태그를 탭하면 해당 태그로 필터
- 👆 카드 본문을 탭하면 바로 링크 열기 (버튼은 그대로 동작)
- 💾 백업(내보내기) / ♻️ 복원(병합), 📊 통계, 📲 PWA 설치 · 공유 타깃

## 동기화 동작 방식
- 데이터는 서버리스 함수(`/api/sync`)를 통해 키-값 저장소에 저장됩니다.
  - **Cloudflare Pages**: Cloudflare **KV** (`functions/api/sync.js`) — 권장 배포
  - **Netlify**: Netlify **Blobs** (`netlify/functions/sync.js`) — 대안
- 메뉴 → *기기 간 동기화* 에서 코드를 만들고, 다른 기기에 같은 코드를 입력하면 연결됩니다.
- 병합은 레코드별 `updated` 타임스탬프 기반(LWW) + 삭제 표식(tombstone)으로
  여러 기기에서 편집·삭제해도 데이터가 유실되지 않습니다.
- 인증이 아닌 *코드* 기반이라 설정이 간단하며, 나중에 코드 자리를 로그인된
  사용자 ID로 바꾸면 그대로 **계정 기반 동기화로 확장**할 수 있습니다.
- ⚠️ 코드를 아는 사람은 누구나 접근 가능하므로 안전하게 보관하세요.

## 구조
```
index.html              앱 본체 (UI + 로직, 단일 파일)
manifest.json, sw.js    PWA 매니페스트 / 서비스워커
functions/api/          [Cloudflare Pages Functions]
  sync.js               기기 간 동기화 (Cloudflare KV)  → /api/sync
  meta.js               링크 메타데이터 프록시          → /api/meta
netlify/functions/      [Netlify Functions — 대안]
  sync.js               기기 간 동기화 (Netlify Blobs)  → /api/sync
  meta.js               링크 메타데이터 프록시          → /api/meta
netlify.toml            Netlify 빌드·리다이렉트 설정
package.json            (Netlify용) 함수 의존성 @netlify/blobs
```
> 클라이언트는 두 경우 모두 동일하게 `/api/sync`·`/api/meta` 를 호출합니다.
> 각 플랫폼은 자기 디렉터리만 사용하므로 함께 있어도 충돌하지 않습니다.

## 배포 (Cloudflare Pages · 권장)
1. **KV 네임스페이스 생성**: Cloudflare 대시보드 → *Workers & Pages* → *KV* →
   *Create namespace* (예: `linkvault`).
2. **Pages 프로젝트 생성**: *Workers & Pages* → *Create* → *Pages* →
   *Connect to Git* → `jennyryu3d/linkvault` → 브랜치 **main**
   - Framework preset: **None**, Build command: **(비움)**, Output directory: **`/`**
3. **KV 바인딩**: 생성된 Pages 프로젝트 → *Settings* → *Functions* →
   *KV namespace bindings* → 변수명 **`LINKVAULT`** = 위에서 만든 네임스페이스 →
   저장 후 **재배포**(바인딩 적용).
4. **확인**: `https://<프로젝트>.pages.dev/api/sync?code=testcode123`
   → `{"doc":{"items":[],"topics":[],"tomb":{},"rev":0}}` 이면 정상.

> 참고: Cloudflare KV는 최종 일관성(eventually consistent)이라 한 기기의 변경이
> 다른 기기에 반영되기까지 최대 ~1분 걸릴 수 있습니다(데이터는 유실 없이 수렴).

## 배포 (Netlify · 대안)
- Netlify에 저장소를 연결하면 함수가 자동 빌드되고 Blobs가 활성화됩니다.
- 로컬 미리보기: 정적 파일만 열면 UI는 동작하지만 `/api/*` 는 플랫폼 환경이 필요합니다.

> 참고: `index-1.html`, `index-2.html` 는 이전 버전 보관본입니다.
