const assert=require('node:assert/strict');const path=require('node:path');const {pathToFileURL}=require('node:url');const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:2});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
 await page.evaluate(()=>{sanitizeAppData(appData);renderConfigTab();markDataSaved();window.calls=[];window.pywebview={api:{cancel_close:async()=>calls.push('cancel'),finish_close:async(save,data)=>{calls.push({save,data:structuredClone(data)});return window.closeResult || {success:true};},set_setting:async()=>({success:true})}};});
 const ids=['rules-modal','assignment-failure-modal','event-modal','swap-modal','rightclick-swap-modal','about-modal','update-modal','confirm-modal','close-modal','tour'];
 for(const id of ids){
  await page.evaluate(id=>{document.getElementById(id).classList.remove('hidden');if(id==='confirm-modal')confirmCallback=()=>{};},id);
  await page.waitForTimeout(180);
  const button=page.locator(`#${id} .modal-close`);assert.equal(await button.count(),1,id);
  assert.equal(await button.locator('use').getAttribute('href'),'#i-x',id);
  const size=await button.boundingBox();assert.ok(Math.abs(size.width-24)<.1 && Math.abs(size.height-24)<.1,id);
  await button.hover();await page.waitForTimeout(180);
  const color=await button.evaluate(e=>getComputedStyle(e,'::before').backgroundColor);
  assert.notEqual(color,'rgba(0, 0, 0, 0)',id);
  await button.click();assert.equal(await page.locator('#'+id).isVisible(),false,id);
 }
 await page.evaluate(()=>{appData.config.examName='변경';requestClose();});
 assert.deepEqual(await page.locator('#close-modal > div > div:last-child button').allTextContents(),['저장 후 종료','저장 없이 종료','취소']);
 await page.keyboard.press('Escape');assert.equal(await page.locator('#close-modal').isVisible(),false);
 await page.evaluate(()=>requestClose());await page.locator('#close-cancel').click();assert.equal(await page.locator('#close-modal').isVisible(),false);
 await page.evaluate(()=>{requestClose();window.closeResult={success:false,canceled:true};});
 await page.locator('#close-save').click();await page.waitForFunction(()=>document.getElementById('close-modal').dataset.busy==='false');
 assert.equal(await page.locator('#close-modal').isVisible(),true);assert.equal(await page.evaluate(()=>appData.config.examName),'변경');
 await page.evaluate(()=>window.closeResult={success:false,error:'저장 오류'});await page.locator('#close-save').click();await page.waitForFunction(()=>document.getElementById('close-modal').dataset.busy==='false');assert.equal(await page.locator('#close-modal').isVisible(),true);
 await page.evaluate(()=>window.closeResult={success:true});await page.locator('#close-save').click();await page.waitForFunction(()=>document.getElementById('close-modal').dataset.busy==='false');
 assert.equal(await page.evaluate(()=>calls.at(-1).save),true);assert.equal(await page.evaluate(()=>calls.at(-1).data.config.examName),'변경');
 await page.locator('#close-discard').click();await page.waitForFunction(()=>document.getElementById('close-modal').dataset.busy==='false');assert.equal(await page.evaluate(()=>calls.at(-1).save),false);
 await page.waitForTimeout(200);await page.locator('#close-modal > div').screenshot({path:path.join(__dirname,'../artifacts/save-close-applied.png')});
 await page.locator('#close-modal .modal-close').click();
 await page.locator('#sidebar-nav [data-action="reset"]').click();await page.waitForTimeout(200);await page.locator('#confirm-modal > div').screenshot({path:path.join(__dirname,'../artifacts/reset-modal-applied.png')});
 await page.locator('#confirm-modal .modal-close').click();assert.equal(await page.evaluate(()=>confirmCallback),null);
 assert.deepEqual(errors,[]);console.log('PASS: all 10 dialogs use main-window X, close and cancel cleanup; exact exit labels; Escape cancels; canceled/failed save stays open; save/discard routes verified');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
