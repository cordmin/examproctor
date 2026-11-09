// 가이드 투어, 화면별 안내, 말풍선 툴팁.

// ── 가이드 투어 ──────────────────────────────────────────────────────
// 일하는 순서대로 사이드바 버튼을 하나씩 밝히고 옆에 설명 카드를 띄운다.
// '다시 보지 않기'는 settings.json 의 hideTour 에 둔다 (main.py get_settings / set_setting).
const TOUR_STEPS = [
    { el: '[data-target="tab-config"]',   title: '1. 기초 설정',  text: '시험 날짜와 교시, 시험 보는 학년과 과목을 정합니다. 교실마다 감독을 몇 명 둘지도 여기서 정합니다.' },
    { el: '[data-target="tab-teachers"]', title: '2. 감독 명단',  text: '감독 들어가실 선생님을 설정합니다. 엑셀 양식으로 한꺼번에 불러올 수도 있고, 선생님마다 맡을 수 있는 감독을 체크합니다.' },
    { el: '[data-target="tab-absences"]', title: '3. 배정 제외',  text: '출장·수업 등으로 감독할 수 없는 시간을 표시합니다. 선생님별 배정 제한도 여기서 정합니다.' },
    { el: '[data-action="run"]',          title: '4. 배정 실행',  text: '배정 규칙을 확인하고 실행하면 감독이 자동으로 배정됩니다. 배정이 막히면 무엇부터 고치면 되는지 알려 줍니다.' },
    { el: '[data-target="tab-result"]',   title: '5. 배정 결과',  text: '선생님별·학급별 감독표를 봅니다. 칸을 끌어 놓거나 우클릭해서 선생님을 바꿀 수 있고, 엑셀로 내려받을 수 있습니다.' },
    { el: '[data-target="tab-validate"]', title: '6. 배정 검증',  text: '모든 규칙을 잘 지켰는지 확인합니다. 문제가 있으면 해결 방법과 바로 가기 버튼이 함께 나옵니다.' },
    { el: '#data-card',                   title: '7. 열기·저장', text: '작업한 내용을 파일로 저장하고, 다음에 다시 불러옵니다. 우측 상단에 도움말 버튼을 누르면 이 안내를 다시 볼 수 있습니다.' },
    { el: '[data-action="reset"]',         title: '8. 전체 초기화', text: '현재 작업의 모든 입력값과 배정 결과를 지웁니다. 필요한 자료를 먼저 저장한 뒤 사용하세요.' },
    { el: '#app-version',                 title: '9. 프로그램 정보·업데이트', text: '버전 번호를 누르면 프로그램 정보와 업데이트 상태를 확인할 수 있습니다.' },
];
let tourIndex = 0;
let tourHidden = false;   // 켤 때 shell.js 가 settings.json 에서 읽어 둔다

function placeTour() {
    const step = TOUR_STEPS[tourIndex];
    const zoom = parseFloat(document.documentElement.style.zoom) || 1;
    const r = document.querySelector(step.el).getBoundingClientRect();
    const pad = 4, spot = document.getElementById('tour-spot'), card = document.getElementById('tour-card');
    const x = r.left / zoom - pad, y = r.top / zoom - pad, w = r.width / zoom + pad * 2, h = r.height / zoom + pad * 2, rr = 12;
    Object.assign(spot.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    // 화면 전체 사각형 + 둥근 구멍 (evenodd 로 구멍만 비운다)
    document.getElementById('tour-mask').setAttribute('d', `M0 0H99999V99999H0Z M${x + rr} ${y}H${x + w - rr}A${rr} ${rr} 0 0 1 ${x + w} ${y + rr}V${y + h - rr}A${rr} ${rr} 0 0 1 ${x + w - rr} ${y + h}H${x + rr}A${rr} ${rr} 0 0 1 ${x} ${y + h - rr}V${y + rr}A${rr} ${rr} 0 0 1 ${x + rr} ${y}Z`);
    document.getElementById('tour-title').textContent = step.title;
    document.getElementById('tour-text').textContent = step.text;
    document.getElementById('tour-step').textContent = `${tourIndex + 1} / ${TOUR_STEPS.length}`;
    document.getElementById('tour-prev').classList.toggle('invisible', tourIndex === 0);
    document.getElementById('tour-next').textContent = tourIndex === TOUR_STEPS.length - 1 ? '시작하기' : '다음';
    // 모든 대상이 왼쪽 사이드바에 있으므로 오른쪽에 붙이고, 화면 밖으로 나가지 않게 위아래만 맞춘다.
    const maxTop = window.innerHeight / zoom - card.offsetHeight - 8;
    card.style.left = `${r.right / zoom + 16}px`;
    card.style.top = `${Math.max(40, Math.min(r.top / zoom - 8, maxTop))}px`;
}

window.startTour = function() {
    closeAppSelect();
    tourIndex = 0;
    document.getElementById('tour-hide').checked = tourHidden;
    document.getElementById('tour').classList.remove('hidden');
    placeTour();
    document.getElementById('tour-next').focus();
};

function closeTour() {
    document.getElementById('tour').classList.add('hidden');
    tourHidden = document.getElementById('tour-hide').checked;
    window.pywebview?.api.set_setting('hideTour', tourHidden);
}

function moveTour(delta) {
    tourIndex += delta;
    if (tourIndex >= TOUR_STEPS.length) closeTour();
    else placeTour();
}

document.getElementById('tour-next').onclick = () => moveTour(1);
document.getElementById('tour-prev').onclick = () => moveTour(-1);
document.getElementById('tour-skip').onclick = closeTour;
document.getElementById('tour').addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); closeTour(); }
    else if (event.key === 'ArrowRight') moveTour(1);
    else if (event.key === 'ArrowLeft' && tourIndex > 0) moveTour(-1);
});
window.addEventListener('resize', () => { if (!document.getElementById('tour').classList.contains('hidden')) placeTour(); });

// 페이지 진입 안내는 3초 뒤 사라지고, 대상에 커서를 올리면 다시 보인다.
const pageHint = document.createElement('div');
pageHint.id = 'page-hint';
pageHint.className = 'page-hint';
pageHint.setAttribute('role', 'tooltip');
pageHint.hidden = true;
const pageHintShape = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
pageHintShape.setAttribute('aria-hidden', 'true');
const pageHintOutline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
pageHintOutline.setAttribute('fill', '#FFFFFF');
pageHintOutline.setAttribute('stroke', '#526580');
pageHintOutline.setAttribute('stroke-width', '1');
pageHintShape.append(pageHintOutline);
const pageHintLabel = document.createElement('span');
pageHint.append(pageHintShape, pageHintLabel);
document.body.append(pageHint);
let pageHintSelector = null;
let pageHintMode = null;
let pageHintDismissTimer;
let pageHintFadeTimer;

function closePageHint() {
    clearTimeout(pageHintDismissTimer);
    clearTimeout(pageHintFadeTimer);
    if (pageHintSelector) document.querySelector(pageHintSelector)?.removeAttribute('aria-describedby');
    pageHintSelector = null;
    pageHintMode = null;
    pageHint.hidden = true;
    pageHint.classList.remove('is-fading');
}

function positionPageHint() {
    if (!pageHintSelector) return;
    const target = document.querySelector(pageHintSelector);
    if (!target || !target.getClientRects().length) { closePageHint(); return; }
    const zoom = parseFloat(document.documentElement.style.zoom) || 1;
    const rect = target.getBoundingClientRect();
    let anchorBottom = rect.bottom;
    if (target.id === 'absence-limit-label') {
        const text = document.createRange();
        text.selectNodeContents(target);
        anchorBottom = text.getBoundingClientRect().bottom;
    }
    const left = Math.max(4, Math.min(rect.left / zoom, (innerWidth - 4) / zoom - pageHint.offsetWidth));
    pageHint.style.left = `${left}px`;
    pageHint.style.top = `${anchorBottom / zoom + 9}px`;
    const w = pageHint.offsetWidth, h = pageHint.offsetHeight;
    const a = Math.max(16, Math.min(w - 16, (rect.left + rect.width / 2) / zoom - left));
    pageHintShape.setAttribute('viewBox', `0 -8 ${w} ${h + 8}`);
    // 본체와 꼬리를 하나의 닫힌 윤곽선으로 그려 연결부가 겹치지 않게 한다.
    pageHintOutline.setAttribute('d', `M 7.5 .5 H ${a - 7} Q ${a - 5} .5 ${a - 3.5} -1.5 L ${a - 1} -5 Q ${a} -6.5 ${a + 1} -5 L ${a + 3.5} -1.5 Q ${a + 5} .5 ${a + 7} .5 H ${w - 7.5} Q ${w - .5} .5 ${w - .5} 7.5 V ${h - 7.5} Q ${w - .5} ${h - .5} ${w - 7.5} ${h - .5} H 7.5 Q .5 ${h - .5} .5 ${h - 7.5} V 7.5 Q .5 .5 7.5 .5 Z`);
    target.setAttribute('aria-describedby', pageHint.id);
}

function showPageHint(tab) {
    openPageHint(tab === 'tab-config' ? '#class-subject-badge' : tab === 'tab-absences' ? '#absence-limit-label' : null, true);
}

function openPageHint(selector, autoDismiss = false) {
    closePageHint();
    const target = selector && document.querySelector(selector);
    if (!target) return;
    pageHintSelector = selector;
    pageHintMode = autoDismiss ? 'entry' : 'hover';
    pageHintLabel.textContent = target.dataset.pageHint;
    pageHint.hidden = false;
    positionPageHint();
    requestAnimationFrame(positionPageHint);
    if (autoDismiss) pageHintDismissTimer = setTimeout(() => {
        if (document.querySelector(pageHintSelector)?.matches(':hover')) { pageHintMode = 'hover'; return; }
        pageHint.classList.add('is-fading');
        pageHintFadeTimer = setTimeout(closePageHint, 300);
    }, 3000);
}

document.addEventListener('click', closePageHint, true);
document.addEventListener('mouseover', event => {
    const target = event.target.closest('[data-page-hint]');
    if (target && !target.contains(event.relatedTarget)) openPageHint(`#${target.id}`);
});
document.addEventListener('mouseout', event => {
    const target = event.target.closest('[data-page-hint]');
    if (pageHintMode === 'hover' && target && !target.contains(event.relatedTarget)) closePageHint();
});
document.addEventListener('scroll', positionPageHint, true);
window.addEventListener('resize', () => requestAnimationFrame(positionPageHint));

// ── 말풍선 툴팁: data-tip 이 있는 요소에 마우스를 올리면 아래에 띄운다 ──
// 표 머리글처럼 넘치는 부분을 숨기는 상자 안에서도 보이도록 칸 안이 아니라 body 에 띄운다.
const hoverTip = document.createElement('div');
hoverTip.className = 'fixed z-[9999] pointer-events-none hidden flex-col items-center';
hoverTip.innerHTML = `<div class="w-0 h-0 border-x-4 border-x-transparent border-b-4 border-b-[#1E293B]"></div>
    <div class="bg-[#1E293B] text-white text-[11.5px] font-bold px-3 py-1.5 rounded-md shadow-2xl border border-white/20 whitespace-nowrap"></div>`;
document.body.append(hoverTip);
document.addEventListener('mouseover', event => {
    const el = event.target.closest('[data-tip]');
    if (!el) { hoverTip.classList.replace('flex', 'hidden'); return; }
    hoverTip.lastElementChild.textContent = el.dataset.tip;
    hoverTip.classList.replace('hidden', 'flex');
    const zoom = parseFloat(document.documentElement.style.zoom) || 1;
    const r = el.getBoundingClientRect();
    hoverTip.style.left = `${Math.max(4, (r.left + r.width / 2) / zoom - hoverTip.offsetWidth / 2)}px`;
    hoverTip.style.top = `${r.bottom / zoom + 2}px`;
});
