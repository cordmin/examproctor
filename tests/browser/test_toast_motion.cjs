const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage();
        await page.goto(pathToFileURL(path.join(__dirname, '..', '..', 'src','index.html')).href);
        await page.waitForFunction(() => getComputedStyle(document.getElementById('toast-notification')).opacity === '0');
        await page.waitForTimeout(350);
        for (const width of [1024, 1500]) {
            await page.setViewportSize({ width, height: 900 });
            const frames = await page.evaluate(async () => {
                const toast = document.getElementById('toast-notification');
                const samples = [];
                const sample = () => {
                    const r = toast.getBoundingClientRect();
                    samples.push({ center: r.x + r.width / 2, y: r.y, opacity: Number(getComputedStyle(toast).opacity) });
                };
                const waitFrames = async count => {
                    for (let i = 0; i < count; i++) {
                        await new Promise(requestAnimationFrame);
                        sample();
                    }
                };
                showToast('최종 배정 결과를 재검증 중입니다...');
                await waitFrames(2);
                showToast('재검증이 완료되었습니다!');
                await waitFrames(24);
                toast.classList.add('-translate-y-10', 'opacity-0', 'pointer-events-none');
                await waitFrames(24);
                showToast('배정 결과 재검증이 완료되었습니다.');
                sample();
                await waitFrames(8);
                showToast('확인이 필요한 규칙이 있습니다. 배정 결과 검증 내용을 확인하세요.', 'error');
                sample();
                await waitFrames(24);
                clearTimeout(toastTimeout);
                toast.classList.add('-translate-y-10', 'opacity-0', 'pointer-events-none');
                await waitFrames(24);
                return samples;
            });
            const drift = Math.max(...frames.map(f => Math.abs(f.center - width / 2)));
            assert.ok(drift < 1, `Toast drifts horizontally at width ${width}: ${drift}px`);
            assert.ok(Math.max(...frames.map(f => f.y)) - Math.min(...frames.map(f => f.y)) > 10);
            assert.ok(frames.some(f => f.opacity > 0.1 && f.opacity < 0.9));
        }
        console.log('PASS: centered toast throughout entry, exit and changing messages; vertical motion and fade preserved');
    } finally {
        await browser.close();
    }
})().catch(e => { console.error(e); process.exitCode = 1; });
