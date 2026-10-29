const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
(async () => {
 const browser = await chromium.launch({channel:'msedge', headless:true});
 try {
  const page = await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
  const empty = await page.evaluate(()=>JSON.parse(JSON.stringify(appData)));
  await page.evaluate(()=>{sanitizeAppData(appData);renderConfigTab();renderTeachers();renderAbsencesTab();renderResultTab();renderValidateTab();markDataSaved();});
  assert.deepEqual(await page.evaluate(()=>appData.config.subjects), []);
  assert.equal(await page.locator('#subject-tables-container table').count(),3);
  assert.equal(await page.locator('#teacher-list-body tr').count(),6);
  assert.equal(await page.locator('#absence-list-body tr').count(),6);
  assert.equal(await page.locator('#stats-scroll tbody tr').count(),6);
  assert.equal(await page.evaluate(()=>getCloseState().dirty),false);
  await page.evaluate(()=>{appData.config.examName='중간고사';});
  assert.equal(await page.evaluate(()=>getCloseState().dirty),true);
  await page.evaluate(()=>{appData.config.examName='';});
  assert.equal(await page.evaluate(()=>getCloseState().dirty),false);
  await page.evaluate(()=>setMaximized(true));
  assert.equal(await page.locator('#win-max').getAttribute('title'),'이전 크기로');
  await page.evaluate(()=>setMaximized(false));
  assert.equal(await page.locator('#win-max').getAttribute('title'),'최대화');
  await page.locator('#grade-1').click();
  for(const [prefix,key] of [['class','classes'],['sp','special'],['sep','separated'],['hw','hallways']]){
   const input=page.locator(`#${prefix}-count-1`);
   await input.fill('2');
   for(const bad of ['1.5','01','가','-1','1e1','999']){
    await input.fill(bad);
    assert.equal(await input.inputValue(),'2',`${prefix}: ${bad}`);
    assert.equal(await page.evaluate(key=>appData.config[key][1],key),2);
   }
   await input.fill(''); assert.equal(await input.inputValue(),'');
  }
  const sample=JSON.parse(fs.readFileSync(path.join(__dirname,'시험감독_배정결과(예시).json'),'utf8'));
  await page.evaluate(data=>{appData=data;sanitizeAppData(appData);renderConfigTab();renderTeachers();renderAbsencesTab();renderResultTab();showTab('tab-validate');},sample);
  assert.equal(await page.locator('#stats-scroll tbody tr').count(),sample.teachers.length);
  const before=await page.locator('#stats-scroll tbody').textContent();
  await page.evaluate(()=>{const validation=JSON.parse(JSON.stringify(appData.validation));window.pywebview={api:{revalidate:async()=>({success:true,validation})}};runRevalidation();});
  await page.waitForTimeout(150);
  assert.equal(await page.locator('#stats-scroll tbody').textContent(),before);
  assert.deepEqual(await page.evaluate(()=>appData.assignments),sample.assignments);
  await page.evaluate(()=>markDataSaved());
  await page.locator('#sidebar-nav [data-action="reset"]').click();
  assert.match(await page.locator('#confirm-modal-msg').textContent(), /모든 자료가 지워집니다/);
  assert.equal(await page.locator('#confirm-modal-btn').textContent(),'전체 초기화');
  await page.waitForTimeout(250);
  await page.locator('#confirm-modal').screenshot({path:path.join(__dirname,'../artifacts/reset-confirm.png')});
  await page.locator('#confirm-modal-cancel').click();
  assert.equal(await page.evaluate(()=>appData.teachers.length),sample.teachers.length);
  await page.locator('#sidebar-nav [data-action="reset"]').click();
  await page.locator('#confirm-modal-btn').click();
  assert.deepEqual(await page.evaluate(()=>appData),empty);
  assert.equal(await page.evaluate(()=>getCloseState().dirty),true);
  assert.equal(await page.locator('#stats-scroll tbody').textContent().then(x=>x.trim()),'');
  assert.equal(await page.locator('.verify-review').count(),0);
  const cards=await page.locator('#subject-tables-container table').evaluateAll(tables=>tables.map(t=>t.getBoundingClientRect().x));
  assert.ok(cards[0] < cards[1] && cards[1] < cards[2], 'Three grade cards stay side by side');
  const grids = await page.locator('.empty-grade-table').evaluateAll(tables => tables.map(table => ({
   rows: [...table.tBodies[0].rows].map(row => row.getBoundingClientRect().height),
   gap: table.parentElement.getBoundingClientRect().bottom - table.getBoundingClientRect().bottom,
  })));
  for (const grid of grids) {
   assert.equal(grid.rows.length,3);
   assert.ok(Math.max(...grid.rows)-Math.min(...grid.rows) < 1, 'Three equal-height rows');
   assert.ok(grid.gap <= 2, 'Grid lines reach the card bottom');
  }
  await page.evaluate(()=>{appData.teachers=[];renderValidateTab();});
  assert.equal(await page.locator('#stats-scroll tbody').textContent().then(x=>x.trim()),'');
  assert.equal(await page.locator('.verify-review').count(),0);
  for(const target of ['tab-teachers','tab-absences','tab-result','tab-validate','tab-config']){
   await page.evaluate(({empty,target})=>{appData=structuredClone(empty);sanitizeAppData(appData);renderConfigTab();renderTeachers();renderAbsencesTab();renderResultTab();renderValidateTab();showTab(target);},{empty,target});
   await page.screenshot({path:path.join(__dirname,`../artifacts/empty-${target}.png`)});
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: blank startup, stable empty tables, strict integers, maximize tooltip, dirty state, revalidation preserves counts, no stale validation');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
