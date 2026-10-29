const assert=require('node:assert/strict');const path=require('node:path');const {pathToFileURL}=require('node:url');const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);await page.evaluate(()=>{sanitizeAppData(appData);renderConfigTab();});
 for(const [width,height] of [[1024,640],[1280,800],[1600,1000]]){
  await page.setViewportSize({width,height});
  const positions=await page.locator('#sidebar-nav button').evaluateAll(buttons=>buttons.map(button=>({icon:button.querySelector('svg').getBoundingClientRect().x,text:button.querySelector('span').getBoundingClientRect().x,width:button.querySelector('span').getBoundingClientRect().width})));
  positions.forEach(position=>assert.deepEqual(position,positions[0]));
  assert.equal(await page.locator('#sidebar-nav button').first().evaluate(el=>getComputedStyle(el).columnGap),'11px');
 }
 await page.setViewportSize({width:1280,height:800});const selected=page.locator('#sidebar-nav [data-target="tab-config"]');
 await selected.focus();await page.keyboard.down('Space');await page.waitForTimeout(90);assert.equal(await selected.evaluate(el=>getComputedStyle(el).translate),'0px 2px');await page.keyboard.up('Space');await page.waitForTimeout(160);
 assert.equal(await selected.evaluate(el=>getComputedStyle(el).translate),'none');assert.equal(await page.locator('#tab-config').isVisible(),true);assert.ok((await selected.getAttribute('class')).includes('bg-[#2563EB]'));
 await page.locator('#sidebar-nav [data-action="reset"]').click();await page.waitForTimeout(180);const close=page.locator('#confirm-modal .modal-close');const transform=await close.evaluate(el=>getComputedStyle(el).transform);const box=await close.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(80);
 assert.equal(await close.evaluate(el=>getComputedStyle(el).translate),'0px 2px');assert.equal(await close.evaluate(el=>getComputedStyle(el).transform),transform);await page.mouse.move(10,10);await page.mouse.up();
 await page.evaluate(()=>document.getElementById('confirm-modal-btn').disabled=true);const disabled=page.locator('#confirm-modal-btn');await disabled.dispatchEvent('pointerdown');assert.equal(await disabled.evaluate(el=>getComputedStyle(el).translate),'none');
 await page.keyboard.press('Escape');assert.equal(await page.locator('#confirm-modal').isVisible(),false);
 console.log('PASS: equal sidebar icon/text positions at 3 sizes, mouse/Space press and release, active menu preserved, existing X positioning preserved, disabled button unchanged');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
