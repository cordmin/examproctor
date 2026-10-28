// 감독 명단 · 결시 관리 화면.
// 결시 표는 드래그로 칠하는 방식이라 마우스 핸들러가 함께 있다.

const roleMenu = document.getElementById('role-menu');
let roleMenuTrigger = null;
let selectedRole = null;

function closeRoleMenu(restoreFocus = false) {
    roleMenu.hidden = true;
    if (roleMenuTrigger) {
        roleMenuTrigger.setAttribute('aria-expanded', 'false');
        if (restoreFocus) roleMenuTrigger.focus();
    }
    roleMenuTrigger = null;
    selectedRole = null;
}

window.openRoleMenu = function(event, role) {
    const trigger = event.currentTarget;
    const wasOpen = roleMenuTrigger === trigger;
    closeRoleMenu();
    if (wasOpen) return;
    roleMenuTrigger = trigger;
    selectedRole = role;
    trigger.setAttribute('aria-expanded', 'true');
    roleMenu.hidden = false;
    const rect = trigger.getBoundingClientRect();
    // 화면 맞춤 확대율을 반영해 실제 화살표 중심과 메뉴 중심을 맞춘다.
    const zoom = parseFloat(document.documentElement.style.zoom) || 1;
    const menuRect = roleMenu.getBoundingClientRect();
    roleMenu.style.left = `${Math.max(4, Math.min(rect.left + rect.width / 2 - menuRect.width / 2, window.innerWidth - menuRect.width - 4)) / zoom}px`;
    roleMenu.style.top = `${Math.max(4, Math.min(rect.bottom + 3, window.innerHeight - menuRect.height - 4)) / zoom}px`;
    roleMenu.querySelector('button').focus();
};

roleMenu.addEventListener('click', event => {
    const item = event.target.closest('[data-checked]');
    if (!item) return;
    const role = selectedRole;
    closeRoleMenu(true);
    toggleAllRoles(role, item.dataset.checked === 'true');
});
document.addEventListener('click', event => {
    if (!event.target.closest('.role-menu, .role-menu-btn')) closeRoleMenu();
});
document.addEventListener('keydown', event => {
    if (roleMenu.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); closeRoleMenu(true); }
    else if (event.key === 'Tab') closeRoleMenu();
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const items = [...roleMenu.querySelectorAll('button')];
        const step = event.key === 'ArrowDown' ? 1 : -1;
        items[(items.indexOf(document.activeElement) + step + items.length) % items.length].focus();
    }
});
document.addEventListener('scroll', () => closeRoleMenu(), true);
window.addEventListener('resize', () => closeRoleMenu());

window.renderTeachers = function() {
    requestAnimationFrame(syncTeacherHeader);
    closeRoleMenu();
    const tbody = document.getElementById('teacher-list-body'); tbody.innerHTML = "";

    const activeGrades = appData.config.grades || [];
    const totalHallways = [1,2,3].reduce((sum, g) => sum + (activeGrades.includes(g) ? (appData.config.hallways[g] || 0) : 0), 0);
    const totalSeparated = [1,2,3].reduce((sum, g) => sum + (activeGrades.includes(g) ? (appData.config.separated[g] || 0) : 0), 0);
    const totalSpecial = [1,2,3].reduce((sum, g) => sum + (activeGrades.includes(g) ? (appData.config.special[g] || 0) : 0), 0);

    const c1Dis = !activeGrades.includes(1);
    const c2Dis = !activeGrades.includes(2);
    const c3Dis = !activeGrades.includes(3);
    const hwDis = totalHallways === 0;
    const sepDis = totalSeparated === 0;
    const spDis = totalSpecial === 0;

    // 기초 설정에서 쓰지 않는 감독 유형은 열째로 숨긴다. 남는 폭은 참고사항 열이 가져간다.
    const hiddenRole = { isClass1: c1Dis, isClass2: c2Dis, isClass3: c3Dis, isHallway: hwDis, isSeparated: sepDis, isSpecial: spDis };
    document.querySelectorAll('#tab-teachers [data-role]').forEach(el => el.classList.toggle('hidden', !!hiddenRole[el.dataset.role]));

    if (appData.teachers.length === 0) { tbody.innerHTML = `<tr><td colspan="14" class="p-12 text-pebble font-bold bg-surface-50">명단이 없습니다.</td></tr>`; return; }

    let rows = "";
    appData.teachers.forEach((t, idx) => {
        rows += `
            <tr class="row-hover">
                <td class="py-2.5 px-1 border border-line bg-surface-100 font-bold text-[11px]">${idx+1}</td>
                <td class="py-2.5 px-1 border border-line"><input type="text" class="w-full text-center bg-transparent focus:outline-none font-bold text-[14.5px] p-0.5" value="${t.name||''}" onchange="updateTeacher('${t.id}', 'name', this.value, false); renderAbsencesTab();"></td>
                <td class="py-2.5 px-1 border border-line"><input type="text" class="w-full text-center bg-transparent focus:outline-none font-bold text-[14.5px] p-0.5" value="${t.subject||''}" onchange="updateTeacher('${t.id}', 'subject', this.value, false)"></td>
                <td class="py-2.5 px-1 border border-line"><input type="text" class="w-full text-center bg-transparent focus:outline-none font-bold text-[14.5px] p-0.5" value="${t.homeroom||''}" onchange="updateTeacher('${t.id}', 'homeroom', this.value, false)"></td>
                <td class="py-2.5 px-1 border border-line"><input type="checkbox" class="chk-custom" ${t.isMain!==false?'checked':''} onchange="updateTeacher('${t.id}', 'isMain', this.checked, false)"></td>
                <td class="py-2.5 px-1 border border-line"><input type="checkbox" class="chk-custom" ${t.isSub!==false?'checked':''} onchange="updateTeacher('${t.id}', 'isSub', this.checked, false)"></td>
                
                ${c1Dis ? '' : `<td class="py-2.5 px-1 border border-line bg-yellow-50/80"><input type="checkbox" class="chk-custom" ${t.isClass1!==false?'checked':''} onchange="updateTeacher('${t.id}', 'isClass1', this.checked, false)"></td>`}
                ${c2Dis ? '' : `<td class="py-2.5 px-1 border border-line bg-emerald-50/80"><input type="checkbox" class="chk-custom" ${t.isClass2!==false?'checked':''} onchange="updateTeacher('${t.id}', 'isClass2', this.checked, false)"></td>`}
                ${c3Dis ? '' : `<td class="py-2.5 px-1 border border-line bg-blue-50/80"><input type="checkbox" class="chk-custom" ${t.isClass3!==false?'checked':''} onchange="updateTeacher('${t.id}', 'isClass3', this.checked, false)"></td>`}
                
                ${hwDis ? '' : `<td class="py-2.5 px-1 border border-line"><input type="checkbox" class="chk-custom" ${t.isHallway?'checked':''} onchange="updateTeacher('${t.id}', 'isHallway', this.checked, false)"></td>`}
                ${sepDis ? '' : `<td class="py-2.5 px-1 border border-line"><input type="checkbox" class="chk-custom" ${t.isSeparated?'checked':''} onchange="updateTeacher('${t.id}', 'isSeparated', this.checked, false)"></td>`}
                ${spDis ? '' : `<td class="py-2.5 px-1 border border-line"><input type="checkbox" class="chk-custom" ${t.isSpecial?'checked':''} onchange="updateTeacher('${t.id}', 'isSpecial', this.checked, false)"></td>`}
                <td class="py-2.5 px-1 border border-line w-full"><input type="text" id="note-t-${idx}" data-tid="${t.id}" class="w-full bg-transparent focus:outline-none text-stone text-sm p-0.5 text-left px-2" value="${t.notes||''}" onchange="updateTeacher('${t.id}', 'notes', this.value, false)" onkeydown="handleNotesKey(event, ${idx}, 't')" onpaste="handleNotesPaste(event, ${idx}, 't')"></td>
                <td class="py-2.5 px-1 border border-line"><button class="text-coral transition-transform inline-flex items-center justify-center mx-auto x-btn" onclick="deleteTeacher('${t.id}')"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg></button></td>
            </tr>`;
    });
    tbody.innerHTML = rows;
};

// ── 결시 표시 ──────────────────────────────────────────────────────────
// 결시 종류를 마커 팔레트로 범주 구분한다(색이 곧 분류 신호).
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
    if (type === 'ALL') return '결시';
    return type === 'GRADE' ? `결시(${target}학년)` : `결시(${target})`;
}

function absenceTargets(data) {
    if (!data || data.target == null) return [];
    return [...new Set((Array.isArray(data.target) ? data.target : [data.target]).map(String))].sort((a, b) => Number(a) - Number(b));
}

function renderAbsenceButton(button, data) {
    const targets = absenceTargets(data);
    const multiple = data?.type === 'GRADE' && targets.length > 1;
    const detail = data?.type === 'GRADE' ? `${targets.map(grade => `${grade}학년`).join('·')} 결시` : data ? absenceLabel(data.type, data.target) : '결시 없음';
    button.className = `${ABS_BTN_BASE} ${data ? (multiple ? 'text-white font-bold cursor-default' : absenceFill(data.type, targets[0])) : 'bg-transparent text-transparent hover:bg-surface-100 hover:text-pebble'}`;
    button.textContent = data ? (multiple ? '결시' : absenceLabel(data.type, targets[0])) : '+';
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
    let tHtml = `<span class="font-bold text-[12px] text-white mr-1 self-center">결시 선택:</span>`;
    tHtml += `<button type="button" class="${brushCls} ${absenceFill('ALL')}" data-type="ALL" data-target="">전체 결시</button>`;
    appData.config.grades.forEach(g => {
        tHtml += `<button type="button" class="${brushCls} ${absenceFill('GRADE', g)}" data-type="GRADE" data-target="${g}">${g}학년 결시</button>`;
    });
    let cOpts = ''; appData.config.grades.forEach(g => { for(let c=1; c<=(appData.config.classes[g]||0); c++) cOpts += `<option value="${g}-${c}">${g}-${c}</option>`; });
    tHtml += `<div class="inline-flex items-center gap-2 pl-3 pr-1 rounded-lg abs-brush cursor-pointer ${absenceFill('CLASS')}" id="brush-class-wrapper" data-type="CLASS"><span class="font-bold text-[12px] text-white pointer-events-none select-none">학급 결시</span><select id="brush-class-select" class="text-[11px] font-bold" aria-label="결시 학급 선택" onchange="event.stopPropagation(); setBrush('CLASS', this.value, document.getElementById('brush-class-wrapper'));">${cOpts}</select></div>`;
    tContainer.innerHTML = tHtml;
    // currentTarget: 학급 결시는 내부 select 클릭도 wrapper 기준으로 처리해야 한다.
    document.querySelectorAll('.abs-brush').forEach(b => { b.onclick = (e) => setBrush(e.currentTarget.getAttribute('data-type'), e.currentTarget.getAttribute('data-target'), e.currentTarget); });

    const classSelect = document.getElementById('brush-class-select');
    if (activeBrush.type === 'CLASS' && [...classSelect.options].some(option => option.value === activeBrush.target)) classSelect.value = activeBrush.target;
    const selectedBrush = [...tContainer.querySelectorAll('.abs-brush')].find(button => button.dataset.type === activeBrush.type && (activeBrush.type !== 'GRADE' || button.dataset.target === String(activeBrush.target))) || tContainer.querySelector('[data-type="ALL"]');
    setBrush(selectedBrush.dataset.type, selectedBrush.dataset.target || '', selectedBrush);
    refreshDropdowns();

    const periodCount = dates.reduce((count, date) => count + periodsByDate[date].length, 0);
    const columns = '<col style="width:40px"><col style="width:100px"><col style="width:112px">' + '<col>'.repeat(periodCount) + '<col style="width:200px">';
    document.getElementById('absence-header-columns').innerHTML = columns;
    document.getElementById('absence-body-columns').innerHTML = columns;
    document.querySelectorAll('#absence-table-header table, #absence-table').forEach(table => table.style.minWidth = `${452 + periodCount * 48}px`);
    requestAnimationFrame(syncAbsenceHeader);

    const dateHeaders = build2RowDatePeriodHeaderParts(periodsByDate, dates, 'text-[13px]');
    const row1 = `<tr>
        <th rowspan="2" class="p-2 align-middle text-[13px] border-b border-r border-line bg-[#F1F5F9]">순</th>
        <th rowspan="2" class="p-2 align-middle border-b border-r border-line text-[14.5px] bg-[#F1F5F9]">성명</th>
        <th rowspan="2" class="p-2 leading-tight align-middle text-[13px] border-b border-r border-line bg-[#F1F5F9]">배정 제한<br>(시간)</th>
        ${dateHeaders.row1}
        <th rowspan="2" class="p-2 align-middle text-[13px] border-b border-line bg-[#F1F5F9]">참고사항</th>
    </tr>`;
    const row2 = `<tr>${dateHeaders.row2}</tr>`;

    if (thead) {
        thead.className = "text-text-main font-bold text-[13px]";
        thead.innerHTML = `${row1}${row2}`;
        delete thead.dataset.gridPlaced;
    }

    if (!tbody) return;
    if (appData.teachers.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="${periodCount + 4}" class="p-12 text-pebble font-bold bg-surface-50 text-center">명단이 없습니다.</td></tr>`;
        return; 
    }

    let rows = "";
    appData.teachers.forEach((t, idx) => {
        const valMax = (t.maxPeriods && t.maxPeriods > 0 && t.maxPeriods < 99) ? t.maxPeriods : "";
        let rHtml = `<tr class="hover:bg-surface-50">
        <td class="py-2.5 px-1 border border-line bg-surface-100 font-bold text-[13px] text-center">${idx+1}</td>
        <td class="py-2.5 px-2 border border-line font-bold bg-surface-0 text-center text-[14.5px]">${t.name||'-'}</td>
        <td class="py-2.5 px-1 border border-line bg-surface-0 text-center"><input type="number" min="0" max="99" class="w-full text-center outline-none bg-transparent text-sm" value="${valMax}" onchange="updateTeacher('${t.id}', 'maxPeriods', this.value, false)"></td>`;
        
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
        
        rHtml += `<td class="p-1.5 border border-line border-edge text-[13px] text-left font-medium bg-surface-0 text-text-main overflow-hidden truncate" title="${t.notes||''}">${t.notes||''}</td>`;
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
    openConfirmModal("결시 전체 초기화", "입력된 모든 교사의 결시 데이터를<br>전체 초기화하시겠습니까?", "초기화 실행 (Enter)", () => {
        appData.teachers.forEach(t => t.absences = {});
        renderAbsencesTab();
        showToast("모든 결시 데이터가 초기화되었습니다.", "success");
    });
};
