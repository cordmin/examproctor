const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
(async () => {
 const browser = await chromium.launch({channel:'msedge',headless:true});
 try {
  const page = await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
  await page.evaluate(()=>{
   sanitizeAppData(appData);appData.config.grades=[1];appData.config.classes={1:3};appData.config.special={1:1};appData.config.separated={1:1};
   appData.teachers=Array.from({length:30},(_,i)=>({id:`t${i}`,name:`교사${i}`,isSub:true,maxPeriods:i===0?1:0}));showTab('tab-config');
  });
  for(const [value,label] of [['single','정감독 (1인)'],['none','없음'],['double','정·부감독 (2인)'],['single','정감독 (1인)']]) {
   await page.locator('#iv-style-1-dropdown').click();await page.getByRole('option',{name:label,exact:true}).click();
   await page.evaluate(()=>{showTab('tab-teachers');showTab('tab-config')});
   assert.equal(await page.locator('#iv-style-1').inputValue(),value);
  }
  assert.deepEqual(await page.locator('#iv-sp-1 option').allTextContents(),['정감독 (1인)']);
  assert.deepEqual(await page.locator('#iv-sep-1 option').allTextContents(),['정감독 (1인)']);
  await page.evaluate(()=>showTab('tab-teachers'));
  assert.equal(await page.locator('th[data-role="isSub"]').isVisible(),false);
  await page.evaluate(()=>{showTab('tab-config');document.getElementById('iv-style-1').value='double';saveRules();showTab('tab-teachers')});
  assert.equal(await page.locator('th[data-role="isSub"]').isVisible(),true);
  await page.evaluate(()=>showTab('tab-absences'));
  const limit = page.locator('.limit-control').first();
  const number = limit.locator('input');
  await limit.getByRole('button', {name:'교사0 배정 제한 늘리기',exact:true}).click();
  assert.equal(await number.inputValue(),'2');
  assert.equal(await page.evaluate(()=>appData.teachers[0].maxPeriods),2);
  await number.fill('12'); await number.blur();
  assert.equal(await page.evaluate(()=>appData.teachers[0].maxPeriods),12);
  assert.equal(await limit.locator('.limit-value span').isVisible(),true);
  const centered = await limit.evaluate(el=>{
   const field=el.getBoundingClientRect(),value=el.querySelector('.limit-value').getBoundingClientRect();
   const step=el.querySelector('.limit-step').getBoundingClientRect();
   const zoom=parseFloat(document.documentElement.style.zoom)||1;
   const left=field.left+parseFloat(getComputedStyle(el).borderLeftWidth)*zoom;
   return Math.abs((left+step.left)/2-value.x-value.width/2)<.1
       && Math.abs(field.y+field.height/2-value.y-value.height/2)<.1;
  });
  assert.equal(centered,true);
  await number.fill('1');await number.blur();
  await limit.getByRole('button',{name:'교사0 배정 제한 줄이기',exact:true}).click();
  assert.equal(await number.inputValue(),'');
  assert.equal(await page.evaluate(()=>appData.teachers[0].maxPeriods),0);
  assert.equal(await limit.locator('.limit-value span').isVisible(),false);
  await limit.getByRole('button',{name:'교사0 배정 제한 늘리기',exact:true}).click();
  for(const count of [9,12,9,12]) {
   await page.evaluate(count=>{appData.periods=Array.from({length:count},(_,i)=>({id:`p${i}`,date:`2026-04-${27+Math.floor(i/3)}`,name:`${i%3+1}교시`}));renderAbsencesTab()},count);
   await page.waitForTimeout(100);
   const widths=await page.locator('#absence-list-body tr').first().locator('td').evaluateAll(c=>c.slice(3,-1).map(x=>x.getBoundingClientRect().width));
   assert.equal(widths.length,count);assert.ok(Math.max(...widths)-Math.min(...widths)<1,JSON.stringify(widths));
  }
  await page.locator('#absence-list-body input[type=number]').first().hover();
  await page.screenshot({path:path.join(__dirname,'../artifacts/absence-fixed.png')});
  let baseline;
  for(const [width,height] of [[1024,640],[1280,800],[1600,1000],[1920,1200]]) {
   await page.setViewportSize({width,height});await page.waitForTimeout(80);
   const sizes=await page.evaluate(()=>{
    const bar=document.getElementById('titlebar'),ids=['btn-tour','win-min','win-max','win-close'];
    return [bar.getBoundingClientRect().height, parseFloat(getComputedStyle(bar).fontSize), ...ids.flatMap(id=>{const r=document.getElementById(id).getBoundingClientRect();return [r.width,r.height]})];
   });
   baseline ||= sizes;assert.ok(sizes.every((v,i)=>Math.abs(v-baseline[i])<.1),JSON.stringify({width,sizes,baseline}));
   assert.ok(await page.locator('#titlebar').evaluate(el=>Math.abs(el.getBoundingClientRect().right-innerWidth)<1));
  }
  await page.setViewportSize({width:1280,height:800});
  await page.evaluate(()=>{window.pywebview={api:{get_version:async()=>'1.0.7',check_update:async()=>({available:false,status:'latest'})}}});
  await page.locator('#app-version').click();await page.getByText('현재 최신 버전을 사용하고 있습니다.',{exact:true}).waitFor();
  assert.equal(await page.locator('#about-version').textContent(),'v1.0.7');
  await page.screenshot({path:path.join(__dirname,'../artifacts/about-modal.png')});
  for(const status of ['error','development','unconfigured']) {
   await page.evaluate(status=>{window.pywebview.api.check_update=async()=>({available:false,status});checkAboutUpdate()},status);
   await page.waitForFunction(()=>!document.getElementById('about-check').disabled);
   assert.ok(!(await page.locator('#about-update-status').textContent()).includes('최신 버전'));
  }
  await page.evaluate(()=>{window.pywebview.api.check_update=async()=>({available:true,version:'v1.0.8',current:'v1.0.7'});checkAboutUpdate()});
  await page.waitForFunction(()=>document.getElementById('about-check').textContent==='업데이트 받기');
  await page.evaluate(()=>{window.pywebview.api.install_update=async()=>({success:true})});
  await page.locator('#about-check').click();assert.equal(await page.locator('#update-modal').isVisible(),true);
  await page.waitForFunction(()=>document.getElementById('update-modal-message').textContent.includes('설치를 시작했습니다'));
  assert.deepEqual(errors,[]);
  console.log('PASS: persisted dropdowns, special single-only, conditional sub role, changing date columns, fixed titlebar dimensions, about/update states');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
