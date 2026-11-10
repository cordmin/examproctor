// 배정 제외 도구와 표 입력.
// ── 배정 제외 표시 ──────────────────────────────────────────────────────
// 제외 종류를 마커 팔레트로 범주 구분한다(색이 곧 분류 신호).
// 브러시 툴바 / 표 셀 / 드래그 칠하기 세 곳이 이 함수 하나를 공유한다.
const ABSENCE_MARK = {
    ALL: 'bg-coral text-white',
    '1': 'bg-yellow-400 text-slate-900 font-bold',
    '2': 'bg-emerald-600 text-white',
    '3': 'bg-blue-600 text-white',
    CLASS: 'bg-orchid text-white',
};

function absenceFill(type, target) {
    if (type === 'ALL' || type === 'CLASS') return ABSENCE_MARK[type];
    return ABSENCE_MARK[String(target)] || ABSENCE_MARK.CLASS;
}

// 표 렌더와 드래그 즉시 갱신이 같은 버튼 모양을 쓰도록 한 곳에 모은다.
const ABS_BTN_BASE = 'w-full h-full min-h-[34px] text-[12.5px] font-bold rounded-md';

function absenceLabel(type, target) {
    if (type === 'ALL') return '전체 제외';
    return type === 'GRADE' ? `${target}학년 제외` : `${target} 제외`;
}

function absenceTargets(data) {
    if (!data || data.target == null) return [];
    return [...new Set((Array.isArray(data.target) ? data.target : [data.target]).map(String))].sort((a, b) => Number(a) - Number(b));
}

function renderAbsenceButton(button, data) {
    const targets = absenceTargets(data);
    const multiple = data?.type === 'GRADE' && targets.length > 1;
    const detail = data?.type === 'GRADE' ? `${targets.map(grade => `${grade}학년`).join('·')} 제외` : data ? absenceLabel(data.type, data.target) : '제외 없음';
    button.className = `${ABS_BTN_BASE} ${data ? (multiple ? 'text-white font-bold cursor-default' : absenceFill(data.type, targets[0])) : 'bg-transparent text-transparent hover:bg-surface-100 hover:text-pebble'}`;
    button.textContent = data ? absenceLabel(data.type, multiple ? targets.join('·') : targets[0]) : '+';
    button.classList.toggle('absence-add', !data);
    button.title = detail;
    button.setAttribute('aria-label', detail);
    button.style.backgroundImage = '';
    button.style.textShadow = '';
    if (multiple) {
        const colors = {'1': '#FACC15', '2': '#059669', '3': '#2563EB'};
        const stops = targets.map((grade, index) => `${colors[grade] || '#7C3AED'} ${index * 100 / targets.length}% ${(index + 1) * 100 / targets.length}%`);
        button.style.backgroundImage = `linear-gradient(to right, ${stops.join(', ')})`;
        button.style.textShadow = '0 1px 2px #00000099';
    }
}

window.setBrush = function(type, target, btnElement) {
    let targetEl = btnElement;
    if(type === 'CLASS') {
        const cSel = document.getElementById('brush-class-select');
        if(cSel) target = cSel.value;
        targetEl = document.getElementById('brush-class-wrapper');
    }
    document.querySelectorAll('.abs-brush').forEach(button => {
        const selected = button === targetEl;
        button.classList.toggle('is-active', selected);
        if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', String(selected));
    });
    activeBrush = { type, target, fill: absenceFill(type, target) };
};

window.renderAbsencesTab = function() {
    const thead = document.getElementById('absence-list-head'); const tbody = document.getElementById('absence-list-body');
    const { periodsByDate, dates } = groupPeriodsByDate();

    const tContainer = document.getElementById('brush-toolbar');
    const brushCls = 'abs-brush px-3 inline-flex items-center justify-center rounded-lg font-bold text-[12px] cursor-pointer';
    let tHtml = '';
    tHtml += `<button type="button" class="${brushCls} ${absenceFill('ALL')}" data-type="ALL" data-target="">전체 제외</button>`;
    appData.config.grades.forEach(g => {
        tHtml += `<button type="button" class="${brushCls} ${absenceFill('GRADE', g)}" data-type="GRADE" data-target="${g}">${g}학년 제외</button>`;
    });
    let cOpts = ''; appData.config.grades.forEach(g => { for(let c=1; c<=(appData.config.classes[g]||0); c++) cOpts += `<option value="${g}-${c}">${g}-${c}</option>`; });
    tHtml += `<div class="inline-flex items-center gap-2 pl-3 pr-1 rounded-lg abs-brush cursor-pointer ${absenceFill('CLASS')}" id="brush-class-wrapper" data-type="CLASS"><span class="font-bold text-[12px] text-white pointer-events-none select-none">학급 제외</span><select id="brush-class-select" class="text-[11px] font-bold" aria-label="제외 학급 선택" onchange="event.stopPropagation(); setBrush('CLASS', this.value, document.getElementById('brush-class-wrapper'));">${cOpts}</select></div>`;
    tContainer.innerHTML = tHtml;
    // currentTarget: 학급 제외는 내부 select 클릭도 wrapper 기준으로 처리해야 한다.
    document.querySelectorAll('.abs-brush').forEach(b => { b.onclick = (e) => setBrush(e.currentTarget.getAttribute('data-type'), e.currentTarget.getAttribute('data-target'), e.currentTarget); });

    const classSelect = document.getElementById('brush-class-select');
    if (activeBrush.type === 'CLASS' && [...classSelect.options].some(option => option.value === activeBrush.target)) classSelect.value = activeBrush.target;
    const selectedBrush = [...tContainer.querySelectorAll('.abs-brush')].find(button => button.dataset.type === activeBrush.type && (activeBrush.type !== 'GRADE' || button.dataset.target === String(activeBrush.target))) || tContainer.querySelector('[data-type="ALL"]');
    setBrush(selectedBrush.dataset.type, selectedBrush.dataset.target || '', selectedBrush);
    refreshDropdowns();

    const periodCount = Math.max(1, dates.reduce((count, date) => count + periodsByDate[date].length, 0));
    const columns = '<col style="width:40px"><col style="width:100px"><col style="width:112px">' + '<col>'.repeat(periodCount) + '<col style="width:200px">';
    document.getElementById('absence-header-columns').innerHTML = columns;
    document.getElementById('absence-body-columns').innerHTML = columns;
    document.querySelectorAll('#absence-table-header table, #absence-table').forEach(table => table.style.minWidth = `${452 + periodCount * 48}px`);
    requestAnimationFrame(syncAbsenceHeader);

    const dateHeaders = build2RowDatePeriodHeaderParts(periodsByDate, dates, 'text-[13px]');
    const row1 = `<tr>
        <th rowspan="2" class="p-2 align-middle text-[13px] border-b border-r border-line bg-[#F1F5F9]">순</th>
        <th rowspan="2" class="p-2 align-middle border-b border-r border-line text-[14.5px] bg-[#F1F5F9]">성명</th>
        <th id="absence-limit-label" rowspan="2" class="p-2 leading-tight align-middle text-[13px] border-b border-r border-line bg-[#F1F5F9]" data-page-hint="시험 기간 중 감독 배정 시간의 최대값을 설정">배정 제한</th>
        ${dateHeaders.row1}
        <th rowspan="2" class="p-2 align-middle text-[13px] border-b border-line bg-[#F1F5F9]">참고</th>
    </tr>`;
    const row2 = `<tr>${dateHeaders.row2}</tr>`;

    if (thead) {
        thead.className = "text-text-main font-bold text-[13px]";
        thead.innerHTML = `${row1}${row2}`;
        delete thead.dataset.gridPlaced;
    }

    if (!tbody) return;
    if (appData.teachers.length === 0) {
        tbody.innerHTML = emptyTableRows(periodCount + 4);
        return;
    }

    let rows = "";
    appData.teachers.forEach((t, idx) => {
        const valMax = (t.maxPeriods && t.maxPeriods > 0 && t.maxPeriods < 99) ? t.maxPeriods : "";
        let rHtml = `<tr class="hover:bg-surface-50">
        <td class="py-2.5 px-1 border border-line bg-surface-100 font-bold text-[13px] text-center">${idx+1}</td>
        <td class="py-2.5 px-2 border border-line font-bold bg-surface-0 text-center text-[14.5px]">${t.name||'-'}</td>
        <td class="py-2.5 px-1 border border-line bg-surface-0 text-center">
            <div class="limit-control">
                <div class="limit-value">
                    <input type="number" min="0" max="99" placeholder="－" aria-label="${t.name || '교사'} 배정 제한 시간" style="width:${String(valMax).length || 1}ch" value="${valMax}"
                           oninput="updateLimitDisplay(this)"
                           onchange="if (!(this.value > 0)) this.value = ''; updateLimitDisplay(this); updateTeacher('${t.id}', 'maxPeriods', this.value, false)">
                    <span ${valMax ? '' : 'hidden'}>시간</span>
                </div>
                <div class="limit-step">
                    <button type="button" aria-label="${t.name || '교사'} 배정 제한 늘리기" onclick="stepTeacherLimit(this, 1)"><svg viewBox="0 0 8 5" aria-hidden="true"><path d="M4 0 8 5H0Z" fill="currentColor"/></svg></button>
                    <button type="button" aria-label="${t.name || '교사'} 배정 제한 줄이기" onclick="stepTeacherLimit(this, -1)"><svg viewBox="0 0 8 5" aria-hidden="true"><path d="M0 0H8L4 5Z" fill="currentColor"/></svg></button>
                </div>
            </div>
        </td>`;

        if(!t.absences) t.absences = {};
        dates.forEach((d, dIdx) => {
            periodsByDate[d].forEach((p, pIdx) => {
                const borders = cellBorders(periodsByDate, dates, dIdx, pIdx);
                rHtml += `<td class="py-1 px-1 border border-line bg-surface-0 ${borders} text-center">
                    <button class="${ABS_BTN_BASE}" data-absence-teacher="${t.id}" data-absence-period="${p.id}"
                            onmousedown="handleAbsMouseDown(event, '${t.id}', '${p.id}')"
                            onmouseenter="handleAbsMouseEnter(event, '${t.id}', '${p.id}')"
                            onmousemove="handleAbsMouseMove(event, '${t.id}', '${p.id}')"
                            oncontextmenu="event.preventDefault();">+</button></td>`;
            });
        });

        if (!dates.length) rHtml += '<td class="border border-line"></td>';
        rHtml += `<td class="p-1.5 border border-line border-edge text-[13px] text-left font-medium bg-surface-0 text-text-main overflow-hidden flex items-center" title="${t.notes||''}"><span class="block min-w-0 truncate">${t.notes||''}</span></td>`;
        rows += rHtml + `</tr>`;
    });
    tbody.innerHTML = rows;
    const teachersById = new Map(appData.teachers.map(teacher => [teacher.id, teacher]));
    tbody.querySelectorAll('[data-absence-teacher]').forEach(button => renderAbsenceButton(button, teachersById.get(button.dataset.absenceTeacher).absences[button.dataset.absencePeriod]));
};

// 한 번의 드래그 동안 처음 만난 영역을 기준으로 지워, 펼쳐진 나머지를 같은 위치에서 다시 지우지 않는다.
const absenceEraseGesture = new Map();
document.addEventListener('mouseup', () => absenceEraseGesture.clear());

window.handleAbsMouseDown = function(e, tId, pId) {
    absenceEraseGesture.clear();
    if(e.button === 0) { isDragging = true; isRightDragging = false; dragTargetBtn = e.currentTarget; applyAbsence(tId, pId, true, false, e.currentTarget, e); }
    else if(e.button === 2) { isRightDragging = true; isDragging = false; applyAbsence(tId, pId, false, true, e.currentTarget, e); }
};
window.handleAbsMouseEnter = function(e, tId, pId) {
    if(isDragging) applyAbsence(tId, pId, true, false, e.currentTarget, e);
    else if(isRightDragging && (e.buttons & 2)) applyAbsence(tId, pId, false, true, e.currentTarget, e);
};
window.handleAbsMouseMove = function(e, tId, pId) {
    if(isRightDragging && (e.buttons & 2)) applyAbsence(tId, pId, false, true, e.currentTarget, e);
};

function applyAbsence(tId, pId, isAdd, isRemove, btn, event) {
    const teacher = appData.teachers.find(t => t.id === tId);
    if (!teacher.absences) teacher.absences = {};
    if (isAdd && activeBrush.type === 'CLASS') activeBrush.target = document.getElementById('brush-class-select').value;
    const current = teacher.absences[pId];
    if (isAdd) {
        if (activeBrush.type === 'ALL') teacher.absences[pId] = {type: 'ALL', target: ''};
        else if (current?.type !== 'ALL') {
            if (activeBrush.type === 'GRADE') {
                const grades = current?.type === 'GRADE' ? absenceTargets(current) : [];
                const targets = [...new Set([...grades, String(activeBrush.target)])].sort((a, b) => Number(a) - Number(b));
                teacher.absences[pId] = {type: 'GRADE', target: targets.length === 1 ? targets[0] : targets};
            } else teacher.absences[pId] = {type: 'CLASS', target: activeBrush.target};
        }
    }
    if (isRemove && current) {
        if (current.type === 'GRADE') {
            const key = `${tId}|${pId}`;
            if (!absenceEraseGesture.has(key)) absenceEraseGesture.set(key, {targets: absenceTargets(current), bounds: btn.getBoundingClientRect()});
            const {targets: original, bounds} = absenceEraseGesture.get(key);
            const segment = Math.max(0, Math.min(original.length - 1, Math.floor((event.clientX - bounds.left) / bounds.width * original.length)));
            const targets = absenceTargets(current).filter(grade => grade !== original[segment]);
            if (targets.length) teacher.absences[pId] = {type: 'GRADE', target: targets.length === 1 ? targets[0] : targets};
            else delete teacher.absences[pId];
        } else delete teacher.absences[pId];
    }
    renderAbsenceButton(btn, teacher.absences[pId]);
}

window.clearAllAbsences = function() {
    openConfirmModal("배정 제외 전체 초기화", "입력된 모든 교사의 배정 제외 데이터를<br>전체 초기화하시겠습니까?", "초기화 실행", () => {
        appData.teachers.forEach(t => t.absences = {});
        renderAbsencesTab();
        showToast("모든 배정 제외 데이터가 초기화되었습니다.", "success");
    });
};

window.updateLimitDisplay = function(input) {
    input.style.width = `${input.value.length || 1}ch`;
    input.nextElementSibling.hidden = !(Number(input.value) > 0);
};

window.stepTeacherLimit = function(button, direction) {
    const input = button.closest('.limit-control').querySelector('input');
    if (direction > 0) input.stepUp();
    else input.stepDown();
    input.dispatchEvent(new Event('input', {bubbles: true}));
    input.dispatchEvent(new Event('change', {bubbles: true}));
};
