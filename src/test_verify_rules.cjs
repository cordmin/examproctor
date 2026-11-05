const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(pathToFileURL(path.join(__dirname, 'index.html')).href);
        const sample = JSON.parse(fs.readFileSync(path.join(__dirname, '시험감독_배정결과(예시).json'), 'utf8'));
        await page.evaluate(data => {
            appData = data;
            sanitizeAppData(appData);
            appData.config.rules = { ...DEFAULT_RULES, excludeHomeroom: false, excludeSubject: false, excludeClassConsecutive: false };
            appData.teachers.forEach(t => t.maxPeriods = 0);
            appData.validation.verify.checks.forEach(c => { delete c.enabled; c.pass = true; c.messages = []; });
            showTab('tab-validate');
        }, sample);
        assert.equal(await page.locator('.verify-row').count(), 4, 'Legacy files hide disabled rules');
        await page.evaluate(() => {
            appData.validation.verify.checks.forEach(c => c.enabled = true);
            renderValidateTab();
        });
        assert.equal(await page.locator('.verify-row').count(), 11, 'Saved applied rules survive config changes');
        const names = await page.locator('.verify-rule-name').allTextContents();
        assert.ok(names.every(n => !/[()]/.test(n)));
        assert.deepEqual(names.slice(6), ['교사별 배정 제한 준수', '1일 감독 횟수 편차 제한', '1일 연속 감독 횟수 제한', '동일 학급 연속 배정 금지', '수업·복도감독 연속 배정 금지']);
        assert.deepEqual(await page.locator('.verify-number').allTextContents(), Array.from({ length: 11 }, (_, i) => String(i + 1).padStart(2, '0')));
        assert.equal(await page.locator('.verify-number').first().evaluate(el => getComputedStyle(el).color), 'rgb(71, 85, 105)');
        await page.evaluate(() => {
            const checks = appData.validation.verify.checks;
            checks[6].enabled = false;
            checks[6].pass = false;
            checks[9].pass = false;
            checks[9].messages = ['배정 제한 초과'];
            checks[9].targets = [['t1', '']];
            renderValidateTab();
        });
        assert.equal(await page.locator('.verify-row').count(), 10);
        assert.equal(await page.locator('.verify-row.is-failed').count(), 1);
        assert.match(await page.locator('.verify-score').textContent(), /9\s*\/ 10/);
        assert.equal(await page.locator('.verify-row.is-failed [onclick^="jumpToCell"]').count(), 1);
        assert.deepEqual(errors, []);
        console.log('PASS: legacy filtering, saved applied rules, grouped order, concise labels, readable numbering, counts and violation links');
    } finally {
        await browser.close();
    }
})().catch(e => { console.error(e); process.exitCode = 1; });
