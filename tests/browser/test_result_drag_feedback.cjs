const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(pathToFileURL(path.join(__dirname, '..', '..', 'src', 'index.html')).href);
        await page.evaluate(() => {
            sanitizeAppData(appData);
            appData.config.grades = [2];
            appData.config.classes = { 2: 8 };
            appData.periods = ['p1', 'p2'].map((id, i) => ({ id, date: '2026-11-10', name: `${i + 1}교시` }));
            appData.teachers = ['A', 'B'].map((id, i) => ({ id, name: ['김도윤', '이서연'][i], absences: {} }));
            appData.assignments = { A: { p1: '2-8(정)' }, B: { p1: '2-7(부)' } };
            window.pywebview = { api: { check_manual_assignment: async () => ({ valid: true }) } };
            showTab('tab-result');
        });
        const original = await page.evaluate(() => structuredClone(appData.assignments));
        for (const width of [1024, 1920]) {
            await page.setViewportSize({ width, height: 850 });
            for (const view of ['result-teacher', 'result-grade-2']) {
                await page.locator(`.result-sub-btn[data-target="${view}"]`).click();
                const cells = view === 'result-teacher'
                    ? [page.locator('[data-cell="A|p1"]'), page.locator('[data-cell="B|p1"]')]
                    : [page.locator('#result-grade-2 .swap-name').filter({ hasText: '김도윤' }), page.locator('#result-grade-2 .swap-name').filter({ hasText: '이서연' })];
                const transfer = await page.evaluateHandle(() => new DataTransfer());
                await cells[0].dispatchEvent('dragstart', { dataTransfer: transfer, clientX: 300, clientY: 250 });
                const card = page.locator('.assign-drag-card');
                assert.equal(await card.isVisible(), true);
                assert.deepEqual(await card.evaluate(el => { const s = getComputedStyle(el); return [s.opacity, s.backgroundColor, s.pointerEvents]; }), ['0.85', 'rgb(255, 255, 255)', 'none']);
                await cells[0].dispatchEvent('dragover', { dataTransfer: transfer });
                assert.equal(await page.locator('.assign-drop-ready').count(), 0, 'Source cannot be its own target');
                if (view === 'result-teacher') {
                    await page.locator('[data-cell="B|p2"]').dispatchEvent('dragover', { dataTransfer: transfer });
                    assert.equal(await page.locator('.assign-drop-ready').count(), 0, 'Other periods cannot show a ready target');
                }
                await cells[1].dispatchEvent('dragover', { dataTransfer: transfer, clientX: 500, clientY: 350 });
                assert.equal(await cells[1].evaluate(el => el.classList.contains('assign-drop-ready')), true);
                assert.equal(await page.locator('.assign-drop-hint').count(), 0);
                assert.deepEqual(await page.evaluate(() => appData.assignments), original, 'Hover must not change assignments');
                await cells[1].dispatchEvent('drop', { dataTransfer: transfer });
                await page.locator('#swap-modal').waitFor({ state: 'visible' });
                assert.equal(await page.locator('.assign-drag-card, .assign-drop-hint, .assign-drop-ready, .assign-drag-source').count(), 0);
                assert.deepEqual(await page.evaluate(() => appData.assignments), original, 'Drop must wait for modal confirmation');
                await page.locator('#swap-modal').getByRole('button', { name: '취소', exact: true }).click();
                await cells[0].dispatchEvent('dragstart', { dataTransfer: transfer });
                await cells[1].dispatchEvent('dragover', { dataTransfer: transfer });
                await cells[0].dispatchEvent('dragend', { dataTransfer: transfer });
                assert.equal(await page.locator('.assign-drag-card, .assign-drop-ready, .assign-drag-source').count(), 0, 'Canceled drag must clean up');
            }
        }
        await page.locator('.result-sub-btn[data-target="result-teacher"]').click();
        const source = await page.locator('[data-cell="A|p1"]').boundingBox();
        const target = await page.locator('[data-cell="B|p1"]').boundingBox();
        await page.evaluate(() => { window.nativeAssignmentDrags = 0; document.addEventListener('dragstart', () => nativeAssignmentDrags++); });
        await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
        await page.mouse.down();
        await page.mouse.move(source.x + source.width / 2 + 8, source.y + source.height / 2, { steps: 4 });
        await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 10 });
        await page.locator('.assign-drop-ready').waitFor({ state: 'visible' });
        assert.equal(await page.locator('.assign-drag-card').isVisible(), true, 'Real mouse drag must show the custom card');
        assert.equal(await page.locator('.assign-drag-card').count(), 1);
        assert.equal(await page.locator('.assign-drag-card').evaluate(el => getComputedStyle(el).transform), 'none');
        assert.equal(await page.evaluate(() => nativeAssignmentDrags), 0, 'Pointer drag must never create the translucent native ghost');
        const preview = await page.locator('.assign-drag-card').boundingBox();
        assert.ok(Math.abs(preview.x + preview.width / 2 - target.x - target.width / 2) < 1 && Math.abs(preview.y + preview.height / 2 - target.y - target.height / 2) < 1, 'The grabbed center must stay attached to the cursor');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        assert.equal(await page.locator('.assign-drop-ready').evaluate(el => getComputedStyle(el).animationName), 'none');
        await page.screenshot({ path: path.join(require('node:os').tmpdir(), 'exam-result-drag-feedback.png') });
        await page.mouse.up();
        await page.locator('#swap-modal').waitFor({ state: 'visible' });
        assert.deepEqual(await page.evaluate(() => appData.assignments), original);
        await page.locator('#swap-modal').getByRole('button', { name: '취소', exact: true }).click();
        assert.equal(await page.locator('#btn-export-excel').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(22, 131, 74)');
        assert.deepEqual(errors, []);
        console.log('PASS: compact translucent drag card without hint, valid target feedback in both views at two widths, confirmation modal, cancel cleanup, green export');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
