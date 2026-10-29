const assert=require('node:assert/strict');const path=require('node:path');const {pathToFileURL}=require('node:url');const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const [width,height] of [[1024,640],[1280,800],[1600,1000]]){
  const page=await browser.newPage({viewport:{width,height}});await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
  await page.evaluate(()=>{window.pywebview={api:{get_version:async()=>'1.2.3',check_update:async()=>({available:false,status:'development'}),install_update:()=>new Promise(resolve=>window.resolveInstall=resolve)}};openAboutModal();});await page.waitForFunction(()=>!document.getElementById('about-check').disabled);
  const bounds=locator=>locator.evaluate(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]});
  const about=page.locator('.about-panel');const original=await bounds(about);
  for(const status of ['latest','error','development']){
   await page.evaluate(()=>window.pywebview.api.check_update=()=>new Promise(resolve=>window.resolveCheck=resolve));
   await page.locator('#about-check').click();assert.deepEqual(await bounds(about),original,'Pending update check changes modal geometry');
   await page.evaluate(status=>window.resolveCheck({available:false,status}),status);await page.waitForFunction(()=>!document.getElementById('about-check').disabled);
   assert.deepEqual(await bounds(about),original,`Status ${status} changes modal geometry`);
  }
  await page.locator('#about-modal .modal-close').click();
  await page.evaluate(()=>askUpdate({current:'v1.2.2',version:'v1.2.3'}));await page.waitForTimeout(180);
  const update=page.locator('#update-modal > div');const before=await bounds(update);
  await page.locator('#update-modal-ok').click();assert.deepEqual(await bounds(update),before,'Download changes modal geometry');
  await page.evaluate(()=>window.resolveInstall({success:false,error:'테스트 다운로드 실패'}));await page.waitForFunction(()=>!document.getElementById('update-modal-ok').disabled);
  assert.deepEqual(await bounds(update),before,'Failure changes modal geometry');
  await page.locator('#update-modal-ok').click();await page.evaluate(()=>window.resolveInstall({success:true}));await page.waitForFunction(()=>document.getElementById('update-modal-message').textContent.includes('설치를 시작했습니다'));
  assert.deepEqual(await bounds(update),before,'Success changes modal geometry');await page.close();
 }
 console.log('PASS: about check idle/pending/latest/error and update ready/downloading/retry/success keep identical modal bounds at 3 window sizes');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
