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

window.openConfirmModal = function(title, msg, confirmText, callback, cancelText = '취소') {
    // 제목 옆 경고 아이콘은 그대로 두고 <span> 안의 글자만 바꾼다.
    document.querySelector('#confirm-modal-title span').innerText = title;
    document.getElementById('confirm-modal-msg').innerHTML = msg;
    const btn = document.getElementById('confirm-modal-btn');
    btn.innerText = confirmText;
    document.getElementById('confirm-modal-cancel').innerText = cancelText;
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



function emptyTableRows(columns, rows = 6) {
    return Array.from({length: rows}, () => `<tr aria-hidden="true" data-empty-row>${'<td class="border border-line h-10">&nbsp;</td>'.repeat(columns)}</tr>`).join('');
}

function build2RowDatePeriodHeaderParts(periodsByDate, dates, periodClass) {
    if (!dates.length) return {
        row1: '<th class="p-2 border-b border-r border-line bg-[#F1F5F9]">시험일</th>',
        row2: '<th class="p-2 border-b border-r border-line bg-[#F1F5F9]">교시</th>',
    };
    let row1 = '';
    let row2 = '';
    dates.forEach((d, dIdx) => {
        const periods = periodsByDate[d];
        const borderR = `border-thick ${dIdx === 0 ? 'border-edge' : ''}`;
        row1 += `<th colspan="${periods.length}" class="py-1.5 px-2 font-bold text-center border-b border-line text-text-main text-[13.5px] bg-[#F1F5F9] ${borderR}">${formatBeautifulDate(d)}</th>`;
        periods.forEach((p, pIdx) => {
            const isLastP = pIdx === periods.length - 1;
            const bClass = `${isLastP ? 'border-thick' : 'border-r border-line'} ${dIdx === 0 && pIdx === 0 ? 'border-edge' : ''}`;
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
    // grid-select: <optgroup> 마다 제목(label + data-count)과 3칸 바둑판, 첫 빈 안내 항목은 뺀다.
    const isGrid = select.classList.contains('grid-select');
    appSelectMenu.classList.toggle('grid-menu', isGrid);
    if (isGrid) select.querySelectorAll('optgroup').forEach(group => {
        const head = document.createElement('div');
        head.className = 'grid-menu-head';
        head.textContent = group.label;
        if (group.dataset.count) head.insertAdjacentHTML('beforeend', `<span>${group.dataset.count}</span>`);
        const grid = document.createElement('div');
        grid.className = 'grid-menu-grid';
        appSelectMenu.append(head, grid);
    });
    const grids = appSelectMenu.querySelectorAll('.grid-menu-grid');
    [...select.options].forEach((source, index) => {
        if (isGrid && source.parentElement.tagName !== 'OPTGROUP') return;
        const option = document.createElement('button');
        option.type = 'button';
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', String(index === select.selectedIndex));
        option.textContent = source.textContent;
        if (source.dataset.sub) option.insertAdjacentHTML('beforeend', `<small>${source.dataset.sub}</small>`);
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
        (isGrid ? grids[[...select.querySelectorAll('optgroup')].indexOf(source.parentElement)] : appSelectMenu).appendChild(option);
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

// 안내 문구의 target 으로 해당 화면을 연다 (배정 실패 창, 배정 검증 카드가 함께 쓴다).
const GO_TARGET_LABELS = {'tab-config': '기초 설정 확인', 'tab-teachers': '감독 명단 확인', 'tab-absences': '결시 관리 확인', 'tab-result': '배정 결과 보기', rules: '배정 규칙 확인'};
const GO_TARGET_BTN = 'mt-2 px-3 py-1.5 border border-line bg-surface-0 rounded-lg text-[12px] font-bold hover:bg-surface-100';
window.goToTarget = function(target) {
    if (target === 'rules') openRulesModal();
    else showTab(target);
};

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
        if (GO_TARGET_LABELS[reason.target]) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = GO_TARGET_BTN;
            button.textContent = GO_TARGET_LABELS[reason.target];
            button.onclick = () => { closeAssignmentFailure(); goToTarget(reason.target); };
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

// 두 표에 같은 정수 단위 열 너비를 적용해 확대 배율/colspan의 서로 다른 반올림을 피한다.
// 빈 표는 화면 높이에 맞춰 실제 빈 셀을 채운다. 창 크기를 바꿔도 행 높이는 일정하게 유지한다.
function syncEmptyTable(scroll, table) {
    const first = table.tBodies[0]?.rows[0];
    const empty = !!first?.hasAttribute('data-empty-row');
    scroll.classList.toggle('empty-table-scroll', empty);
    if (!empty) {
        table.style.removeProperty('height');
        table.style.removeProperty('--empty-row-height');
        return;
    }
    const height = scroll.clientHeight;
    if (!height) return;
    const rows = Math.max(1, Math.floor(height / 40));
    if (table.tBodies[0].rows.length !== rows) {
        table.tBodies[0].innerHTML = emptyTableRows(first.cells.length, rows);
    }
    table.style.height = `${height}px`;
    table.style.setProperty('--empty-row-height', `${height / rows}px`);
}

const splitTableWidths = new WeakMap();
function syncSplitTableHeader(scroll, header, viewport = null) {
    const bodyTable = scroll.querySelector('table');
    const headerTable = header.querySelector('table');
    if (!bodyTable || !headerTable || !scroll.clientWidth) return;
    syncEmptyTable(scroll, bodyTable);
    bodyTable.classList.remove('split-grid-body');
    [bodyTable, headerTable].forEach(table => {
        table.classList.add('aligned-table');
        table.querySelectorAll('.border-r-2').forEach(cell => cell.classList.add('border-thick'));
        table.querySelectorAll('.border-edge').forEach(cell => {
            cell.previousElementSibling?.classList.add('border-thick');
            cell.classList.remove('border-edge');
        });
    });
    const columns = [...bodyTable.querySelector('colgroup').children];
    // 날짜/감독 열을 다시 만들면 이전 열의 너비 캐시도 폐기한다.
    if (splitTableWidths.get(bodyTable)?.columns[0] !== columns[0]) {
        splitTableWidths.set(bodyTable, { columns, widths: columns.map(col => col.style.width) });
    }
    const originalWidths = splitTableWidths.get(bodyTable).widths;
    bodyTable.style.width = '100%';
    columns.forEach((column, index) => column.style.width = originalWidths[index]);
    const zoom = parseFloat(document.documentElement.style.zoom) || 1;
    let width = Math.floor(bodyTable.getBoundingClientRect().width / zoom);
    const widths = columns.map(column => Math.floor(column.getBoundingClientRect().width / zoom));
    const flexibleColumns = columns.map((column, index) => !originalWidths[index] && !column.className.trim() && widths[index] > 0 ? index : -1).filter(index => index >= 0);
    if (flexibleColumns.length > 1) {
        const periodWidth = Math.min(...flexibleColumns.map(index => widths[index]));
        flexibleColumns.forEach(index => widths[index] = periodWidth);
    }

    const spareColumn = originalWidths.findLastIndex((value, index) => parseFloat(value) >= 80 && widths[index] > 0);
    const spare = width - widths.reduce((sum, value) => sum + value, 0);
    widths[spareColumn >= 0 ? spareColumn : widths.length - 1] += spare;
    if (header.id === 'teacher-list-header' && flexibleColumns.length === 1) {
        // 모든 감독 열을 쓰는 좁은 창에서도 참고사항 칸이 0px로 붕괴하지 않게 한다.
        const notes = flexibleColumns[0];
        const extra = Math.max(0, 80 - widths[notes]);
        widths[notes] += extra;
        width += extra;
    }
    bodyTable.style.width = headerTable.style.width = `${width}px`;
    headerTable.style.minWidth = `${width}px`;
    const headerColumns = [...headerTable.querySelector('colgroup').children];
    columns.forEach((column, index) => {
        column.style.width = headerColumns[index].style.width = `${widths[index]}px`;
    });
    headerTable.classList.add('grid-table-header');
    const head = headerTable.tHead;
    const gridColumns = columns.map(column => `${column.getBoundingClientRect().width / zoom}px`).join(' ');
    head.style.gridTemplateColumns = gridColumns;
    headerTable.style.width = headerTable.style.minWidth = `${bodyTable.getBoundingClientRect().width / zoom}px`;
    if (!head.dataset.gridPlaced) {
        const occupied = [];
        [...head.rows].forEach((row, rowIndex) => {
            occupied[rowIndex] ||= new Set();
            let columnIndex = 0;
            [...row.cells].forEach(cell => {
                while (occupied[rowIndex].has(columnIndex)) columnIndex++;
                cell.style.gridColumn = `${columnIndex + 1} / span ${cell.colSpan}`;
                cell.style.gridRow = `${rowIndex + 1} / span ${cell.rowSpan}`;
                for (let rowOffset = 1; rowOffset < cell.rowSpan; rowOffset++) {
                    occupied[rowIndex + rowOffset] ||= new Set();
                    for (let offset = 0; offset < cell.colSpan; offset++) occupied[rowIndex + rowOffset].add(columnIndex + offset);
                }
                columnIndex += cell.colSpan;
            });
        });
        head.dataset.gridPlaced = 'true';
    }
    header.style.paddingRight = `${scroll.offsetWidth - scroll.clientWidth}px`;
    if (header.id === 'teacher-list-header' || header.classList.contains('result-table-header')) {
        // 같은 좌표라도 table 셀과 grid 셀은 소수 배율에서 선을 다르게 그린다.
        // 본문도 헤더와 동일한 grid 트랙을 사용해 두 렌더링 방식을 통일한다.
        bodyTable.style.setProperty('--split-columns', gridColumns);
        bodyTable.classList.add('split-grid-body');
        const visibleColumns = columns.map((column, index) => column.classList.contains('hidden') ? -1 : index + 1).filter(index => index > 0);
        bodyTable.querySelectorAll('tbody tr').forEach(row => [...row.cells].forEach((cell, index) => {
            cell.style.gridColumn = cell.colSpan > 1 ? '1 / -1' : String(visibleColumns[index]);
        }));
        if (header.id === 'teacher-list-header') header.scrollLeft = scroll.scrollLeft;
    }
    if (viewport) viewport.scrollLeft = scroll.scrollLeft;
}

// ── 가이드 투어 ──────────────────────────────────────────────────────
// 일하는 순서대로 사이드바 버튼을 하나씩 밝히고 옆에 설명 카드를 띄운다.
// '다시 보지 않기'는 settings.json 의 hideTour 에 둔다 (main.py get_settings / set_setting).
const TOUR_STEPS = [
    { el: '[data-target="tab-config"]',   title: '1. 기초 설정',  text: '시험 날짜와 교시, 시험 보는 학년과 과목을 정합니다. 교실마다 감독을 몇 명 둘지도 여기서 정합니다.' },
    { el: '[data-target="tab-teachers"]', title: '2. 감독 명단',  text: '감독 들어가실 선생님을 설정합니다. 엑셀 양식으로 한꺼번에 불러올 수도 있고, 선생님마다 맡을 수 있는 감독을 체크합니다.' },
    { el: '[data-target="tab-absences"]', title: '3. 결시 관리',  text: '출장·수업 등으로 감독할 수 없는 시간을 표시합니다. 선생님별 배정 제한도 여기서 정합니다.' },
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
