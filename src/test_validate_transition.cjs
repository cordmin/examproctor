const assert=require('node:assert/strict');const path=require('node:path');const fs=require('node:fs');const {pathToFileURL}=require('node:url');const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await b.newPage({viewport:{width:1280,height:800}});await p.goto(pathToFileURL(path.join(__dirname,'index.html')).href);const empty=await p.evaluate(()=>structuredClone(appData));
 const sample=JSON.parse(fs.readFileSync(path.join(__dirname,'시험감독_배정결과(예시).json'),'utf8'));
 for(const data of [empty,sample]){
  await p.evaluate(data=>{appData=data;sanitizeAppData(appData);showTab('tab-config');},data);
  const frames=await p.evaluate(async()=>{
   showTab('tab-validate');
   const geometry=()=>({header:[...document.querySelectorAll('#stats-header th')].map(c=>[c.getBoundingClientRect().x,c.getBoundingClientRect().width]),rows:document.querySelectorAll('#stats-scroll tbody tr').length,table:document.querySelector('#stats-scroll table').getBoundingClientRect().height});
   const frames=[geometry()];for(let i=0;i<12;i++)await new Promise(resolve=>requestAnimationFrame(()=>{frames.push(geometry());resolve()}));return frames;
  });
  frames.forEach(frame=>assert.deepEqual(frame,frames[0],'Validation grid must be final before the first paint'));
 }
 await p.evaluate(()=>{startTour();tourIndex=TOUR_STEPS.findIndex(step=>step.el==='[data-action="reset"]');placeTour();});
 assert.equal(await p.locator('#tour-title').textContent(),'8. 전체 초기화');assert.match(await p.locator('#tour-text').textContent(),/먼저 저장/);
 assert.equal(await p.locator('#tour').isVisible(),true);await p.screenshot({path:path.join(__dirname,'../artifacts/reset-tour.png')});
 await p.locator('#tour-skip').click();await p.locator('#sidebar-nav [data-action="reset"]').click();assert.equal(await p.locator('#confirm-modal-msg').textContent().then(s=>s.includes('기초 설정')),false);
 console.log('PASS: validation geometry stable from first paint across 12 frames with empty and populated data; reset tour and warning; shortened reset modal');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
