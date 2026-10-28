// 창 골격과 배선.
// 
// 타이틀바/리사이즈(프레임리스 창), 사이드바 내비게이션, 탭 전환,
// 전역 버튼 배선, 초기 데이터 로드. 다른 파일들이 정의한 렌더 함수를
// 쓰므로 가장 마지막에 로드한다.

document.addEventListener('mouseup', () => { isDragging = false; isRightDragging = false; });

// ── 사이드바 내비게이션 ────────────────────────────────────────────────
const NAV_ITEMS = [
    { target: 'tab-config',   label: '기초 설정', icon: 'settings' },
    { target: 'tab-teachers', label: '감독 명단', icon: 'users' },
    { target: 'tab-absences', label: '결시 관리', icon: 'clipboard-list' },
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
                <span>${item.label}</span>
            </button>`;
    }).join('');
};

window.showTab = function(target) {
    closeAppSelect();
    activeTarget = target;
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.getElementById(target).classList.remove('hidden');
    const gcf = document.getElementById('grade-cards-frame');
    if (gcf) gcf.classList.toggle('hidden', target !== 'tab-config');
    renderSidebar();
    if (TAB_RENDERERS[target]) TAB_RENDERERS[target]();
};

document.getElementById('sidebar-nav').addEventListener('click', (e) => {
    const tabBtn = e.target.closest('[data-target]');
    if (tabBtn) showTab(tabBtn.getAttribute('data-target'));
    if (e.target.closest('[data-action="run"]')) openRulesModal();
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
    root.style.setProperty('--vw', innerWidth / z / 100 + 'px');
    root.style.setProperty('--vh', innerHeight / z / 100 + 'px');
    // zoom 아래 1px 테두리는 장치 픽셀 단위로 내림되어 그려진다(1.35배면 1장치픽셀).
    // 탭을 -1px 로 겹치면 남는 소수 픽셀만큼 표 안으로 파고들므로 실제 두께만큼만 겹친다.
    const dz = z * devicePixelRatio;
    root.style.setProperty('--hair', Math.max(1, Math.floor(dz)) / dz + 'px');
}
fitZoom();
window.addEventListener('resize', fitZoom);

// 고정 머리글이 있는 표의 스크롤 영역에 머리글 높이(--thead-h)를 알려 준다.
// 세로 스크롤 막대가 머리글 옆이 아니라 첫 데이터 행부터 시작하게 하려는 것.
// 표는 화면마다 수시로 다시 그려지므로 DOM 변화와 창 크기 변화 때마다 다시 잰다.
function syncTeacherHeader() {
    const scroll = document.getElementById('teacher-list-scroll');
    const header = document.getElementById('teacher-list-header');
    syncSplitTableHeader(scroll, header);
}
new ResizeObserver(syncTeacherHeader).observe(document.getElementById('teacher-list-scroll'));

function syncAbsenceHeader() {
    const scroll = document.getElementById('absence-table-scroll');
    const header = document.getElementById('absence-table-header');
    syncSplitTableHeader(scroll, header, document.getElementById('absence-header-viewport'));
}
new ResizeObserver(syncAbsenceHeader).observe(document.getElementById('absence-table-scroll'));
document.getElementById('absence-table-scroll').addEventListener('scroll', syncAbsenceHeader);

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
    data.config.rules = {...DEFAULT_RULES, ...data.config.rules};
    if (!data.config.invigCounts) data.config.invigCounts = {};
    if (!data.config.grades) data.config.grades = [];
    if (!data.config.classes) data.config.classes = {};
    if (!data.config.special) data.config.special = {};
    if (!data.config.separated) data.config.separated = {};
    if (!data.config.hallways) data.config.hallways = {};
    if (!data.config.subjects || data.config.subjects.length === 0) {
        data.config.subjects = ["자습", "국어", "영어", "수학", "사회", "역사", "과학"];
    }
    data.config.subjects = ['자습', ...data.config.subjects.filter(subject => subject !== '자습')];
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

window.addEventListener('pywebviewready', function() {
    mountResizeHandles();
    window.pywebview.api.get_initial_data().then(data => {
        if(data) appData = data;
        sanitizeAppData(appData);
        renderConfigTab(); renderSubjectsTab(); renderTeachers(); renderAbsencesTab(); renderResultTab(); renderRulesTab();
    });
    // 켤 때마다 가이드 투어를 띄운다. '다시 보지 않기'를 체크했으면 띄우지 않는다.
    window.pywebview.api.get_settings().then(settings => {
        tourHidden = !!settings.hideTour;
        if (!tourHidden) startTour();
    });
    window.pywebview.api.get_version().then(v => { document.getElementById('app-version').textContent = `v${v}`; });
    // 켜자마자(작업 전) 확인하고, 새 버전이 있으면 받을지 묻는다. 설치하면 창이 닫혔다가 다시 켜진다.
    window.pywebview.api.check_update().then(res => {
        if (!res.available) return;
        document.getElementById('tour').classList.add('hidden');   // 가이드 투어보다 업데이트 질문을 먼저 보인다
        openConfirmModal('새 버전 업데이트',
            `새 버전(<b>${res.version}</b>)이 나왔습니다.<br>지금 업데이트하시겠습니까?<br><span class="text-[12.5px] font-semibold text-pebble">업데이트하면 프로그램이 잠시 닫혔다가 다시 켜집니다.</span>`,
            '업데이트', () => {
                showToast(`새 버전(${res.version})을 설치합니다.\n잠시 후 프로그램이 다시 켜집니다.`, "success");
                window.pywebview.api.install_update(res.version).then(r => {
                    if (!r.success) showToast("업데이트 실패: " + r.error, "error");
                });
            }, '나중에');
    });
});

document.getElementById('btn-global-save').addEventListener('click', () => {
    appData.config.examName = document.getElementById('exam-name').value;
    saveRules();
    const d = new Date(); const yy = String(d.getFullYear()).slice(-2); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0');
    const filename = `시험감독배정결과및데이터(${yy}.${mm}.${dd}).json`;
    const pureData = { config: appData.config, teachers: appData.teachers, periods: appData.periods, classSubjects: appData.classSubjects, assignments: appData.assignments, baseAssignments: appData.baseAssignments, validation: appData.validation };
    window.pywebview.api.save_data_dialog(pureData, filename).then(res => { if(res.success) showToast("데이터 전체 저장 완료!", "success"); });
});

document.getElementById('btn-global-load').addEventListener('click', () => {
    window.pywebview.api.load_data_dialog().then(res => {
        if(res.success && res.data) { 
            appData = res.data; 
            sanitizeAppData(appData);
            renderConfigTab(); renderSubjectsTab(); renderTeachers(); renderAbsencesTab(); renderResultTab(); renderRulesTab(); 
            showToast("데이터 불러오기 완료!", "success"); 
        } 
        else if (!res.canceled) showToast("불러오기 실패: " + res.error, "error");
    }); 
});



document.addEventListener('keydown', (e) => {
    const sm = document.getElementById('swap-modal');
    if(sm && !sm.classList.contains('hidden')) {
        if(e.key === 'Escape') closeSwapModal();
        return;
    }
    const cm = document.getElementById('confirm-modal');
    if(cm && !cm.classList.contains('hidden')) {
        if(e.key === 'Escape') closeConfirmModal();
        return;
    }
    const rc = document.getElementById('rightclick-swap-modal');
    if(rc && !rc.classList.contains('hidden')) {
        if(e.key === 'Escape') closeRcSwapModal();
        return;
    }
    const rm = document.getElementById('rules-modal');
    if(rm && !rm.classList.contains('hidden')) {
        if(e.key === 'Escape') closeRulesModal();
        return;
    }
});

window.openEventModal = function() { const m = document.getElementById('event-modal'); if(m) { m.classList.remove('hidden'); m.focus(); } };
window.closeEventModal = function() { const m = document.getElementById('event-modal'); if(m) m.classList.add('hidden'); };
window.deleteTeacher = function(id) { openConfirmModal("명단 삭제 확인", "선택한 교사를 명단에서 삭제하시겠습니까?", "삭제", () => { appData.teachers = appData.teachers.filter(t=>t.id!==id); renderTeachers(); renderAbsencesTab(); }); };
window.updateTeacher = function(id, f, v, doRender=true) { const t = appData.teachers.find(x=>x.id===id); if(t) { t[f] = (f==='maxPeriods')?parseInt(v)||0:v; if(doRender && f!=='notes') { renderTeachers(); renderAbsencesTab(); } } };
window.removeSubject = function(s) { if (s === '자습') return; appData.config.subjects = appData.config.subjects.filter(x=>x!==s); renderSubjects(); renderSubjectsTab(); renderTeachers(); };
window.autoSyncPeriods = function() {
    appData.periods = [];
    appData.config.examDates.forEach(d => {
        for(let i=1; i<=d.periods; i++) {
            appData.periods.push({id:`p_${d.date}_${i}`, date:d.date, name:`${i}교시`});
        }
    });
    if (window.renderSubjectsTab) renderSubjectsTab();
    if (window.renderTeachers) renderTeachers();
    if (window.renderAbsencesTab) renderAbsencesTab();
};

window.removeDate = function(d) { 
    appData.config.examDates = appData.config.examDates.filter(x=>x.date!==d); 
    renderDates(); 
    autoSyncPeriods();
};
window.updateGradeSubject = function(pid, g, s) { if(!appData.classSubjects[pid]) appData.classSubjects[pid]={}; appData.classSubjects[pid][g]=s; renderSubjectsTab(); };
document.getElementById('btn-upload-csv').addEventListener('click', () => { window.pywebview.api.upload_excel().then(res => { if (res.success) { res.teachers.forEach((t, i) => appData.teachers.push({ id:'T'+Date.now()+i, absences:{}, ...t })); renderTeachers(); renderAbsencesTab(); showToast(`${res.teachers.length}명 추가 완료!`, "success"); } else if (!res.canceled) showToast("업로드 오류: \n" + res.error, "error"); }); });
document.getElementById('btn-download-template').addEventListener('click', () => { window.pywebview.api.download_template(appData.teachers).then(res => { if(res.success) showToast("양식 저장 완료!", "success"); }); });
document.getElementById('btn-clear-teachers').addEventListener('click', () => { openConfirmModal("명단 전체 초기화", "등록된 모든 교사 명단을 삭제하시겠습니까?", "전체 삭제", () => { appData.teachers = []; renderTeachers(); renderAbsencesTab(); showToast("명단이 삭제되었습니다.", "success"); }); });
document.querySelectorAll('.grade-toggle').forEach(toggle => { toggle.addEventListener('click', () => {
    const g = parseInt(toggle.dataset.grade), row = document.getElementById(`grade-row-${g}`);
    const cIn = document.getElementById(`class-count-${g}`), hwIn = document.getElementById(`hw-count-${g}`), sepIn = document.getElementById(`sep-count-${g}`), spIn = document.getElementById(`sp-count-${g}`);
    const isActive = toggle.classList.toggle('active');
    if(isActive) { row.classList.remove('grade-row-disabled'); cIn.disabled = hwIn.disabled = sepIn.disabled = spIn.disabled = false; if(!appData.config.grades.includes(g)) { appData.config.grades.push(g); appData.config.grades.sort((a, b) => a - b); } appData.config.classes[g]=parseInt(cIn.value)||1; appData.config.hallways[g]=parseInt(hwIn.value)||0; appData.config.separated[g]=parseInt(sepIn.value)||0; appData.config.special[g]=parseInt(spIn.value)||0; } 
    else { row.classList.add('grade-row-disabled'); cIn.disabled = hwIn.disabled = sepIn.disabled = spIn.disabled = true; appData.config.grades = appData.config.grades.filter(x => x !== g); }
    renderRulesTab();
    renderSubjectsTab();
    renderTeachers();
})});
[1, 2, 3].forEach(g => {
    document.getElementById(`class-count-${g}`).addEventListener('input', (e) => { if(appData.config.grades.includes(g)) { appData.config.classes[g] = parseInt(e.target.value)||1; renderTeachers(); } });
    document.getElementById(`hw-count-${g}`).addEventListener('input', (e) => { if(appData.config.grades.includes(g)) { appData.config.hallways[g] = parseInt(e.target.value)||0; renderTeachers(); } });
    document.getElementById(`sep-count-${g}`).addEventListener('input', (e) => { if(appData.config.grades.includes(g)) { appData.config.separated[g] = parseInt(e.target.value)||0; renderRulesTab(); renderTeachers(); } });
    document.getElementById(`sp-count-${g}`).addEventListener('input', (e) => { if(appData.config.grades.includes(g)) { appData.config.special[g] = parseInt(e.target.value)||0; renderRulesTab(); renderTeachers(); } });
});
document.getElementById('btn-add-subject').addEventListener('click', () => { const i = document.getElementById('new-subject'), v = i.value.trim(); if(v && !appData.config.subjects.includes(v)) { appData.config.subjects.push(v); i.value = ""; renderSubjects(); renderSubjectsTab(); renderTeachers(); } });
// static: 달력을 입력칸 옆에 붙여 띄운다. 화면 확대(zoom) 아래에서 flatpickr 가 직접
// 위치를 계산하면 좌표가 확대 배율만큼 어긋나 엉뚱한 곳에 열린다.
const fpDate = flatpickr('#new-date', { static: true, locale: 'ko', dateFormat: 'Y-m-d', altInput: true, altFormat: 'n월 j일 (D)', altInputClass: 'fld pl-8 pr-3 py-2 text-[13px] font-bold cursor-pointer text-center', disableMobile: true, monthSelectorType: 'static',
    onDayCreate: (dObj, dStr, fp, dayElem) => { const wd = dayElem.dateObj.getDay(); if (dayElem.classList.contains('selected')) return; if (wd === 0) dayElem.style.color = '#E11D48'; else if (wd === 6) dayElem.style.color = '#2563EB'; } });

// 달력 머리글의 연·월을 누르면 고르는 판이 펼쳐진다. 연을 고르면 이어서 월을 고른다.
// 연도 판은 마우스 휠로 한 줄(3년)씩 위아래로 넘긴다.
function mountYearMonthPanel(fp) {
    const cal = fp.calendarContainer;
    const yearInput = cal.querySelector('.cur-year');
    yearInput.readOnly = true;
    const panel = document.createElement('div');
    panel.className = 'ym-panel';
    cal.appendChild(panel);
    let mode = null, firstYear = 0;

    const render = () => {
        const items = Array.from({ length: 12 }, (_, i) => mode === 'year' ? firstYear + i : i);
        panel.innerHTML = `<div class="ym-grid">${items.map(v => {
            const on = mode === 'year' ? v === fp.currentYear : v === fp.currentMonth;
            return `<button data-v="${v}" class="${on ? 'on' : ''}">${mode === 'year' ? v + '년' : (v + 1) + '월'}</button>`;
        }).join('')}</div>`;
    };
    const show = (m) => {
        mode = m; firstYear = fp.currentYear - 4; render();
        const head = cal.querySelector('.flatpickr-months');
        panel.style.top = head.offsetTop + head.offsetHeight + 'px';   // 머리글 바로 아래부터 덮는다
        panel.classList.add('show');
    };
    const hide = () => { mode = null; panel.classList.remove('show'); };
    const toggle = (m) => (e) => { e.stopPropagation(); mode === m ? hide() : show(m); };

    yearInput.parentElement.addEventListener('click', toggle('year'));
    cal.querySelector('.cur-month').addEventListener('click', toggle('month'));
    panel.addEventListener('click', (e) => {
        e.stopPropagation();
        const b = e.target.closest('button');
        if (!b) return;
        if (mode === 'year') { fp.changeYear(Number(b.dataset.v)); mode = 'month'; render(); }
        else { fp.changeMonth(Number(b.dataset.v), false); hide(); }
    });
    panel.addEventListener('wheel', (e) => {
        if (mode !== 'year') return;
        e.preventDefault();
        const dir = Math.sign(e.deltaY);
        firstYear += dir * 3;
        render();
        panel.querySelector('.ym-grid').animate(
            [{ transform: `translateY(${dir * 14}px)`, opacity: 0.4 }, { transform: 'none', opacity: 1 }],
            { duration: 160, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }, { passive: false });
    fp.config.onClose.push(hide);
}

if (fpDate && fpDate.altInput) {
    mountYearMonthPanel(fpDate);
    let dateBtnWasOpen = false;
    fpDate.altInput.addEventListener('mousedown', () => {
        dateBtnWasOpen = fpDate.isOpen;
    });
    fpDate.altInput.addEventListener('click', (e) => {
        e.stopPropagation();
        if (dateBtnWasOpen) {
            fpDate.close();
        } else {
            fpDate.open();
        }
    });
}

document.getElementById('btn-add-date').addEventListener('click', () => { const d = document.getElementById('new-date').value, p = parseInt(document.getElementById('daily-periods').value)||3; if(d && !appData.config.examDates.find(x=>x.date===d)) { appData.config.examDates.push({date:d, periods:p}); appData.config.examDates.sort((a,b)=>a.date.localeCompare(b.date)); renderDates(); autoSyncPeriods(); fpDate.clear(); } });
const btnGen = document.getElementById('btn-generate-periods');
if(btnGen) {
    btnGen.addEventListener('click', () => { if(appData.config.examDates.length===0) return showToast("날짜를 추가해주세요.", "error"); autoSyncPeriods(); showToast("기초 시간표 동기화 완료!", "success"); });
}
document.getElementById('btn-add-teacher').addEventListener('click', () => { appData.teachers.push({ id:'T'+Date.now(), name:"", category:"교사", isMain:true, isSub:true, isClass1:true, isClass2:true, isClass3:true, isHallway:false, isSeparated:false, isSpecial:false, homeroom:"", subject:"", notes:"", absences:{}, maxPeriods: 0 }); renderTeachers(); renderAbsencesTab();
    // 새 줄로 스크롤하고 성명 칸에 바로 입력할 수 있게 한다
    const nameInput = document.querySelector('#teacher-list-body tr:last-child input[type="text"]');
    if (nameInput) {
        const box = nameInput.closest('.overflow-auto');
        // 새 줄은 항상 맨 아래. 표가 다시 그려진 뒤 높이가 확정되므로 한 프레임 뒤에 내린다.
        requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
        nameInput.focus({ preventScroll: true });
    }
});
function openRulesModal() { renderRulesTab(); const m = document.getElementById('rules-modal'); if(m) { m.classList.remove('hidden'); m.focus(); } }
window.closeRulesModal = function() { const m = document.getElementById('rules-modal'); if(m) m.classList.add('hidden'); };
document.getElementById('btn-rules-run').addEventListener('click', async () => {
    const button = document.getElementById('btn-rules-run');
    if (button.disabled) return;
    button.disabled = true;
    appData.config.examName = document.getElementById('exam-name').value;
    saveRules(); closeRulesModal(); closeAppSelect();
    try {
        const res = await window.pywebview.api.run_algorithm(appData);
        if (res.success) {
            appData.assignments = res.assignments;
            appData.baseAssignments = JSON.parse(JSON.stringify(res.assignments));
            appData.validation = res.validation;
            showToast("배정 실행 완료!", "success");
            renderValidateTab(); showTab('tab-result');
        } else {
            if (res.validation) appData.validation = res.validation;
            openAssignmentFailure(res);
        }
    } catch (error) {
        openAssignmentFailure({ error: error.message || String(error), error_type: 'CONNECTION' });
    } finally {
        button.disabled = false;
    }
});
document.getElementById('btn-export-excel').addEventListener('click', () => { const d = new Date(), yy = String(d.getFullYear()).slice(-2), mm = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0'); const filename = `${appData.config.examName || "미지정고사"}(${yy}.${mm}.${dd}).xlsx`; window.pywebview.api.export_excel(appData, filename).then(res => { if(res.success) showToast("배정 결과 다운로드 완료", "success"); else if (!res.canceled) showToast("저장 실패: " + res.error, "error"); }); });
window.toggleAllRoles = function(role, checked) { appData.teachers.forEach(t => { t[role] = checked; }); renderTeachers(); renderAbsencesTab(); };

refreshDropdowns();
