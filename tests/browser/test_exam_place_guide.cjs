const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

(async () => {
    const browser = await chromium.launch({channel: 'msedge', headless: true});
    try {
        const page = await browser.newPage({viewport: {width: 1280, height: 800}});
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => {
            window.pywebview = {api: {
                is_maximized: async () => false,
                get_initial_data: async () => null,
                get_version: async () => 'test',
                check_update: async () => ({available: false}),
                get_settings: async () => ({hideTour: true, ...JSON.parse(sessionStorage.getItem('test-settings') || '{}')}),
                set_setting: async (key, value) => {
                    const settings = JSON.parse(sessionStorage.getItem('test-settings') || '{}');
                    settings[key] = value;
                    sessionStorage.setItem('test-settings', JSON.stringify(settings));
                    return {success: true};
                },
            }};
        });
        const start = async () => {
            await page.evaluate(() => window.dispatchEvent(new Event('pywebviewready')));
            await page.waitForFunction(() => document.getElementById('app-version').textContent === 'vtest');
        };
        await page.goto(pathToFileURL(path.join(__dirname, '../../src/index.html')).href);
        await start();
        const guide = page.locator('#exam-place-guide');
        assert.equal(await guide.isVisible(), true);
        await page.evaluate(() => {
            appData.config.grades = [2, 3];
            appData.config.classes = {1: 11, 2: 12, 3: 11};
            appData.config.special = {1: 0, 2: 1, 3: 1};
            appData.config.hallways = {1: 0, 2: 6, 3: 6};
            renderConfigTab();
        });
        for (const viewport of [{width: 1280, height: 800}, {width: 1024, height: 640}, {width: 1600, height: 1000}]) {
            await page.setViewportSize(viewport);
            await page.waitForTimeout(100);
            const geometry = await guide.evaluate(el => {
                const box = el.getBoundingClientRect();
                const cell = document.querySelector('#grade-row-1 td:nth-child(3)').getBoundingClientRect();
                return {left: Math.abs(box.left - cell.left), top: Math.abs(box.top - cell.top),
                    background: getComputedStyle(el).backgroundColor,
                    text: getComputedStyle(el.querySelector('p')).color,
                    button: getComputedStyle(el.querySelector('button')).backgroundColor};
            });
            assert.ok(geometry.left < 1 && geometry.top < 1, JSON.stringify(geometry));
            assert.equal(geometry.background, 'rgba(0, 0, 0, 0.75)');
            assert.equal(geometry.text, 'rgb(255, 255, 255)');
            assert.equal(geometry.button, 'rgb(245, 197, 107)');
        }
        await page.setViewportSize({width: 1280, height: 800});
        await page.locator('#exam-place-frame').screenshot({path: path.join(__dirname, '../../.local/test-artifacts/exam-place-guide.png')});
        assert.equal(await page.locator('#class-count-2').evaluate(el => el.closest('td').inert), true);
        await page.locator('#exam-place-enter').click();
        await page.waitForFunction(() => document.getElementById('exam-place-guide').hidden);
        await page.locator('#class-count-2').fill('10');
        await page.locator('#exam-name').focus();
        await page.evaluate(() => { showTab('tab-teachers'); showTab('tab-config'); });
        assert.equal(await guide.isVisible(), false);
        await page.reload();
        await start();
        assert.equal(await guide.isVisible(), false, 'Acknowledgement survives restarting and loading data');
        await page.locator('[data-action="reset"]').click();
        await page.locator('#confirm-modal-cancel').click();
        assert.equal(await guide.isVisible(), false, 'Canceling reset preserves acknowledgement');
        await page.locator('[data-action="reset"]').click();
        await page.locator('#confirm-modal-btn').click();
        await page.waitForFunction(() => !document.getElementById('exam-place-guide').hidden);
        await page.reload();
        await start();
        assert.equal(await guide.isVisible(), true, 'Full reset restores the guide across restarts');
        await page.evaluate(() => { window.pywebview.api.set_setting = async () => ({success: false}); });
        await page.locator('#exam-place-enter').click();
        assert.equal(await guide.isVisible(), true, 'Failed persistence must not dismiss the guide');
        assert.deepEqual(errors, []);
        console.log('PASS: guide geometry, amber/75% styling, input gating, persistence, full reset and save failure');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
