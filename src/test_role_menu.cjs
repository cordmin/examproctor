// 실행: node src/test_role_menu.cjs (playwright와 Microsoft Edge 필요)
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(pathToFileURL(path.join(__dirname, 'index.html')).href);
        await page.evaluate(() => {
            appData.config = { ...appData.config, grades: [1, 2, 3], classes: { 1: 1, 2: 1, 3: 1 }, hallways: { 1: 1 }, separated: { 1: 1 }, special: { 1: 1 } };
            appData.teachers = [{ id: 'A', name: '교사1', absences: {}, isMain: true }, { id: 'B', name: '교사2', absences: {}, isMain: false }];
            showTab('tab-teachers');
        });
        assert.equal(await page.locator('#tab-teachers thead tr').count(), 1);
        assert.equal(await page.locator('#tab-teachers thead input[type=checkbox]').count(), 0);
        assert.deepEqual(await page.locator('#tab-teachers thead th').allTextContents().then(labels => labels.slice(1, 4)), ['이름', '담당교과', '담임학급']);
        const widths = await page.locator('#tab-teachers thead th').evaluateAll(cells => cells.slice(1, 4).map(cell => cell.getBoundingClientRect().width));
        assert.ok(widths.every(width => Math.abs(width - widths[0]) < 1));
        const nameFits = await page.locator('#teacher-list-body tr:first-child input').first().evaluate(input => {
            input.value = '남궁민수';
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            const style = getComputedStyle(input);
            context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
            return { text: context.measureText(input.value).width, available: input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) };
        });
        assert.ok(nameFits.text <= nameFits.available, JSON.stringify(nameFits));
        const triggers = page.locator('.role-menu-btn');
        assert.equal(await triggers.count(), 8);
        for (let i = 0; i < 8; i++) {
            const trigger = triggers.nth(i);
            const role = (await trigger.getAttribute('onclick')).match(/'(is\w+)'/)[1];
            const before = await page.evaluate(() => structuredClone(appData.teachers));
            for (const checked of [true, false]) {
                await trigger.click();
                assert.equal(await page.locator('#role-menu').isVisible(), true);
                const arrow = await trigger.boundingBox();
                const menu = await page.locator('#role-menu').boundingBox();
                assert.ok(Math.abs(menu.x + menu.width / 2 - arrow.x - arrow.width / 2) < 1, JSON.stringify({ role, arrow, menu }));
                assert.ok(menu.y >= arrow.y + arrow.height);
                assert.ok(menu.width < 108);
                assert.equal(await page.locator('#role-menu button').first().evaluate(el => getComputedStyle(el).textAlign), 'center');
                await page.locator(`#role-menu [data-checked="${checked}"]`).click();
                assert.equal(await page.locator('#role-menu').isVisible(), false);
                const teachers = await page.evaluate(() => appData.teachers);
                teachers.forEach((teacher, index) => assert.deepEqual(teacher, { ...before[index], [role]: checked }));
            }
        }
        await triggers.first().click();
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#role-menu').isVisible(), false);
        assert.equal(await triggers.first().getAttribute('aria-expanded'), 'false');
        await triggers.first().click();
        await page.locator('#tab-teachers th').first().click();
        assert.equal(await page.locator('#role-menu').isVisible(), false);
        await triggers.first().click();
        await page.evaluate(() => document.querySelector('#tab-teachers .overflow-auto').dispatchEvent(new Event('scroll')));
        assert.equal(await page.locator('#role-menu').isVisible(), false);
        await page.locator('#teacher-list-body input[type=checkbox]').first().check();
        assert.equal(await page.evaluate(() => appData.teachers[0].isMain), true);
        assert.equal(await page.evaluate(() => appData.teachers[1].isMain), false);
        await page.evaluate(() => { appData.teachers = []; renderTeachers(); });
        await triggers.first().click();
        await page.locator('#role-menu [data-checked="true"]').click();
        assert.deepEqual(errors, []);
        console.log('PASS: 8 role menus, bulk selection/cancellation, individual selection, dismissal, empty list');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });

