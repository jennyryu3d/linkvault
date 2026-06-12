const puppeteer = require('puppeteer');
const path = require('path');

const topics = [
  {id:'def-요리',   name:'요리',   emo:'🍳', updated:1},
  {id:'def-여행',   name:'여행',   emo:'✈️', updated:1},
  {id:'def-골프',   name:'골프',   emo:'⛳', updated:1},
  {id:'def-가죽공예',name:'가죽공예',emo:'🧵', updated:1},
];
const now = Date.now();
const mk = (o,i)=>Object.assign({id:'s'+i,star:false,added:now-i*1e7,updated:now-i*1e7,tags:[],memo:'',host:'',thumb:'',favicon:''},o);
const items = [
  {type:'video',topic:'def-요리', title:'백종원 김치찌개 황금레시피 (실패 없는 비율)', host:'youtube.com', tags:['집밥','15분'], star:true, memo:'주말에 꼭 해보기'},
  {type:'site', topic:'def-여행', title:'교토 3박4일 추천 코스 — 가을 단풍 명소 총정리', host:'blog.naver.com', tags:['단풍','일본']},
  {type:'video',topic:'def-골프', title:'드라이버 슬라이스 교정 드릴 3가지', host:'youtube.com', tags:['스윙']},
  {type:'site', topic:'def-가죽공예', title:'입문자용 가죽 공구 세트 추천 가이드', host:'brunch.co.kr', tags:['입문','공구'], memo:'지름신 주의 ⚠️'},
  {type:'site', topic:'def-요리', title:'오븐 없이 만드는 바스크 치즈케이크', host:'10000recipe.com', tags:['디저트']},
  {type:'video',topic:'def-여행', title:'제주 동쪽 드라이브 코스 브이로그', host:'youtube.com', star:true},
].map(mk);

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox','--disable-setuid-sandbox','--force-color-profile=srgb'],
  });
  async function shot(file, out, openSheet) {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await page.evaluateOnNewDocument((items, topics) => {
      localStorage.setItem('linkvault_v2', JSON.stringify(items));
      localStorage.setItem('linkvault_topics_v2', JSON.stringify(topics));
    }, items, topics);
    await page.goto('file://' + path.resolve(file), { waitUntil: 'networkidle0', timeout: 15000 }).catch(()=>{});
    await new Promise(r=>setTimeout(r,700));
    if (openSheet) {
      await page.click('.fab').catch(()=>{});
      await new Promise(r=>setTimeout(r,500));
    }
    await page.screenshot({ path: out });
    console.log('saved', out);
    await page.close();
  }
  await shot('index.html',      '/tmp/a_current_list.png', false);
  await shot('index-mono.html', '/tmp/b_mono_list.png',    false);
  await shot('index-mono.html', '/tmp/c_mono_sheet.png',   true);
  await browser.close();
})().catch(e=>{ console.error(e); process.exit(1); });
