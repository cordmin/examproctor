const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({channel: 'msedge', headless: true});
    try {
        const page = await browser.newPage();
        await page.goto(pathToFileURL(path.join(__dirname, '..', '..', 'src','index.html')).href);
        await page.evaluate(() => {
            sanitizeAppData(appData);
            appData.config.grades = [2, 3];
            showTab('tab-result');
        });
        for (const [width, height] of [[1024, 640], [1365, 850], [1920, 1080]]) {
            await page.setViewportSize({width, height});
            const buttons = page.locator('#result-view-btns button');
            for (const button of await buttons.all()) {
                await button.focus();
                const metrics = el => {
                    const range = document.createRange(); range.selectNodeContents(el);
                    const r = range.getBoundingClientRect(), s = getComputedStyle(el);
                    return [r.x, r.y, r.width, r.height, s.scale, s.translate, s.filter];
                };
                const before = await button.evaluate(metrics);
                await page.keyboard.down('Space');
                // Sample while the press animation is running, including release/selection.
                for (let frame = 0; frame < 8; frame++) {
                    await page.evaluate(() => new Promise(requestAnimationFrame));
                    assert.deepEqual(await button.evaluate(metrics), before);
                }
                const pressed = await button.evaluate(el => ({
                    translate: getComputedStyle(el, '::before').translate,
                    scale: getComputedStyle(el, '::before').scale,
                }));
                assert.deepEqual(pressed, {translate: '0px 2px', scale: '0.98'});
                await page.keyboard.up('Space');
                for (let frame = 0; frame < 10; frame++) {
                    await page.evaluate(() => new Promise(requestAnimationFrame));
                    assert.deepEqual(await button.evaluate(metrics), before);
                }
                const target = await button.getAttribute('data-target');
                assert.equal(await page.locator(`#${target}`).isVisible(), true);
                assert.match(await button.evaluate(el => getComputedStyle(el, '::before').backgroundColor), /^rgba?\(30, 41, 59(?:, 1)?\)$/);
            }
        }
        console.log('PASS: stable text throughout press/release; animated background and working result views at 3 window sizes');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
