const assert=require('node:assert/strict');const path=require('node:path');const {pathToFileURL}=require('node:url');const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const deviceScaleFactor of [1,1.25,1.5]){
  const context=await browser.newContext({deviceScaleFactor});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
  await page.evaluate(()=>{
   sanitizeAppData(appData);appData.config.grades=[1,2,3];
   appData.periods=Array.from({length:12},(_,i)=>({id:`p${i}`,date:`2026-10-${26+Math.floor(i/3)}`,name:`${i%3+1}교시`}));
   appData.teachers=Array.from({length:50},(_,i)=>({id:`T${i}`,name:`교사${i}`,isMain:true,isSub:true,isHallway:true,isSeparated:true,isSpecial:true,isClass1:true,isClass2:true,isClass3:true}));
   appData.assignments=Object.fromEntries(appData.teachers.map((t,i)=>[t.id,Object.fromEntries(appData.periods.map(p=>[p.id,`${i%3+1}-${Math.floor(i/3)+1}(정)`]))]));
   appData.classSubjects={p0:{1:'국어',2:'수학',3:'자습'}};
   showTab('tab-result');
  });
  for(const [width,height] of [[1024,640],[1280,800],[1365,850],[1500,900],[1536,864],[1600,1000],[2544,1376]]){
   await page.setViewportSize({width,height});
   for(const view of ['result-teacher','result-class']){
    await page.locator(`.result-sub-btn[data-target="${view}"]`).click();
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{syncResultHeaders();requestAnimationFrame(resolve)})));
    const header=page.locator(`#${view} .result-table-header`),scroll=page.locator(`#${view} .result-table-scroll`);
    assert.equal(await header.locator('thead tr').nth(1).locator('.result-period-title').first().textContent(),'1교시');
    const overflow=await scroll.evaluate(el=>el.scrollWidth-el.clientWidth);
    assert.ok(overflow<=1,JSON.stringify({view,width,height,overflow}));
    const check=await page.locator(`#${view}`).evaluate(container=>{
     const head=container.querySelector('thead'),body=container.querySelector('tbody'),scroll=container.querySelector('.result-table-scroll'),wrapper=container.querySelector('.result-table-header');
     const periodHeads=[...head.rows[1].cells].slice(-12);const bodyCells=[...body.rows[0].cells].slice(-12);
     const dates=[...head.rows[0].cells].slice(-4);
     return {seam:Math.abs(wrapper.getBoundingClientRect().bottom-scroll.getBoundingClientRect().top),offsets:periodHeads.map((h,i)=>Math.abs(h.getBoundingClientRect().right-bodyCells[i].getBoundingClientRect().right)),thick:dates.every((date,i)=>getComputedStyle(date).borderRightWidth===getComputedStyle(bodyCells[(i+1)*3-1]).borderRightWidth),splitLine:scroll.classList.contains('has-head')};
    });
    assert.ok(check.seam<.05 && check.offsets.every(offset=>offset<.05),JSON.stringify({view,width,height,deviceScaleFactor,check}));assert.equal(check.thick,true);assert.equal(check.splitLine,false);
    await scroll.evaluate(el=>el.scrollTop=0);
    const clip=await header.evaluate(el=>{const r=el.getBoundingClientRect(),d=devicePixelRatio,x=Math.ceil(r.left*d)/d,y=Math.ceil(r.top*d)/d;return{x,y,width:Math.floor(r.right*d)/d-x,height:(Math.floor(r.bottom*d)-1)/d-y}});
    const before=await page.screenshot({clip});await scroll.evaluate(el=>el.scrollTop=300);const after=await page.screenshot({clip});
    assert.ok(before.equals(after),JSON.stringify({view,width,height,deviceScaleFactor,issue:'Header changed while scrolling'}));
   }
  }
  await page.setViewportSize({width:1280,height:800});
  await page.locator('.result-sub-btn[data-target="result-teacher"]').click();
  await page.evaluate(()=>{window.pywebview={api:{check_manual_assignment:async()=>({valid:true}),revalidate:async()=>({success:true,validation:{}})}};});
  const old=await page.evaluate(()=>[appData.assignments.T0.p0,appData.assignments.T1.p0]);
  const transfer=await page.evaluateHandle(()=>new DataTransfer());
  await page.locator('[data-cell="T0|p0"]').dispatchEvent('dragstart',{dataTransfer:transfer});
  await page.locator('[data-cell="T1|p0"]').dispatchEvent('drop',{dataTransfer:transfer});
  await page.locator('#swap-modal').waitFor({state:'visible'});
  await page.locator('#swap-modal').getByRole('button',{name:'교체 실행',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>[appData.assignments.T0.p0,appData.assignments.T1.p0]),old.reverse());
  await page.locator('[data-cell="T0|p0"]').click({button:'right'});
  await page.locator('#rightclick-swap-modal').waitFor({state:'visible'});
  await page.keyboard.press('Escape');
  assert.deepEqual(errors,[]);
  if(deviceScaleFactor===1)await page.screenshot({path:path.join(require('node:os').tmpdir(),'exam-result-header-fixed.png')});
  await context.close();
 }
 console.log('PASS: both result headers, exact column alignment at 7 sizes x 3 pixel ratios, no bleed, continuous date boundaries, no subject labels, drag/drop and right-click swap');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
