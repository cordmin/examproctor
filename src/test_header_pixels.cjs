const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    let tested = 0;
    try {
        for (const dpr of [1, 1.25, 1.5, 1.75, 2]) {
            const page = await browser.newPage({ deviceScaleFactor: dpr });
            await page.goto(pathToFileURL(path.join(__dirname, 'index.html')).href);
            await page.evaluate(() => {
                sanitizeAppData(appData);
                Object.assign(appData.config, {
                    grades: [1, 2, 3], classes: {1: 3, 2: 3, 3: 3},
                    hallways: {1: 1}, special: {1: 1}, separated: {1: 1},
                });
                appData.teachers = Array.from({length: 40}, (_, i) => ({id: `t${i}`, name: `교사${i}`}));
                showTab('tab-teachers');
            });
            for (const width of [1024, 1183, 1280, 1327, 1365, 1439, 1501, 1537, 1673, 1920]) {
                await page.setViewportSize({width, height: Math.round(width * .625)});
                // 동기화 함수를 수동 호출하지 않고 실제 화면의 ResizeObserver 처리를 기다린다.
                await page.waitForTimeout(85);
                await check(page, dpr);
                tested++;
            }
            await page.setViewportSize({width: 1280, height: 800});
            for (const left of [0, 90]) {
                await page.locator('#teacher-list-scroll').evaluate((el, left) => {
                    el.scrollLeft = left;
                    el.scrollTop = 200;
                }, left);
                await page.waitForTimeout(85);
                await check(page, dpr);
            }
            await page.evaluate(() => {
                appData.config.grades = [2, 3];
                appData.config.hallways = appData.config.special = appData.config.separated = {};
                appData.config.invigCounts = {2: {class: 1}, 3: {class: 1}};
                renderTeachers();
            });
            await page.waitForTimeout(85);
            await check(page, dpr);
            await page.screenshot({path: path.join(__dirname, '../artifacts/teacher-lines-fixed.png')});
            await page.close();
        }
        console.log(`PASS: ${tested} viewport/DPI combinations; continuous painted borders, scrolling and hidden roles`);
    } finally {
        await browser.close();
    }
})();

async function check(page, dpr) {
    const m = await page.evaluate(() => {
        const heads = [...document.querySelectorAll('#teacher-list-header th')].filter(e => e.offsetWidth);
        const cells = [...document.querySelector('#teacher-list-body tr').cells];
        const scroll = document.getElementById('teacher-list-scroll').getBoundingClientRect();
        return {
            heads: heads.map(e => e.getBoundingClientRect().right),
            cells: cells.map(e => e.getBoundingClientRect().right),
            headY: heads[0].getBoundingClientRect().top + 3,
            bodyY: scroll.top + 3,
            left: scroll.left, right: scroll.right - 10,
            color: getComputedStyle(document.querySelector('.teacher-column-lines span')).backgroundColor.match(/\d+/g).map(Number),
        };
    });
    assert.equal(m.heads.length, m.cells.length);
    assert.ok(m.heads.every((x, i) => Math.abs(x - m.cells[i]) < .05), JSON.stringify(m));
    const png = PNG.sync.read(await page.screenshot());
    function paintedLine(x, y) {
        const center = Math.round(x * dpr);
        const at = j => [...png.data.slice((Math.floor(y * dpr) * png.width + j) * 4, (Math.floor(y * dpr) * png.width + j) * 4 + 3)];
        const bg = at(center - 4);
        const vector = m.color.map((v, i) => v - bg[i]);
        const denominator = vector.reduce((sum, v) => sum + v * v, 0);
        const samples = Array.from({length: 7}, (_, i) => {
            const j = center - 4 + i, rgb = at(j);
            return {j, ink: rgb.reduce((sum, v, k) => sum + (v - bg[k]) * vector[k], 0) / denominator};
        });
        const peak = Math.max(...samples.map(s => s.ink));
        assert.ok(peak > .3, `No visible border at ${x}, ${y}`);
        return samples.filter(s => s.ink >= peak - .05).map(s => s.j);
    }
    for (const x of m.heads.slice(0, -1).filter(x => x > m.left + 5 && x < m.right)) {
        assert.deepEqual(paintedLine(x, m.headY), paintedLine(x, m.bodyY), JSON.stringify({dpr, x, m}));
    }
}
