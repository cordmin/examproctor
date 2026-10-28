const assert=require('node:assert/strict');const path=require('node:path');const {pathToFileURL}=require('node:url');const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
 await page.evaluate(()=>{sanitizeAppData(appData);appData.config.grades=[1,2,3];appData.config.classes={1:3,2:3,3:3};appData.periods=[{id:'p1',date:'2026-10-28',name:'1교시'}];appData.teachers=[{id:'T0',name:'교사0',absences:{}},{id:'T1',name:'교사1',absences:{}}];showTab('tab-absences');});
 const cell=(row=0)=>page.locator('#absence-list-body tr').nth(row).locator('td').nth(3).locator('button');
 const brush=grade=>page.locator(`#brush-toolbar [data-type="GRADE"][data-target="${grade}"]`);
 const erase=async()=>{const box=await cell().boundingBox();await cell().click({button:'right',position:{x:box.width*.75,y:box.height/2}});};
 const absence=()=>page.evaluate(()=>appData.teachers[0].absences.p1);
 for(const grade of [2,3]){
  await brush(grade).click();
  const first=await cell().boundingBox(),second=await cell(1).boundingBox();
  await page.mouse.move(first.x+first.width/2,first.y+first.height/2);await page.mouse.down();
  await page.mouse.move(second.x+second.width/2,second.y+second.height/2,{steps:4});await page.mouse.up();
 }
 assert.deepEqual(await absence(),{type:'GRADE',target:['2','3']});
 assert.deepEqual(await page.evaluate(()=>appData.teachers[1].absences.p1),{type:'GRADE',target:['2','3']});
 assert.equal(await cell().textContent(),'결시');
 assert.match(await cell().getAttribute('aria-label'),/2학년·3학년/);
 const gradient=await cell().evaluate(el=>el.style.backgroundImage);
 assert.match(gradient,/50%/);assert.match(gradient,/5, 150, 105/);assert.match(gradient,/37, 99, 235/);
 await cell().click();assert.deepEqual(await absence(),{type:'GRADE',target:['2','3']});
 await erase();assert.deepEqual(await absence(),{type:'GRADE',target:'2'});
 assert.equal(await cell().evaluate(el=>el.style.backgroundImage),'');
 await brush(3).click();await cell().click();
 await page.evaluate(()=>{appData=JSON.parse(JSON.stringify(appData));renderAbsencesTab();});
 assert.equal(await cell().evaluate(el=>el.style.backgroundImage),gradient);
 await brush(1).click();await cell().click();assert.deepEqual(await absence(),{type:'GRADE',target:['1','2','3']});
 await cell().click({button:'right',position:{x:4,y:10}});assert.deepEqual(await absence(),{type:'GRADE',target:['2','3']});
 await page.locator('#brush-toolbar [data-type="ALL"]').click();await cell().click();assert.equal((await absence()).type,'ALL');
 await brush(2).click();await cell().click();assert.equal((await absence()).type,'ALL');
 await erase();assert.equal(await absence(),undefined);
 await page.locator('#brush-toolbar [data-type="ALL"]').click();await erase();assert.equal(await absence(),undefined);
 await brush(2).click();await cell().click();await erase();assert.equal(await absence(),undefined);
 await page.screenshot({path:path.join(require('node:os').tmpdir(),'exam-multi-grade-absence.png')});
 assert.deepEqual(errors,[]);console.log('PASS: cumulative drag painting, equal split colors, label, selective removal, save/load, all-absence handling');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
