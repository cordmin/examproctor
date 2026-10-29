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
        await page.reload();
        await page.evaluate(() => {
            window.updateCalls = 0;
            window.checkCalls = 0;
            window.pywebview = {api: {
                get_version: async () => '1.0.9',
                check_update: async () => { window.checkCalls++; return {available: false, status: 'latest'}; },
                install_update: () => {
                    window.updateCalls++;
                    return new Promise(resolve => { window.finishUpdate = resolve; });
                }
            }};
            openAboutModal();
        });
        const check = page.locator('#about-check');
        await page.getByText('현재 최신 버전을 사용하고 있습니다.', {exact: true}).waitFor();
        assert.equal(await page.locator('#about-install').count(), 0);
        assert.equal(await page.getByText('현재 버전에서 업데이트 내역을 확인합니다.', {exact: true}).count(), 0);
        assert.equal(await page.locator('#about-update-status').evaluate(el => getComputedStyle(el).fontWeight), '700');
        await page.evaluate(() => {
            window.pywebview.api.check_update = async () => {
                window.checkCalls++;
                return {available: true, current: 'v1.0.9', version: 'v1.0.10'};
            };
        });
        await check.click();
        await page.waitForFunction(() => document.getElementById('about-check').textContent === '업데이트 받기');
        assert.equal(await page.evaluate(() => window.updateCalls), 0);
        await check.click();
        assert.equal(await page.locator('#about-modal').isVisible(), false);
        assert.equal(await page.locator('#update-download-progress').isVisible(), true);
        assert.equal(await page.evaluate(() => window.updateCalls), 1);
        assert.equal(await page.evaluate(() => window.checkCalls), 2);
        await page.evaluate(() => window.finishUpdate({success: false, error: '다운로드 실패'}));
        await page.getByRole('button', {name: '다시 시도', exact: true}).waitFor();
        await ok.click();
        await page.evaluate(() => window.finishUpdate({success: true}));
        await page.waitForFunction(() => document.getElementById('update-modal-message').textContent.includes('설치를 시작했습니다'));
        console.log('PASS: download notice, duplicate prevention, Escape guard, failure notice and retry');
        console.log('PASS: single about button checks, becomes download, installs directly, and supports retry');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
