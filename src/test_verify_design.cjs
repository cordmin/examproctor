const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {pathToFileURL}=require('node:url');const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
 const data=JSON.parse(fs.readFileSync(path.join(__dirname,'시험감독_배정결과(예시).json'),'utf8'));
 await page.evaluate(data=>{appData=data;sanitizeAppData(appData);showTab('tab-validate')},data);
 assert.equal(await page.locator('.verify-row').count(),11);
 assert.equal(await page.locator('.verify-review').count(),1);
 const clean=await page.evaluate(()=>({sidebar:document.getElementById('sidebar').outerHTML,stats:document.querySelector('#stats-scroll').outerHTML}));
 await page.screenshot({path:path.join(__dirname,'../artifacts/validation-applied.png')});
 await page.locator('.verify-review').screenshot({path:path.join(__dirname,'../artifacts/validation-card.png')});
 await page.evaluate(()=>{const c=appData.validation.verify.checks[0];c.pass=false;c.messages=['교사 확인'];c.targets=[['t1','p1']];c.fix='감독 권한을 확인하세요.';c.fix_target='tab-teachers';appData.validation.verify.all_pass=false;renderValidateTab()});
 assert.equal(await page.locator('.verify-row.is-failed').count(),1);
 assert.ok((await page.locator('.verify-score').textContent()).includes('10'));
 assert.equal(await page.locator('.verify-row.is-failed [onclick^="jumpToCell"]').count(),1);
 await page.locator('.verify-row.is-failed button').click();assert.equal(await page.locator('#tab-teachers').isVisible(),true);
 await page.evaluate(()=>{window.pywebview={api:{get_version:async()=>'1.0.7',check_update:async()=>({available:false,status:'development'})}};document.getElementById('app-version').textContent='v1.0.7';openAboutModal()});
 await page.waitForFunction(()=>!document.getElementById('about-check').disabled);
 assert.ok((await page.locator('#titlebar').textContent()).includes('시험감독 배정'));
 assert.ok(!(await page.locator('#titlebar').textContent()).includes('프로그램'));
 assert.equal(await page.locator('.about-description').textContent(),'제작: 아산배방중학교 교사 이경민');
 for(const status of ['latest','development','unconfigured','error','new']){
  await page.evaluate(status=>{window.pywebview.api.check_update=async()=>status==='new'?{available:true,version:'v1.0.8'}:{available:false,status};checkAboutUpdate()},status);
  await page.waitForFunction(()=>!document.getElementById('about-check').disabled);
  const fits=await page.locator('.about-description,.about-credit,#about-update-status').evaluateAll(els=>els.every(e=>e.scrollWidth<=e.clientWidth));assert.equal(fits,true,status);
 }
 await page.evaluate(()=>{window.pywebview.api.check_update=async()=>({available:false,status:'development'});checkAboutUpdate()});await page.waitForFunction(()=>!document.getElementById('about-check').disabled);
 await page.locator('.about-panel').screenshot({path:path.join(__dirname,'../artifacts/about-refined.png')});
 await page.keyboard.press('Escape');await page.evaluate(()=>{startTour();tourIndex=TOUR_STEPS.length-1;placeTour()});
 assert.equal(await page.evaluate(()=>TOUR_STEPS.at(-1).el),'#app-version');
 assert.equal(await page.locator('#tour').isVisible(),true);
 assert.ok((await page.locator('#tour').textContent()).includes('업데이트 상태'));
 await page.screenshot({path:path.join(__dirname,'../artifacts/tour-version.png')});
 await page.goto(pathToFileURL(path.join(__dirname,'../artifacts/motto-font-preview.html')).href);await page.setViewportSize({width:1050,height:455});await page.screenshot({path:path.join(__dirname,'../artifacts/motto-font-preview.png')});
 assert.deepEqual(errors,[]);console.log('PASS: 11 checks, failure details and navigation, concise title, author credit, unwrapped update states, version tour');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
