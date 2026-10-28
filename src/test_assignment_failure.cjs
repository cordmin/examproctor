const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
  await page.evaluate(()=>{sanitizeAppData(appData);renderSidebar();});
  const modal=page.locator('#assignment-failure-modal');
  await page.evaluate(()=>showToast('확인 메시지'));
  const toast=page.locator('#toast-notification');
  assert.equal(await toast.evaluate(el=>el.classList.contains('-translate-y-10')),false);
  await page.waitForFunction(()=>getComputedStyle(document.getElementById('toast-notification')).opacity==='1');
  assert.ok((await toast.boundingBox()).y<100);
  await page.evaluate(()=>{clearTimeout(toastTimeout);document.getElementById('toast-notification').classList.add('opacity-0');});
  for(const mode of ['CAPACITY','CONSTRAINT','UNKNOWN','REJECTED']) {
   await page.evaluate(mode=>{
    window.pywebview={api:{run_algorithm:async()=>{
     if(mode==='REJECTED')throw Error('연결 끊김');
     return mode==='UNKNOWN'?{success:false,error:'<img src=x onerror=alert(1)>',error_type:mode}:{success:false,error_type:mode,failure:{summary:mode==='CAPACITY'?'총 감독 횟수가 5회 부족합니다.':'1교시 정감독 권한이 없습니다.',reasons:[{message:'원인 확인',action:'감독 명단의 해당 권한을 확인하세요.',target:'tab-teachers'}]}};
    }}};
    document.getElementById('btn-rules-run').click();
   },mode);
   await modal.waitFor({state:'visible'});
   assert.ok((await page.locator('#assignment-failure-summary').textContent()).length>0);
   assert.ok((await page.locator('#assignment-failure-reasons').textContent()).length>0);
   assert.equal(await page.locator('#assignment-failure-reasons img').count(),0);
   assert.equal(await page.locator('#btn-rules-run').isDisabled(),false);
   await page.keyboard.press('Tab');
   assert.equal(await modal.locator('button').first().evaluate(el=>el===document.activeElement),true);
   await page.keyboard.press('Shift+Tab');
   assert.equal(await modal.locator('button').last().evaluate(el=>el===document.activeElement),true);
   await page.keyboard.press('Escape');
   assert.equal(await modal.isVisible(),false);
  }
  await page.evaluate(()=>openAssignmentFailure({failure:{summary:'확인',reasons:[{message:'권한',action:'체크하세요',target:'tab-teachers'}]}}));
  await modal.getByRole('button',{name:'감독 명단 확인'}).click();
  assert.equal(await page.locator('#tab-teachers').isVisible(),true);
  assert.equal(await modal.isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: top toast, failure modal, rejection handling, escaped errors, keyboard focus, settings navigation');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
