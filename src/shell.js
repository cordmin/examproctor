// 창 골격: 사이드바 내비게이션, 탭 전환, 프레임리스 창 제어, 화면 크기 맞춤, 표 머리글 맞춤, 자료 기본값 보정.
// 시작·업데이트는 updates.js, 버튼 배선은 actions.js 에 있다.

document.addEventListener('mouseup', () => { isDragging = false; isRightDragging = false; });

// ── 사이드바 내비게이션 ────────────────────────────────────────────────
const NAV_ITEMS = [
    { action: 'reset',        label: '전체 초기화', icon: 'refresh' },
    { target: 'tab-config',   label: '기초 설정', icon: 'settings' },
    { target: 'tab-teachers', label: '감독 명단', icon: 'users' },
    { target: 'tab-absences', label: '배정 제외', icon: 'clipboard-list' },
    { action: 'run',          label: '배정 실행', icon: 'play' },   // 탭이 아니라 규칙 창을 연다
    { target: 'tab-result',   label: '배정 결과', icon: 'table' },
    { target: 'tab-validate', label: '배정 검증', icon: 'search' },
];

let activeTarget = 'tab-config';

// 탭을 열 때 다시 그려야 하는 화면들
const TAB_RENDERERS = {
    'tab-config':   () => { if (window.renderConfigTab) renderConfigTab(); if (window.renderSubjectsTab) renderSubjectsTab(); },
    'tab-teachers': () => renderTeachers(),
    'tab-absences': () => renderAbsencesTab(),
    'tab-result':   () => renderResultTab(),
    'tab-validate': () => renderValidateTab(),
};

window.renderSidebar = function() {
    // 짙은 남색 사이드바 위의 메뉴: 선택된 탭만 파란 바탕
    document.getElementById('sidebar-nav').innerHTML = NAV_ITEMS.map(item => {
        const isActive = item.target && item.target === activeTarget;
        const attr = item.action ? `data-action="${item.action}"` : `data-target="${item.target}"`;
        return `
            <button ${attr}
                    class="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl transition-colors text-[13.5px] cursor-pointer ${
                        isActive ? 'bg-[#2563EB] text-white font-bold' : 'text-white/90 font-semibold hover:bg-white/10'}">
                ${icon(item.icon, `w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-white' : 'text-white/75'}`)}
                <span class="sidebar-menu-label">${item.label}</span>
            </button>`;
    }).join('');
};

window.showTab = function(target) {
    closeAppSelect();
    const entering = activeTarget !== target;
    activeTarget = target;
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.getElementById(target).classList.remove('hidden');
    const gcf = document.getElementById('grade-cards-frame');
    if (gcf) gcf.classList.toggle('hidden', target !== 'tab-config');
    renderSidebar();
    if (TAB_RENDERERS[target]) TAB_RENDERERS[target]();
    requestAnimationFrame(syncToolbarDividers);
    if (entering) showPageHint(target);
    else positionPageHint();
};

document.getElementById('sidebar-nav').addEventListener('click', (e) => {
    const tabBtn = e.target.closest('[data-target]');
    if (tabBtn) showTab(tabBtn.getAttribute('data-target'));
    if (e.target.closest('[data-action="run"]')) openRulesModal();
    if (e.target.closest('[data-action="reset"]')) {
        openConfirmModal('전체 초기화', '<p class="text-coral text-[15px] font-bold mb-2">현재 작업의 모든 자료가 지워집니다.</p><p class="mt-5 font-semibold text-text-main">저장하지 않은 데이터는 복구할 수 없으니 미리 저장해주세요</p>', '전체 초기화', () => {
            appData = createEmptyData();
            currentResultView = 'result-teacher';
            activeBrush = {type: 'ALL', target: '', fill: 'bg-coral text-white'};
            closeAppSelect(); closeRoleMenu(); closeSwapModal(); closeRcSwapModal();
            fpDate.clear();
            document.getElementById('new-subject').value = '';
            document.getElementById('daily-periods').value = '';
            renderConfigTab(); renderTeachers(); renderAbsencesTab(); renderResultTab(); renderValidateTab();
            showTab('tab-config');
            showToast('전체 초기화가 완료되었습니다.', 'success');
        });
    }
});

renderSidebar();

// ── 배정 결과 하위 전환 (교사별 / 학년별) ────────────────────────────
// 버튼은 renderResultTab 이 학년에 맞춰 다시 만들므로 부모에 한 번만 건다.
document.getElementById('result-view-btns').addEventListener('click', (e) => {
    const btn = e.target.closest('.result-sub-btn');
    if (!btn) return;
    document.querySelectorAll('.result-sub-btn').forEach(b => b.className = RESULT_BTN_OFF);
    btn.className = RESULT_BTN_ON;
    currentResultView = btn.getAttribute('data-target');
    document.querySelectorAll('.result-view').forEach(view => view.classList.add('hidden'));
    document.getElementById(currentResultView).classList.remove('hidden');
    requestAnimationFrame(syncResultHeaders);
});

// ── 프레임리스 창 제어 ─────────────────────────────────────────────────
const winApi = () => window.pywebview && window.pywebview.api;

document.getElementById('win-min').addEventListener('click', () => winApi() && winApi().minimize_window());
window.setMaximized = function(maximized) {
    const button = document.getElementById('win-max');
    button.title = maximized ? '이전 크기로' : '최대화';
    button.setAttribute('aria-label', button.title);
    button.innerHTML = maximized
        ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 8V4h12v12h-4"/><rect x="4" y="8" width="12" height="12"/></svg>'
        : '<svg style="width:14.6px;height:14.6px"><use href="#i-square"/></svg>';
};
let savedSnapshot = null;
window.markDataSaved = () => { savedSnapshot = JSON.stringify(appData); };
window.getCloseState = function() {
    document.activeElement?.blur();
    return { dirty: savedSnapshot !== null && JSON.stringify(appData) !== savedSnapshot, data: appData };
};
window.requestClose = function() {
    const state = getCloseState();
    if (!state.dirty) { finishClose(false); return true; }
    closeAppSelect(); closeRoleMenu();
    const modal = document.getElementById('close-modal');
    modal.classList.remove('hidden');
    document.getElementById('close-cancel').focus();
    return true;
};
window.cancelClose = function() {
    const modal = document.getElementById('close-modal');
    if (modal.dataset.busy === 'true') return;
    modal.classList.add('hidden');
    winApi()?.cancel_close();
};
window.finishClose = async function(save) {
    const modal = document.getElementById('close-modal');
    if (modal.dataset.busy === 'true') return;
    modal.dataset.busy = 'true';
    modal.querySelectorAll('button').forEach(button => button.disabled = true);
    try {
        const result = await winApi().finish_close(save, getCloseState().data);
        if (!result.success && !result.canceled) showToast('저장 실패: ' + result.error, 'error');
    } catch (error) {
        showToast('종료하지 못했습니다: ' + (error.message || error), 'error');
    } finally {
        modal.dataset.busy = 'false';
        modal.querySelectorAll('button').forEach(button => button.disabled = false);
    }
};
document.getElementById('close-modal').addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelClose(); }
    if (event.key === 'Tab') {
        const buttons = [...event.currentTarget.querySelectorAll('button:not(:disabled)')];
        if (!buttons.length) { event.preventDefault(); return; }
        if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1).focus(); }
        else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus(); }
    }
});
window.closeUpdateModal = function() {
    const modal = document.getElementById('update-modal');
    if (modal.dataset.busy !== 'true') modal.classList.add('hidden');
};
document.getElementById('exam-name').addEventListener('input', e => { appData.config.examName = e.target.value; });

document.getElementById('win-max').addEventListener('click', () => winApi() && winApi().toggle_maximize());
document.getElementById('win-close').addEventListener('click', () => winApi() && winApi().close_window());
document.getElementById('titlebar').addEventListener('dblclick', (e) => {
    if (e.target.closest('button')) return;
    if (winApi()) winApi().toggle_maximize();
});

// ── 화면 크기 맞춤 ──────────────────────────────────────────────────
// 화면은 BASE_W x BASE_H 기준으로 짜여 있다. 창 크기에 맞춰 전체를 같은 비율로
// 키우거나 줄인다. Windows 배율(125%, 150% …)은 WebView2 가 이미 반영한 값이 innerWidth 다.
const BASE_W = 1280, BASE_H = 800, ZOOM_MIN = 0.8, ZOOM_MAX = 2;
// 창 최소 크기 = 최소 배율일 때 기준 크기. main.py 의 min_size 와 맞춘다.
const MIN_W = BASE_W * ZOOM_MIN, MIN_H = BASE_H * ZOOM_MIN;
function fitZoom() {
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(innerWidth / BASE_W, innerHeight / BASE_H)));
    const root = document.documentElement;
    root.style.zoom = z;
    // 타이틀바는 콘텐츠의 화면 맞춤 배율과 무관하게 같은 크기를 유지한다.
    document.getElementById('titlebar').style.zoom = 1 / z;
    root.style.setProperty('--vw', innerWidth / z / 100 + 'px');
    root.style.setProperty('--vh', innerHeight / z / 100 + 'px');
    // zoom 아래 1px 테두리는 장치 픽셀 단위로 내림되어 그려진다(1.35배면 1장치픽셀).
    // 탭을 -1px 로 겹치면 남는 소수 픽셀만큼 표 안으로 파고들므로 실제 두께만큼만 겹친다.
    const dz = z * devicePixelRatio;
    root.style.setProperty('--hair', Math.max(1, Math.floor(dz)) / dz + 'px');
    requestAnimationFrame(syncToolbarDividers);
}
// 두 페이지가 같은 선 하나를 재사용한다. 페이지별 합성·배율 차이를 피한다.
const toolbarDivider = document.createElement('canvas');
toolbarDivider.className = 'toolbar-divider';
toolbarDivider.setAttribute('aria-hidden', 'true');
document.body.append(toolbarDivider);
function syncToolbarDividers() {
    const group = [...document.querySelectorAll('.toolbar-hint-group')].find(el => el.getBoundingClientRect().width);
    toolbarDivider.hidden = !group;
    if (!group) return;
    const zoom = parseFloat(document.documentElement.style.zoom) || 1;
    const snap = value => Math.round(value * devicePixelRatio) / devicePixelRatio;
    const box = group.getBoundingClientRect();
    const height = snap(28 * zoom);
    toolbarDivider.style.zoom = String(1 / zoom);
    toolbarDivider.width = Math.round(innerWidth * devicePixelRatio);
    toolbarDivider.height = Math.round(innerHeight * devicePixelRatio);
    toolbarDivider.style.width = `${toolbarDivider.width / devicePixelRatio}px`;
    toolbarDivider.style.height = `${toolbarDivider.height / devicePixelRatio}px`;
    const ctx = toolbarDivider.getContext('2d');
    ctx.fillStyle = '#94A3B8';
    ctx.beginPath();
    const width = Math.round(2 * devicePixelRatio);
    ctx.roundRect(Math.round(box.left * devicePixelRatio), Math.round((box.top + (box.height - height) / 2) * devicePixelRatio), width, Math.round(height * devicePixelRatio), width / 2);
    ctx.fill();
}
const toolbarDividerObserver = new ResizeObserver(syncToolbarDividers);
document.querySelectorAll('#brush-toolbar, #result-view-btns, .toolbar-hint-group').forEach(el => toolbarDividerObserver.observe(el));
fitZoom();
window.addEventListener('resize', fitZoom);

// 고정 머리글이 있는 표의 스크롤 영역에 머리글 높이(--thead-h)를 알려 준다.
// 세로 스크롤 막대가 머리글 옆이 아니라 첫 데이터 행부터 시작하게 하려는 것.
// 표는 화면마다 수시로 다시 그려지므로 DOM 변화와 창 크기 변화 때마다 다시 잰다.
function syncTeacherHeader() {
    const scroll = document.getElementById('teacher-list-scroll');
    const header = document.getElementById('teacher-list-header');
    syncSplitTableHeader(scroll, header);
    syncTableColumnLines(header, scroll);
}
// 헤더와 스크롤 본문을 따로 그리면 같은 좌표라도 픽셀 반올림이 달라진다.
// 세로선은 두 영역에 걸친 한 개의 레이어에서 한 번만 그린다.
function syncTableColumnLines(header, scroll) {
    if (!scroll.clientWidth) return;
    const frame = header.parentElement;
    frame.classList.add('split-table-frame');
    let lines = frame.querySelector('.split-column-lines');
    if (!lines) {
        lines = document.createElement('div');
        lines.className = 'split-column-lines';
        lines.setAttribute('aria-hidden', 'true');
        frame.appendChild(lines);
    }
    const zoom = parseFloat(document.documentElement.style.zoom) || 1;
    const rows = header.querySelector('thead').rows;
    const heads = [...header.querySelectorAll('th')].filter(cell => cell.rowSpan > 1 || rows.length === 1 || cell.parentElement === rows[1]).filter(cell => cell.getBoundingClientRect().width > 0).sort((a, b) => a.getBoundingClientRect().right - b.getBoundingClientRect().right);
    const edges = heads.slice(0, -1);
    if (lines.children.length !== edges.length) lines.replaceChildren(...edges.map(() => document.createElement('span')));
    const origin = frame.getBoundingClientRect();
    const body = scroll.querySelector('table').getBoundingClientRect();
    const empty = scroll.querySelector('tbody td[colspan]');
    const bottom = empty ? header.getBoundingClientRect().bottom : Math.min(scroll.getBoundingClientRect().bottom, body.bottom);
    lines.style.height = `${Math.max(0, bottom - origin.top) / zoom}px`;
    lines.style.width = `${scroll.clientWidth}px`;
    edges.forEach((cell, index) => {
        const line = lines.children[index];
        const thick = cell.classList.contains('border-thick');
        const thickness = thick ? '2px' : 'var(--hair)';
        const top = rows.length > 1 && cell.rowSpan === 1 && !thick ? (cell.getBoundingClientRect().top - origin.top) / zoom : 0;
        line.style.left = `calc(${(cell.getBoundingClientRect().right - origin.left) / zoom}px - ${thickness})`;
        line.style.top = `${top}px`;
        line.style.height = `calc(100% - ${top}px)`;
        line.style.width = thickness;
        line.style.background = thick ? 'rgb(var(--surface-300))' : 'rgb(var(--line))';
    });
}
new ResizeObserver(syncTeacherHeader).observe(document.getElementById('teacher-list-scroll'));
document.getElementById('teacher-list-scroll').addEventListener('scroll', event => {
    document.getElementById('teacher-list-header').scrollLeft = event.currentTarget.scrollLeft;
    syncTableColumnLines(document.getElementById('teacher-list-header'), document.getElementById('teacher-list-scroll'));
});

function syncAbsenceHeader() {
    const scroll = document.getElementById('absence-table-scroll');
    const header = document.getElementById('absence-table-header');
    syncSplitTableHeader(scroll, header, document.getElementById('absence-header-viewport'));
    syncTableColumnLines(header, scroll);
}
new ResizeObserver(syncAbsenceHeader).observe(document.getElementById('absence-table-scroll'));
document.getElementById('absence-table-scroll').addEventListener('scroll', event => {
    document.getElementById('absence-header-viewport').scrollLeft = event.currentTarget.scrollLeft;
    syncTableColumnLines(document.getElementById('absence-table-header'), event.currentTarget);
});

function syncScrollHeads() {
    syncTeacherHeader();
    syncAbsenceHeader();
    syncStatsHeader();
    document.querySelectorAll('thead').forEach(head => {
        const box = head.closest('.overflow-auto, .overflow-y-auto');
        if (!box) return;
        // 표가 스크롤 상자 맨 위에 붙어 있을 때만 (기초 설정처럼 카드 속 작은 표는 제외):
        // 표에서 상자까지 올라가는 동안 줄곧 첫 번째 자식이어야 한다.
        for (let el = head.closest('table'); el !== box; el = el.parentElement) {
            if (el.parentElement.firstElementChild !== el) return;
        }
        // offsetHeight 는 정수로 반올림돼 확대 화면에서 선이 1px 어긋난다. 실제 높이를 소수까지 쓴다.
        const z = parseFloat(document.documentElement.style.zoom) || 1;
        box.style.setProperty('--thead-h', head.getBoundingClientRect().height / z + 'px');
        box.classList.add('has-head');
    });
}
let scrollHeadTimer;
const queueScrollHeads = () => { clearTimeout(scrollHeadTimer); scrollHeadTimer = setTimeout(syncScrollHeads, 50); };
new MutationObserver(queueScrollHeads).observe(document.body, { childList: true, subtree: true });
window.addEventListener('resize', queueScrollHeads);

// 프레임리스라 OS 가 그려주는 리사이즈 테두리가 없다. 가장자리에 투명 핸들을 깐다.
function mountResizeHandles() {
    const T = 5;
    const edges = [
        ['n',  { top: 0, left: T, right: T, height: T, cursor: 'ns-resize' }],
        ['s',  { bottom: 0, left: T, right: T, height: T, cursor: 'ns-resize' }],
        ['w',  { left: 0, top: T, bottom: T, width: T, cursor: 'ew-resize' }],
        ['e',  { right: 0, top: T, bottom: T, width: T, cursor: 'ew-resize' }],
        ['nw', { top: 0, left: 0, width: T*2, height: T*2, cursor: 'nwse-resize' }],
        ['ne', { top: 0, right: 0, width: T*2, height: T*2, cursor: 'nesw-resize' }],
        ['sw', { bottom: 0, left: 0, width: T*2, height: T*2, cursor: 'nesw-resize' }],
        ['se', { bottom: 0, right: 0, width: T*2, height: T*2, cursor: 'nwse-resize' }],
    ];
    edges.forEach(([dir, style]) => {
        const el = document.createElement('div');
        el.style.position = 'fixed';
        el.style.zIndex = '9999';
        Object.entries(style).forEach(([k, v]) => el.style[k] = typeof v === 'number' ? v + 'px' : v);
        el.addEventListener('mousedown', (e) => startResize(dir, e));
        document.body.appendChild(el);
    });
}

function startResize(dir, e) {
    e.preventDefault();
    const sx = e.screenX, sy = e.screenY;
    winApi().get_bounds().then(b => {
        const { x, y, w, h } = b;
        const onMove = (ev) => {
            let nx = x, ny = y, nw = w, nh = h;
            let dx = ev.screenX - sx, dy = ev.screenY - sy;
            if (dir.includes('e')) { const m = Math.max(0, w - MIN_W); if (dx < -m) dx = -m; nw = w + dx; }
            if (dir.includes('s')) { const m = Math.max(0, h - MIN_H); if (dy < -m) dy = -m; nh = h + dy; }
            if (dir.includes('w')) { const m = Math.max(0, w - MIN_W); if (dx > m) dx = m; nw = w - dx; nx = x + dx; }
            if (dir.includes('n')) { const m = Math.max(0, h - MIN_H); if (dy > m) dy = m; nh = h - dy; ny = y + dy; }
            winApi().set_bounds(Math.round(nx), Math.round(ny), Math.round(nw), Math.round(nh));
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    });
}

function sanitizeAppData(data) {
    if (!data) return;
    if (!data.config) data.config = {};
    if (!data.config.rules) data.config.rules = {};
    if (!data.config.invigCounts) data.config.invigCounts = {};
    Object.values(data.config.invigCounts).forEach(counts => { counts.special = counts.separated = 1; });
    if (!data.config.grades) data.config.grades = [];
    if (!data.config.classes) data.config.classes = {};
    if (!data.config.special) data.config.special = {};
    if (!data.config.separated) data.config.separated = {};
    if (!data.config.hallways) data.config.hallways = {};
    if (!data.config.subjects) data.config.subjects = [];
    if (!data.config.examDates) data.config.examDates = [];
    if (!data.teachers) data.teachers = [];
    if (!data.periods) data.periods = [];
    if (!data.classSubjects) data.classSubjects = {};
    if (!data.assignments) data.assignments = {};
    if (!data.validation) data.validation = {};

    data.teachers.forEach(t => {
        if (t.isClass1 === undefined) {
            let defaultClass = (t.isClass !== undefined) ? t.isClass : true;
            t.isClass1 = defaultClass;
            t.isClass2 = defaultClass;
            t.isClass3 = defaultClass;
        }
    });
}
