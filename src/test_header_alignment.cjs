const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../timetable_data.json'),'utf8'));
 for(const deviceScaleFactor of [1,1.25,1.5]){
  const context=await browser.newContext({deviceScaleFactor});const page=await context.newPage();
  await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
  await page.evaluate(data=>{appData=data;sanitizeAppData(appData);showTab('tab-teachers');},data);
  for(const [width,height] of [[1280,800],[1365,850],[1500,900],[1536,864],[1600,1000]]){
   await page.setViewportSize({width,height});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{syncTeacherHeader();requestAnimationFrame(resolve)})));
   const check=await page.evaluate(()=>{
    const header=document.getElementById('teacher-list-header');const scroll=document.getElementById('teacher-list-scroll');
    const heads=[...header.querySelectorAll('th')].filter(el=>el.getBoundingClientRect().width);
    const cells=[...document.querySelector('#teacher-list-body tr').children];
    return {seam:Math.abs(header.getBoundingClientRect().bottom-scroll.getBoundingClientRect().top),
     offsets:heads.map((head,i)=>Math.abs(head.getBoundingClientRect().right-cells[i].getBoundingClientRect().right)),
     paintedSeparately:scroll.classList.contains('has-head'),line:getComputedStyle(header).borderBottomStyle,
     headTop:header.getBoundingClientRect().top};
   });
   assert.ok(check.seam<.1,JSON.stringify({width,height,deviceScaleFactor,check}));
   assert.ok(check.offsets.every(offset=>offset<.05),JSON.stringify({width,height,deviceScaleFactor,check}));
   assert.equal(check.paintedSeparately,false);assert.equal(check.line,'solid');
   await page.locator('#teacher-list-scroll').evaluate(el=>el.scrollTop=300);
   assert.equal(await page.locator('#teacher-list-header').evaluate(el=>el.getBoundingClientRect().top),check.headTop);
  }
  await context.close();
 }
 console.log('PASS: single continuous header line and matching columns at 5 window sizes x 3 pixel ratios, including scrolling');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1;});
