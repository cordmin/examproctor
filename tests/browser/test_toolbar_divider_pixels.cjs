const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const samples = [];
    try {
        for (const dpr of [1, 1.25, 1.5]) {
            const page = await browser.newPage({ deviceScaleFactor: dpr });
            await page.goto(pathToFileURL(path.join(__dirname, '..', '..', 'src', 'index.html')).href);
            await page.evaluate(() => {
                sanitizeAppData(appData);
                appData.config.grades = [1, 2, 3];
                appData.config.classes = { 1: 10, 2: 10, 3: 10 };
                appData.teachers = [{ id: 'A', name: '교사', absences: {} }];
                appData.periods = [{ id: 'p1', date: '2026-04-28', name: '1교시' }];
                appData.assignments = { A: { p1: '2-1(정)' } };
            });
            for (const width of [1024, 1280, 1365, 1464, 1920]) {
                await page.setViewportSize({ width, height: 950 });
                await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
                for (const tab of ['tab-absences', 'tab-result']) {
                    await page.evaluate(target => showTab(target), tab);
                    await page.evaluate(() => new Promise(requestAnimationFrame));
                    const box = await page.locator(`#${tab} .toolbar-hint-group`).boundingBox();
                    const file = path.join(require('node:os').tmpdir(), `line-${dpr}-${width}-${tab}.png`);
                    await page.screenshot({ path: file });
                    samples.push({ dpr, width, tab, file, x: box.x, y: box.y + box.height / 2 });
                }
            }
            await page.close();
        }
        fs.writeFileSync(path.join(require('node:os').tmpdir(), 'line-samples.json'), JSON.stringify(samples));
        const check = require('node:child_process').spawnSync('python', ['-c', `
from PIL import Image
import json,os,math
samples=json.load(open(os.path.join(os.environ['TEMP'],'line-samples.json')))
for i in range(0,len(samples),2):
    widths=[]
    for r in samples[i:i+2]:
        im=Image.open(r['file']).convert('RGB')
        left=round(r['x']*r['dpr'])-2
        y=round(r['y']*r['dpr'])
        widths.append(sum(im.getpixel((x,y))!=(30,41,59) for x in range(left,left+10)))
    assert widths[0]==widths[1], (samples[i]['dpr'],samples[i]['width'],widths)
    assert widths[0]==math.floor(2*samples[i]['dpr']+.5), (samples[i]['dpr'],samples[i]['width'],widths)
print('PASS: identical rendered separator thickness at 5 widths x 3 DPI settings')
`], { encoding: 'utf8' });
        assert.equal(check.status, 0, check.stderr);
        console.log(check.stdout.trim());
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
