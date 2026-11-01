const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        for (const deviceScaleFactor of [1, 1.25, 1.5]) {
            const page = await browser.newPage({ deviceScaleFactor });
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.goto(pathToFileURL(path.join(__dirname, 'index.html')).href);
            await page.evaluate(() => {
                sanitizeAppData(appData);
                appData.config.subjects = ['국어'];
                appData.config.grades = [2, 3];
                appData.config.classes = {2: 3, 3: 3};
                appData.periods = [{id: 'p1', date: '2026-04-30', name: '1교시'}];
                appData.teachers = Array.from({length: 30}, (_, i) => ({id: `t${i}`, name: `교사${i}`}));
            });
            for (const [width, height] of [[1024, 640], [1365, 850], [1920, 1080]]) {
                await page.setViewportSize({width, height});
                for (const [tab, text] of [['tab-config', '자습으로 활용 가능'], ['tab-absences', '시험 기간 중 감독 배정 시간의 최대값을 설정']]) {
                    await page.evaluate(() => showTab('tab-teachers'));
                    await page.locator(`[data-target="${tab}"]`).click();
                    const hint = page.locator('#page-hint');
                    await page.waitForTimeout(50);
                    assert.equal(await hint.isVisible(), true);
                    assert.equal(await hint.textContent(), text);
                    await page.locator('#titlebar').hover();
                    assert.equal(await hint.isVisible(), true, 'Moving the cursor away must keep the entry hint open');
                    const geometry = await hint.evaluate(el => {
                        const target = document.querySelector(`[aria-describedby="${el.id}"]`);
                        const box = el.getBoundingClientRect();
                        const anchor = document.createRange(); anchor.selectNodeContents(target);
                        const source = target.id === 'absence-limit-label' ? anchor.getBoundingClientRect() : target.getBoundingClientRect();
                        const zoom = parseFloat(document.documentElement.style.zoom) || 1;
                        const range = document.createRange(); range.selectNodeContents(el.querySelector('span'));
                        const shape = el.querySelector('path');
                        return {below: box.top > source.bottom, close: Math.abs((box.top - source.bottom) / zoom - 9) < .1, fits: box.left >= 0 && box.right <= innerWidth && box.bottom <= innerHeight,
                            lines: range.getClientRects().length, fill: shape.getAttribute('fill'), border: shape.getAttribute('stroke'), paths: el.querySelectorAll('path').length};
                    });
                    assert.deepEqual(geometry, {below: true, close: true, fits: true, lines: 1, fill: '#FFFFFF', border: '#526580', paths: 1});
                    if (tab === 'tab-config') {
                        // This dropdown stops event propagation; dismissal must still work.
                        await page.locator('.grade-subject-btn').first().click();
                    } else {
                        await page.locator('#absence-list-body [data-absence-teacher]').first().click();
                    }
                    assert.equal(await hint.isVisible(), false);
                    await page.locator(tab === 'tab-config' ? '#class-subject-badge' : '#absence-list-head [data-page-hint]').hover();
                    assert.equal(await hint.isVisible(), true, 'Hovering must reopen a dismissed hint');
                    await page.locator('#titlebar').hover();
                    assert.equal(await hint.isVisible(), false, 'Moving away must close a hover tooltip');
                    await page.evaluate(tab => tab === 'tab-config' ? renderConfigTab() : renderAbsencesTab(), tab);
                    assert.equal(await hint.isVisible(), false, 'Data rendering must not reopen a dismissed hint');
                    await page.locator(`[data-target="${tab}"]`).click();
                    assert.equal(await hint.isVisible(), false, 'Clicking the current page navigation must not reopen the hint');
                }
            }
            if (deviceScaleFactor === 1) {
                for (const tab of ['tab-config', 'tab-absences']) {
                    await page.locator('#titlebar').hover();
                    await page.evaluate(() => showTab('tab-teachers'));
                    await page.evaluate(tab => showTab(tab), tab);
                    await page.waitForTimeout(2700);
                    assert.equal(await page.locator('#page-hint').isVisible(), true);
                    assert.equal(await page.locator('#page-hint').evaluate(el => el.classList.contains('is-fading')), false);
                    await page.waitForFunction(() => {
                        const opacity = parseFloat(getComputedStyle(document.getElementById('page-hint')).opacity);
                        return opacity > 0 && opacity < 1;
                    });
                    await page.waitForFunction(() => document.getElementById('page-hint').hidden);
                    await page.locator(tab === 'tab-config' ? '#class-subject-badge' : '#absence-limit-label').hover();
                    assert.equal(await page.locator('#page-hint').isVisible(), true);
                    if (tab === 'tab-config') {
                        await page.waitForTimeout(3400);
                        assert.equal(await page.locator('#page-hint').isVisible(), true, 'A hovered hint must stay visible');
                    }
                    await page.locator('#titlebar').hover();
                    assert.equal(await page.locator('#page-hint').isVisible(), false);
                }
            }
            assert.deepEqual(errors, []);
            await page.close();
        }
        console.log('PASS: 3-second entry fade, hover reopening and persistence, click dismissal, single-line style at 9 size/DPI combinations');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
