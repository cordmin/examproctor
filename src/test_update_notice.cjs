const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
(async () => {
    const browser = await chromium.launch({channel: 'msedge', headless: true});
    try {
        const page = await browser.newPage();
        await page.goto(pathToFileURL(path.join(__dirname, 'index.html')).href);
        await page.evaluate(() => {
            window.updateCalls = 0;
            window.pywebview = {api: {install_update: () => {
                window.updateCalls++;
                return new Promise(resolve => { window.finishUpdate = resolve; });
            }}};
            askUpdate({current: '1.0.4', version: '1.0.5'});
        });
        const modal = page.locator('#update-modal');
        const ok = page.locator('#update-modal-ok');
        const later = page.locator('#update-modal-later');
        await ok.click();
        assert.equal(await ok.isDisabled(), true);
        assert.equal(await later.isDisabled(), true);
        assert.equal(await page.locator('#update-download-progress').isVisible(), true);
        await page.keyboard.press('Escape');
        assert.equal(await modal.isVisible(), true);
        await page.evaluate(() => {
            askUpdate({current: '1.0.4', version: '1.0.5'});
            document.getElementById('update-modal-ok').onclick();
            window.finishUpdate({success: false, error: '테스트 다운로드 실패'});
        });
        await page.waitForFunction(() => !document.getElementById('update-modal-ok').disabled);
        assert.equal(await page.evaluate(() => window.updateCalls), 1);
        assert.match(await modal.textContent(), /테스트 다운로드 실패/);
        assert.equal(await page.locator('#update-download-progress').isVisible(), false);
        await ok.click();
        await page.evaluate(() => window.finishUpdate({success: true}));
        await page.waitForFunction(() => document.getElementById('update-modal-message').textContent.includes('설치를 시작했습니다'));
        assert.equal(await modal.isVisible(), true);
        assert.equal(await ok.isDisabled(), true);
        assert.equal(await page.evaluate(() => window.updateCalls), 2);
        console.log('PASS: download notice, duplicate prevention, Escape guard, failure notice and retry');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
