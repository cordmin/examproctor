const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(pathToFileURL(path.join(__dirname, '..', '..', 'src', 'index.html')).href);
        await page.evaluate(() => {
            sanitizeAppData(appData);
            appData.config.grades = [2];
            appData.config.classes = { 2: 80 };
            appData.periods = [{ id: 'p1', date: '2026-11-10', name: '1교시' }];
            appData.teachers = Array.from({ length: 80 }, (_, i) => ({ id: `T${i}`, name: `교사${i}`, absences: {} }));
            appData.assignments = Object.fromEntries(appData.teachers.map((t, i) => [t.id, { p1: `2-${i + 1}(정)` }]));
            window.pywebview = { api: { check_manual_assignment: async () => ({ valid: true }) } };
            showTab('tab-result');
        });
        const original = await page.evaluate(() => structuredClone(appData.assignments));
        for (const view of ['result-teacher', 'result-grade-2']) {
            await page.locator(`.result-sub-btn[data-target="${view}"]`).click();
            const scroll = page.locator(`#${view} .result-table-scroll`);
            const source = page.locator(`#${view} [data-swap-teacher="T0"]`);
            const a = await source.boundingBox(), box = await scroll.boundingBox();
            const x = a.x + a.width / 2, middle = box.y + box.height / 2;
            const top = box.y + 5, bottom = box.y + box.height - 5;
            await page.mouse.move(x, a.y + a.height / 2);
            await page.mouse.down();
            await page.mouse.move(x + 6, a.y + a.height / 2);
            await page.mouse.move(x, bottom);
            await page.waitForTimeout(80);
            assert.equal(await scroll.evaluate(el => el.scrollTop), 0, `${view}: edge entry must not scroll immediately`);
            await page.waitForTimeout(650);
            const down = await scroll.evaluate(el => el.scrollTop);
            assert.ok(down > 60 && down < 300, `${view}: moderate downward scroll ${down}`);
            assert.equal(await page.evaluate(({ x, y }) => {
                const hit = document.elementFromPoint(x, y)?.closest('[data-swap-teacher]');
                return hit === document.querySelector('.assign-drop-ready');
            }, { x, y: bottom }), true, 'Target must refresh underneath a stationary pointer');
            await page.mouse.move(x, middle);
            const stopped = await scroll.evaluate(el => el.scrollTop);
            await page.waitForTimeout(250);
            assert.equal(await scroll.evaluate(el => el.scrollTop), stopped, 'Center must stop scrolling');
            await page.mouse.move(x, top);
            await page.waitForTimeout(80);
            assert.equal(await scroll.evaluate(el => el.scrollTop), stopped, 'Reverse edge must have a new delay');
            await page.waitForTimeout(650);
            assert.ok(await scroll.evaluate(el => el.scrollTop) < stopped, 'Top edge must scroll upward');
            await page.keyboard.press('Escape');
            await page.mouse.up();
            const canceled = await scroll.evaluate(el => el.scrollTop);
            await page.waitForTimeout(250);
            assert.equal(await scroll.evaluate(el => el.scrollTop), canceled, 'Cancel must stop the animation loop');
            assert.equal(await page.locator('.assign-drag-card').count(), 0);
            assert.deepEqual(await page.evaluate(() => appData.assignments), original);
            await scroll.evaluate(el => el.scrollTop = 0);
            const again = await source.boundingBox();
            await page.mouse.move(x, again.y + again.height / 2);
            await page.mouse.down();
            await page.mouse.move(x + 6, again.y + again.height / 2);
            await page.mouse.move(x, bottom);
            await page.waitForTimeout(450);
            await page.mouse.up();
            await page.locator('#swap-modal').waitFor({ state: 'visible' });
            const released = await scroll.evaluate(el => el.scrollTop);
            await page.waitForTimeout(250);
            assert.equal(await scroll.evaluate(el => el.scrollTop), released, 'Drop must stop scrolling');
            assert.deepEqual(await page.evaluate(() => appData.assignments), original, 'Confirmation is still required');
            await page.locator('#swap-modal').getByRole('button', { name: '취소', exact: true }).click();
        }
        assert.deepEqual(errors, []);
        console.log('PASS: both views, delayed gentle up/down autoscroll, stationary-pointer target refresh, center/cancel/drop stop, confirmation preserved');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
