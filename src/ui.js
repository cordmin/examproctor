// 공통 UI 조각.
// 아이콘, 토스트, 확인 모달, 날짜 포맷, 날짜×교시 표 헬퍼.

window.icon = (name, cls = 'w-4 h-4') => `<svg class="${cls}"><use href="#i-${name}"/></svg>`;

window.showToast = function(message, type = 'success') {
    const toast = document.getElementById('toast-notification');
    const mark = type === 'success'
        ? `<span class="flex-shrink-0 flex items-center justify-center" style="color:#22C55E">${icon('check-circle', 'w-5 h-5')}</span>`
        : `<span class="text-coral flex-shrink-0 flex items-center justify-center">${icon('alert', 'w-5 h-5')}</span>`;
    toast.innerHTML = `${mark}<span class="whitespace-pre-line leading-relaxed">${message}</span>`;
    toast.classList.remove('-translate-y-10', 'opacity-0', 'pointer-events-none');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.add('-translate-y-10', 'opacity-0', 'pointer-events-none');
    }, type === 'error' ? 5000 : 3000);
};

window.openConfirmModal = function(title, msg, confirmText, callback) {
    // 제목 옆 경고 아이콘은 그대로 두고 <span> 안의 글자만 바꾼다.
    document.querySelector('#confirm-modal-title span').innerText = title;
    document.getElementById('confirm-modal-msg').innerHTML = msg;
    const btn = document.getElementById('confirm-modal-btn');
    btn.innerText = confirmText;
    confirmCallback = callback;
    const m = document.getElementById('confirm-modal');
    m.classList.remove('hidden');
    m.focus();
};

window.closeConfirmModal = function() {
    confirmCallback = null;
    document.getElementById('confirm-modal').classList.add('hidden');
};

window.executeConfirm = function() {
    if(confirmCallback) confirmCallback();
    closeConfirmModal();
};

function formatBeautifulDate(dateStr) {
    if(!dateStr) return "";
    const [y, m, d] = dateStr.split('-'); const dateObj = new Date(y, parseInt(m)-1, d); const days = ['일','월','화','수','목','금','토'];
    return `${parseInt(m)}월 ${parseInt(d)}일(${days[dateObj.getDay()]})`;
}

function formatHomeroom(val) {
    if(!val) return "";
    let m = val.match(/^(\d+)-(\d+)$/);
    if(m) return `${m[1]}-${m[2]}`;
    return val;
}

function naturalSortKey(a, b) {
    return a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'});
}

// ── 날짜 x 교시 표 공통 ──────────────────────────────────────────────────
// 시험교과/결시/배정결과 탭이 모두 '날짜를 묶고 그 아래 교시를 펼치는' 같은 표를 쓴다.

function groupPeriodsByDate() {
    const periodsByDate = {};
    appData.periods.forEach(p => (periodsByDate[p.date] ||= []).push(p));
    return { periodsByDate, dates: Object.keys(periodsByDate).sort() };
}

// 날짜가 바뀌는 경계에는 굵은 세로선, 표 맨 왼쪽 데이터 칸에는 굵은 왼쪽 선.
// .border-thick / .border-edge 는 index.html 에 정의된 !important 유틸이다.
// (Tailwind 의 border-l-4 는 th,td 기본 테두리 규칙과 충돌해 쓰지 않는다)
function cellBorders(periodsByDate, dates, dIdx, pIdx) {
    const lastOfDate = pIdx === periodsByDate[dates[dIdx]].length - 1;
    const thick = lastOfDate ? 'border-thick' : '';
    const firstCol = (dIdx === 0 && pIdx === 0) ? 'border-edge' : '';
    return `${thick} ${firstCol}`;
}



function build2RowDatePeriodHeaderParts(periodsByDate, dates, periodClass) {
    let row1 = '';
    let row2 = '';
    dates.forEach((d, dIdx) => {
        const periods = periodsByDate[d];
        const isLastDate = dIdx === dates.length - 1;
        const borderR = isLastDate ? '' : 'border-r-2 border-slate-300';
        row1 += `<th colspan="${periods.length}" class="py-1.5 px-2 font-bold text-center border-b border-line text-text-main text-[13.5px] bg-[#F1F5F9] ${borderR}">${formatBeautifulDate(d)}</th>`;
        periods.forEach((p, pIdx) => {
            const isLastP = pIdx === periods.length - 1;
            const bClass = isLastP ? (isLastDate ? '' : 'border-r-2 border-slate-300') : 'border-r border-line';
            row2 += `<th class="py-2 px-1 font-bold text-text-main text-center bg-[#F1F5F9] border-b border-line ${bClass} ${periodClass}">${p.name}</th>`;
        });
    });
    return { row1, row2 };
}

// 모든 select는 원래 값/이벤트를 유지하고 같은 버튼과 목록으로 표시한다.
const appSelectMenu = document.getElementById('grade-subject-menu');
let appSelectTrigger = null;

function closeAppSelect(restoreFocus = false) {
    appSelectMenu.hidden = true;
    if (appSelectTrigger) {
        appSelectTrigger.setAttribute('aria-expanded', 'false');
        if (restoreFocus) appSelectTrigger.focus();
    }
    appSelectTrigger = null;
}

function refreshDropdowns() {
    document.querySelectorAll('select:not(.flatpickr-monthDropdown-months)').forEach(select => {
        let button = select.nextElementSibling;
        if (!button?.classList.contains('app-select-btn')) {
            button = document.createElement('button');
            button.type = 'button';
            button.className = `${select.className} app-select-btn${select.classList.contains('grade-subject-source') ? ' grade-subject-btn' : ''}`;
            button.classList.remove('app-select-source');
            if (select.id) button.id = `${select.id}-dropdown`;
            button.setAttribute('aria-haspopup', 'listbox');
            button.setAttribute('aria-controls', 'grade-subject-menu');
            button.setAttribute('aria-expanded', 'false');
            button.innerHTML = '<span></span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
            select.after(button);
            select.classList.add('app-select-source');
            button.onclick = event => { event.stopPropagation(); openAppSelect(button, select); };
            button.onkeydown = event => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault(); openAppSelect(button, select);
                }
            };
            select.addEventListener('change', refreshDropdowns);
        }
        const label = select.selectedOptions[0]?.textContent || '선택';
        if (button.firstElementChild.textContent !== label) button.firstElementChild.textContent = label;
        button.disabled = select.disabled;
        button.setAttribute('aria-label', select.getAttribute('aria-label') || label);
    });
}

function openAppSelect(button, select) {
    const wasOpen = appSelectTrigger === button;
    closeAppSelect();
    if (wasOpen || select.disabled) return;
    appSelectTrigger = button;
    appSelectMenu.replaceChildren();
    [...select.options].forEach((source, index) => {
        const option = document.createElement('button');
        option.type = 'button';
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', String(index === select.selectedIndex));
        option.textContent = source.textContent;
        option.disabled = source.disabled || source.parentElement.disabled === true;
        option.onclick = event => {
            event.stopPropagation();
            closeAppSelect();
            select.selectedIndex = index;
            select.dispatchEvent(new Event('input', { bubbles: true }));
            select.dispatchEvent(new Event('change', { bubbles: true }));
            refreshDropdowns();
            (document.getElementById(button.id) || button).focus({ preventScroll: true });
        };
        appSelectMenu.appendChild(option);
    });
    if (!appSelectMenu.children.length) { closeAppSelect(); return; }
    button.setAttribute('aria-expanded', 'true');
    appSelectMenu.setAttribute('aria-label', button.getAttribute('aria-label'));
    appSelectMenu.hidden = false;
    const zoom = parseFloat(document.documentElement.style.zoom) || 1;
    const rect = button.getBoundingClientRect();
    appSelectMenu.style.width = `${rect.width / zoom}px`;
    appSelectMenu.style.maxHeight = `${Math.min(300, Math.max(60, Math.max(window.innerHeight - rect.bottom - 8, rect.top - 8)) / zoom)}px`;
    const { width, height } = appSelectMenu.getBoundingClientRect();
    appSelectMenu.style.left = `${Math.max(4, Math.min(rect.left, window.innerWidth - width - 4)) / zoom}px`;
    appSelectMenu.style.top = `${(rect.bottom + height + 4 <= window.innerHeight ? rect.bottom + 4 : Math.max(4, rect.top - height - 4)) / zoom}px`;
    const selected = appSelectMenu.querySelector('[aria-selected="true"]:not(:disabled)') || appSelectMenu.querySelector('button:not(:disabled)');
    selected?.focus({ preventScroll: true });
    if (selected) appSelectMenu.scrollTop = Math.max(0, selected.offsetTop - appSelectMenu.clientHeight / 2 + selected.offsetHeight / 2);
}

appSelectMenu.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeAppSelect(true); }
    else if (event.key === 'Tab') closeAppSelect(true);
    else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const options = [...appSelectMenu.querySelectorAll('button:not(:disabled)')];
        if (!options.length) return;
        const index = options.indexOf(document.activeElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
        options[next].focus();
    }
});
document.addEventListener('click', event => {
    if (!event.target.closest('.app-select-btn, #grade-subject-menu')) closeAppSelect();
});
document.addEventListener('scroll', event => {
    if (!appSelectMenu.contains(event.target)) closeAppSelect();
}, true);
window.addEventListener('resize', () => closeAppSelect());

window.closeAssignmentFailure = function() {
    document.getElementById('assignment-failure-modal').classList.add('hidden');
    document.querySelector('#sidebar-nav [data-action="run"]')?.focus();
};

window.openAssignmentFailure = function(result) {
    closeAppSelect();
    const failure = result.failure || {
        summary: result.error_type === 'CONNECTION' ? '배정 실행 중 프로그램과의 통신이 중단되었거나 응답 처리에 실패했습니다.' : '배정 처리 중 예기치 않은 오류가 발생했습니다.',
        reasons: [{message: result.error || '상세 오류 정보가 없습니다.',
                   action: '입력한 시험 일정·학년·과목과 감독 명단을 확인한 뒤 다시 실행하세요. 같은 오류가 반복되면 데이터를 저장하고 프로그램을 다시 실행한 뒤, 아래 오류 내용을 전달해 주세요.', target: 'tab-config'}]
    };
    document.getElementById('assignment-failure-summary').textContent = failure.summary;
    const container = document.getElementById('assignment-failure-reasons');
    container.replaceChildren();
    (failure.reasons || []).forEach(reason => {
        const row = document.createElement('div');
        row.className = 'p-3 bg-surface-50 rounded-lg border border-line';
        const heading = document.createElement('p');
        heading.className = 'font-bold text-[13px] mb-1';
        heading.textContent = reason.message;
        const action = document.createElement('p');
        action.className = 'text-[13px] leading-relaxed text-stone';
        action.textContent = reason.action;
        row.append(heading, action);
        const labels = {'tab-config': '기초 설정 확인', 'tab-teachers': '감독 명단 확인', 'tab-absences': '결시 관리 확인', rules: '배정 규칙 확인'};
        if (labels[reason.target]) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'mt-2 px-3 py-1.5 border border-line bg-surface-0 rounded-lg text-[12px] font-bold hover:bg-surface-100';
            button.textContent = labels[reason.target];
            button.onclick = () => {
                closeAssignmentFailure();
                if (reason.target === 'rules') openRulesModal();
                else showTab(reason.target);
            };
            row.appendChild(button);
        }
        container.appendChild(row);
    });
    const modal = document.getElementById('assignment-failure-modal');
    modal.classList.remove('hidden');
    modal.focus();
};

document.getElementById('assignment-failure-modal').addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); closeAssignmentFailure(); }
    else if (event.key === 'Tab') {
        const modal = event.currentTarget;
        const buttons = [...modal.querySelectorAll('button:not(:disabled)')];
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === modal)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === modal)) { event.preventDefault(); first.focus(); }
    }
});
