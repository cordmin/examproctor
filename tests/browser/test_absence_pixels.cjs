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
            await page.goto(pathToFileURL(path.join(__dirname, '..', '..', 'src','index.html')).href);
            await page.evaluate(() => {
                sanitizeAppData(appData);
                appData.config.grades = [2, 3];
                appData.config.classes = {2: 12, 3: 11};
                appData.periods = Array.from({length: 9}, (_, i) => ({id: `p${i}`, date: `2026-04-${28 + Math.floor(i / 3)}`, name: `${i % 3 + 1}교시`}));
                appData.teachers = Array.from({length: 50}, (_, i) => ({id: `t${i}`, name: `교사${i}`, absences: Object.fromEntries(appData.periods.map(p => [p.id, {type: 'GRADE', target: String(2 + i % 2)}]))}));
                showTab('tab-absences');
                closePageHint();
            });
            for (const [width, height] of [[1024, 640], [1183, 800], [1280, 720], [1365, 850], [1439, 900], [1500, 900], [1536, 864], [1600, 1000], [1920, 1080], [2544, 1376]]) {
                await page.setViewportSize({width, height});
                // 동기화 함수를 수동 호출하지 않고 실제 화면의 ResizeObserver 처리를 기다린다.
                await page.waitForTimeout(85);
                await check(page, dpr);
                tested++;
            }
            await page.setViewportSize({width: 1280, height: 800});
            for (const left of [0, 90]) {
                await page.locator('#absence-table-scroll').evaluate((el, left) => {
                    el.scrollLeft = left;
                    el.scrollTop = 200;
                }, left);
                await page.waitForTimeout(85);
                await check(page, dpr);
            }
            await page.close();
        }
        console.log(`PASS: ${tested} absence viewport/DPI combinations; aligned painted borders and scrolling`);
    } finally {
        await browser.close();
    }
})();

async function check(page, dpr) {
    const m = await page.evaluate(() => {
        const rows = document.getElementById('absence-list-head').rows;
        const heads = [...rows[0].cells].slice(0, 3).concat([...rows[1].cells], [rows[0].cells[rows[0].cells.length - 1]]);
        const cells = [...document.querySelector('#absence-list-body tr').cells];
        const scroll = document.getElementById('absence-table-scroll').getBoundingClientRect();
        return {
            heads: heads.map(e => e.getBoundingClientRect().right),
            cells: cells.map(e => e.getBoundingClientRect().right),
            headY: rows[1].cells[0].getBoundingClientRect().top + 3,
            bodyY: scroll.top + 3,
            left: scroll.left, right: scroll.right - 10,
            colors: [...document.querySelectorAll('#tab-absences .split-column-lines span')].map(el => getComputedStyle(el).backgroundColor.match(/\d+/g).map(Number)),
        };
    });
    const labelsFit = await page.locator('#absence-list-body tr').first().locator('[data-absence-teacher]').evaluateAll(buttons => buttons.every(button => {
        const range = document.createRange(); range.selectNodeContents(button);
        const text = range.getBoundingClientRect(), box = button.getBoundingClientRect();
        return text.left >= box.left - .1 && text.right <= box.right + .1 && button.scrollWidth <= button.clientWidth;
    }));
    assert.ok(labelsFit, 'Grade absence labels must fit inside their buttons');
    assert.equal(m.heads.length, m.cells.length);
    assert.ok(m.heads.every((x, i) => Math.abs(x - m.cells[i]) < .05), JSON.stringify(m));
    const png = PNG.sync.read(await page.screenshot());
    function paintedLine(x, y, color) {
        const center = Math.round(x * dpr);
        const at = j => [...png.data.slice((Math.floor(y * dpr) * png.width + j) * 4, (Math.floor(y * dpr) * png.width + j) * 4 + 3)];
        const samples = Array.from({length: 15}, (_, i) => {
            const j = center - 12 + i, rgb = at(j);
            return {j, distance: rgb.reduce((sum, value, k) => sum + (value - color[k]) ** 2, 0)};
        });
        const best = Math.min(...samples.map(s => s.distance));
        assert.ok(best < 6000, `No visible border at ${x}, ${y}, dpr=${dpr}, best=${best}, color=${color}`);
        return samples.filter(s => s.distance <= best + 30).map(s => s.j);
    }
    for (const [i, x] of m.heads.slice(0, -1).entries()) {
        if (x <= m.left + 5 || x >= m.right) continue;
        const headPixels = paintedLine(x, m.headY, m.colors[i]), bodyPixels = paintedLine(x, m.bodyY, m.colors[i]);
        const center = pixels => pixels.reduce((sum, p) => sum + p, 0) / pixels.length;
        assert.ok(headPixels.some(p => bodyPixels.includes(p)) && Math.abs(center(headPixels) - center(bodyPixels)) <= .5, JSON.stringify({dpr, x, headPixels, bodyPixels}));
    }
}
