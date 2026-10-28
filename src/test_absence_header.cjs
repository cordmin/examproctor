const assert=require('node:assert/strict');const path=require('node:path');const {pathToFileURL}=require('node:url');const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const deviceScaleFactor of [1,1.25,1.5]){
  const context=await browser.newContext({deviceScaleFactor});const page=await context.newPage();
  await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
  await page.evaluate(()=>{sanitizeAppData(appData);appData.config.grades=[1,2,3];appData.config.classes={1:3,2:3,3:3};appData.periods=Array.from({length:12},(_,i)=>({id:`p${i}`,date:`2026-10-${26+Math.floor(i/3)}`,name:`${i%3+1}교시`}));appData.teachers=Array.from({length:50},(_,i)=>({id:`T${i}`,name:`교사${i}`,absences:Object.fromEntries(appData.periods.map(p=>[p.id,{type:'ALL',target:''}]))}));showTab('tab-absences');});
  for(const periodCount of [9,12]){
   await page.evaluate(count=>{appData.periods=Array.from({length:count},(_,i)=>({id:`p${i}`,date:`2026-10-${26+Math.floor(i/3)}`,name:`${i%3+1}교시`}));renderAbsencesTab();},periodCount);
  for(const [width,height] of [[1024,640],[1280,800],[1365,850],[1500,900],[1536,864],[1600,1000],[2544,1376]]){
   await page.setViewportSize({width,height});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{const s=document.getElementById('absence-table-scroll');s.scrollTop=0;s.scrollLeft=0;syncAbsenceHeader();requestAnimationFrame(resolve)})));
   await page.waitForTimeout(100);
   const overflow=await page.locator('#absence-table-scroll').evaluate(el=>el.scrollWidth-el.clientWidth);
   assert.ok(overflow<=1,JSON.stringify({width,height,deviceScaleFactor,periodCount,overflow}));
   const clip=await page.locator('#absence-table-header').evaluate(el=>{
    const r=el.getBoundingClientRect(),d=devicePixelRatio;
    const x=Math.ceil(r.left*d)/d,y=Math.ceil(r.top*d)/d;
    return {x,y,width:Math.floor(r.right*d)/d-x,height:(Math.floor(r.bottom*d)-1)/d-y};
   });
   const before=await page.screenshot({clip});
   await page.locator('#absence-table-scroll').evaluate(el=>el.scrollTop=400);
   const after=await page.screenshot({clip});
   assert.ok(before.equals(after),JSON.stringify({width,height,deviceScaleFactor,issue:'Header pixels changed while vertical scrolling'}));
   for(const scrollLeft of [0,140]){
    const check=await page.evaluate(left=>{
     const scroll=document.getElementById('absence-table-scroll');scroll.scrollLeft=left;syncAbsenceHeader();
     const header=document.getElementById('absence-table-header');const rows=document.getElementById('absence-list-head').rows;
     const heads=[...rows[0].cells].slice(0,3).concat([...rows[1].cells],[rows[0].cells[rows[0].cells.length-1]]);
     const cells=[...document.querySelector('#absence-list-body tr').cells];
     return {seam:Math.abs(header.getBoundingClientRect().bottom-scroll.getBoundingClientRect().top),offsets:heads.map((head,i)=>Math.abs(head.getBoundingClientRect().right-cells[i].getBoundingClientRect().right)),background:getComputedStyle(document.getElementById('absence-list-head')).backgroundColor,splitLine:scroll.classList.contains('has-head')};
    },scrollLeft);
    assert.ok(check.seam<.1 && check.offsets.every(offset=>offset<.05),JSON.stringify({width,height,deviceScaleFactor,check}));
    assert.equal(check.background,'rgb(241, 245, 249)');assert.equal(check.splitLine,false);
    const borderMatch=await page.evaluate(()=>{
     const dates=[...document.querySelectorAll('#absence-list-head th[colspan]')];
     const periods=[...document.getElementById('absence-list-head').rows[1].cells];
     const cells=[...document.querySelector('#absence-list-body tr').cells];
     let count=0;
     return dates.every(date=>{
      count+=date.colSpan;
      const a=getComputedStyle(date),b=getComputedStyle(periods[count-1]),c=getComputedStyle(cells[count+2]);
      return a.borderRightWidth===c.borderRightWidth && b.borderRightWidth===c.borderRightWidth && a.borderRightColor===c.borderRightColor && b.borderRightColor===c.borderRightColor;
     });
    });
    assert.equal(borderMatch,true,'Date boundaries must match the body through both header rows');

    const widths=await page.locator('#absence-list-body tr').first().locator('td').evaluateAll(cells=>cells.slice(3,-1).map(cell=>cell.getBoundingClientRect().width));
    assert.equal(widths.length,periodCount);
    assert.ok(Math.max(...widths)-Math.min(...widths)<1,JSON.stringify(widths));

   }
  }
  }
  if(deviceScaleFactor===1)await page.screenshot({path:path.join(require('node:os').tmpdir(),'exam-absence-header-fixed.png')});
  await context.close();
 }
 console.log('PASS: opaque two-row header during scrolling; equal responsive period widths with no horizontal scroll for 3/4 days at 7 window sizes x 3 pixel ratios; aligned header and body');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
