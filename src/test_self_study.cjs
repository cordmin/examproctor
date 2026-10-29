const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(pathToFileURL(path.join(__dirname, 'index.html')).href);
        await page.evaluate(() => {
            sanitizeAppData(appData);
            appData.config.subjects = ["자습", "국어", "영어", "수학", "사회", "역사", "과학"];
            appData.config.grades = [1, 2, 3];
            appData.periods = [{ id: 'p1', date: '2026-10-28', name: '1교시' }];
            renderSubjects(); renderSubjectsTab();
        });
        const pinned = page.locator('#subject-list > div').first();
        assert.equal(await pinned.textContent(), '수업');
        assert.equal(await pinned.locator('button').count(), 0);
        assert.equal(await pinned.evaluate(el => getComputedStyle(el).paddingLeft === getComputedStyle(el).paddingRight && getComputedStyle(el).justifyContent === 'center'), true);
        const badgeWidths = await page.locator('#subject-list > div').evaluateAll(badges => badges.slice(0, 2).map(badge => badge.getBoundingClientRect().width));
        assert.ok(Math.abs(badgeWidths[0] - badgeWidths[1]) < 1, 'Self-study and two-character subject badges must have equal widths');
        assert.equal(await pinned.evaluate(el => el.classList.contains('bg-surface-200')), true);
        const selects = page.locator('#subject-tables-container .grade-subject-btn');
        assert.equal(await selects.count(), 3);
        await selects.nth(0).click();
        const menu = page.locator('#grade-subject-menu');
        assert.equal(await menu.isVisible(), true);
        assert.deepEqual(await menu.locator('button').allTextContents(), ['선택', '수업', '국어', '영어', '수학', '사회', '역사', '과학']);
        assert.equal(await menu.evaluate(el => getComputedStyle(el).borderRadius), '8px');
        const centerOffsets = await menu.locator('button').evaluateAll(options => options.map(option => {
            const range = document.createRange(); range.selectNodeContents(option);
            const text = range.getBoundingClientRect(); const box = option.parentElement.getBoundingClientRect();
            return Math.abs(text.x + text.width / 2 - box.x - box.width / 2);
        }));
        assert.ok(centerOffsets.every(offset => offset < 1), JSON.stringify(centerOffsets));
        await menu.getByRole('option', { name: '수업', exact: true }).click();
        await selects.nth(1).click();
        await menu.getByRole('option', { name: '국어', exact: true }).click();
        assert.deepEqual(await page.evaluate(() => appData.classSubjects.p1), { '1': '자습', '2': '국어' });
        assert.equal(await selects.nth(2).textContent(), '선택');
        await selects.nth(2).focus();
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        assert.equal(await selects.nth(2).textContent(), '수업');
        await selects.nth(0).click();
        await page.keyboard.press('Escape');
        assert.equal(await menu.isVisible(), false);
        await selects.nth(0).click();
        await page.locator('#new-subject').click();
        assert.equal(await menu.isVisible(), false);
        await page.evaluate(() => { removeSubject('자습'); renderSubjects(); renderSubjects(); });
        assert.equal(await page.evaluate(() => appData.config.subjects.filter(s => s === '자습').length), 1);
        await page.evaluate(() => {
            const oldData = { config: { subjects: ['수업', '국어'] } };
            sanitizeAppData(oldData);
            if (oldData.config.subjects.join(',') !== '수업,국어') throw Error('Existing subjects must be preserved');
        });
        assert.deepEqual(errors, []);
        console.log('PASS: pinned grey subject, no deletion/duplicates, optional grade selections, existing data');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
