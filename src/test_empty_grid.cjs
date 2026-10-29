const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  for(const deviceScaleFactor of [1,1.25,1.5]){
   const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
   await page.evaluate(()=>{sanitizeAppData(appData);renderConfigTab();renderTeachers();renderAbsencesTab();renderResultTab();renderValidateTab();});
   for(const [width,height] of [[1024,640],[1280,800],[1600,1000]]){
    await page.setViewportSize({width,height});
    for(const [target,selector] of [['tab-teachers','#teacher-list-scroll'],['tab-absences','#absence-table-scroll'],['tab-result','#result-teacher .result-table-scroll'],['tab-validate','#stats-scroll']]){
     await page.evaluate(target=>showTab(target),target);
     await page.waitForTimeout(100);
     const geometry=await page.locator(selector).evaluate(scroll=>{
      const rows=[...scroll.querySelectorAll('tbody tr')];
      return {gap:scroll.getBoundingClientRect().bottom-rows.at(-1).getBoundingClientRect().bottom,heights:rows.map(row=>row.getBoundingClientRect().height)};
     });
     assert.ok(Math.abs(geometry.gap)<2,`${target} bottom gap ${geometry.gap} at ${width}x${height} @${deviceScaleFactor}`);
     assert.ok(Math.max(...geometry.heights)-Math.min(...geometry.heights)<2,`${target}: equal blank rows`);
     if(target==='tab-absences') assert.equal(await page.locator('#absence-list-head tr:last-child th').evaluate(cell=>getComputedStyle(cell).borderRightWidth),await page.locator('#absence-list-head th').first().evaluate(cell=>getComputedStyle(cell).borderRightWidth));
     if(target==='tab-result') assert.equal(await page.locator('#result-teacher .result-table-header .border-thick').count(),0);
     if(deviceScaleFactor===1 && width===1280) await page.screenshot({path:path.join(__dirname,`../artifacts/grid-${target}.png`)});
    }
   }
   const sample=JSON.parse(fs.readFileSync(path.join(__dirname,'시험감독_배정결과(예시).json'),'utf8'));
   await page.evaluate(data=>{appData=data;sanitizeAppData(appData);showTab('tab-teachers');},sample);
   await page.waitForTimeout(100);
   assert.equal(await page.locator('#teacher-list-body tr').count(),sample.teachers.length);
   assert.equal(await page.locator('#teacher-list-scroll.empty-table-scroll').count(),0);
   assert.equal(await page.locator('#teacher-list-scroll table').evaluate(table=>table.style.height),'');
   assert.deepEqual(errors,[]);
   await page.close();
  }
  console.log('PASS: full-height empty grids on 4 pages at 3 sizes x 3 pixel ratios; equal rows; continuous absence header; uniform empty result borders; real data unchanged');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
