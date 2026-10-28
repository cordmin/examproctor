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

window.setBrush = function(type, target, btnElement) {
    const activeClasses = ['ring-4', 'ring-offset-2', 'ring-stone-900', 'scale-105', 'shadow-md', 'opacity-100', 'z-10', 'saturate-100'];
    const inactiveClasses = ['opacity-30', 'hover:opacity-75', 'scale-95', 'saturate-50'];

    document.querySelectorAll('.abs-brush').forEach(b => {
        b.classList.remove(...activeClasses);
        b.classList.add(...inactiveClasses);
    });

    let targetEl = btnElement;
    if(type === 'CLASS') {
        const cSel = document.getElementById('brush-class-select');
        if(cSel) target = cSel.value;
        targetEl = document.getElementById('brush-class-wrapper');
    }
    if(targetEl) {
        targetEl.classList.remove(...inactiveClasses);
        targetEl.classList.add(...activeClasses);
    }
    activeBrush = { type, target, fill: absenceFill(type, target) };
};

window.renderAbsencesTab = function() {
    const thead = document.getElementById('absence-list-head'); const tbody = document.getElementById('absence-list-body');
    const { periodsByDate, dates } = groupPeriodsByDate();

    const tContainer = document.getElementById('brush-toolbar');
    const activeCls = 'ring-4 ring-stone-900 ring-offset-2 scale-105 shadow-md opacity-100 z-10 saturate-100';
    const inactiveCls = 'opacity-30 hover:opacity-75 scale-95 saturate-50';
    const brushCls = 'abs-brush h-[36px] px-4 inline-flex items-center justify-center rounded-lg font-bold text-[13.5px] cursor-pointer transition-all duration-200';
    let tHtml = `<span class="font-bold text-[14px] text-stone mr-1.5 self-center">결시 선택:</span>`;
    tHtml += `<button class="${brushCls} ${activeCls} ${absenceFill('ALL')}" data-type="ALL" data-target="">전체 결시</button>`;
    appData.config.grades.forEach(g => {
        tHtml += `<button class="${brushCls} ${inactiveCls} ${absenceFill('GRADE', g)}" data-type="GRADE" data-target="${g}">${g}학년 결시</button>`;
    });
    let cOpts = ''; appData.config.grades.forEach(g => { for(let c=1; c<=(appData.config.classes[g]||0); c++) cOpts += `<option value="${g}-${c}" class="text-slate-900 bg-white">${g}-${c}</option>`; });
    tHtml += `<div class="h-[36px] inline-flex items-center gap-2 pl-3 pr-1.5 rounded-lg ${inactiveCls} abs-brush cursor-pointer transition-all duration-200 ${absenceFill('CLASS')}" id="brush-class-wrapper" data-type="CLASS" data-target="${appData.config.grades[0]?appData.config.grades[0]+'-1':''}"><span class="font-bold text-[13.5px] text-white pointer-events-none select-none">학급 결시</span><select id="brush-class-select" class="px-2 py-1 text-[13px] font-bold cursor-pointer text-white bg-white/20 border border-white/40 rounded outline-none" onchange="event.stopPropagation(); setBrush('CLASS', this.value, document.getElementById('brush-class-wrapper'));">${cOpts}</select></div>`;
    tHtml += `<span class="text-[14.5px] font-bold text-text-main ml-5 inline-flex items-center gap-1.5 self-center"><span class="text-amber-600">TIP:</span> 왼클릭 드래그 연속추가, 우클릭 드래그 연속삭제</span>`;
    tContainer.innerHTML = tHtml;
    // currentTarget: 학급 결시는 내부 select 클릭도 wrapper 기준으로 처리해야 한다.
    document.querySelectorAll('.abs-brush').forEach(b => { b.onclick = (e) => setBrush(e.currentTarget.getAttribute('data-type'), e.currentTarget.getAttribute('data-target'), e.currentTarget); });

    refreshDropdowns();

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
        thead.className = "bg-[#F1F5F9] text-text-main font-bold text-[13px] sticky top-0 z-20 shadow-sm";
        thead.innerHTML = `${row1}${row2}`;
    }

    if (!tbody) return;
    if (appData.teachers.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="20" class="p-12 text-pebble font-bold bg-surface-50 text-center">명단이 없습니다.</td></tr>`; 
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
                const absData = t.absences[p.id];
                const btnClass = absData
                    ? absenceFill(absData.type, absData.target)
                    : "bg-transparent text-transparent hover:bg-surface-100 hover:text-pebble";
                const btnText = absData ? absenceLabel(absData.type, absData.target) : "+";

                rHtml += `<td class="py-1 px-1 border border-line bg-surface-0 ${borders} text-center">
                    <button class="${ABS_BTN_BASE} ${btnClass}"
                            onmousedown="handleAbsMouseDown(event, '${t.id}', '${p.id}')"
                            onmouseenter="handleAbsMouseEnter(event, '${t.id}', '${p.id}')"
                            oncontextmenu="event.preventDefault();">${btnText}</button></td>`;
            });
        });
        
        rHtml += `<td class="p-1.5 border border-line border-edge text-[13px] text-left font-medium bg-surface-0 text-text-main overflow-hidden truncate" title="${t.notes||''}">${t.notes||''}</td>`;
        rows += rHtml + `</tr>`;
    });
    tbody.innerHTML = rows;
};

window.handleAbsMouseDown = function(e, tId, pId) {
    pushUndo();   // 한 번 끌어 칠하는 동작 전체가 되돌리기 한 단위
    if(e.button === 0) { isDragging = true; isRightDragging = false; dragTargetBtn = e.target; applyAbsence(tId, pId, true, false, e.target); }
    else if(e.button === 2) { isRightDragging = true; isDragging = false; applyAbsence(tId, pId, false, true, e.target); }
};
window.handleAbsMouseEnter = function(e, tId, pId) {
    if(isDragging) applyAbsence(tId, pId, true, false, e.target);
    else if(isRightDragging) applyAbsence(tId, pId, false, true, e.target);
};

function applyAbsence(tId, pId, isAdd, isRemove, btn) {
    const t = appData.teachers.find(x=>x.id===tId);
    if(!t.absences) t.absences = {};
    if(isAdd) {
        if(activeBrush.type === 'CLASS') {
            const val = document.getElementById('brush-class-select').value;
            activeBrush.target = val;
        }
        t.absences[pId] = { type: activeBrush.type, target: activeBrush.target };
        btn.className = `${ABS_BTN_BASE} cursor-default ${absenceFill(activeBrush.type, activeBrush.target)}`;
        btn.innerText = absenceLabel(activeBrush.type, activeBrush.target);
    }
    if(isRemove && t.absences[pId]) {
        delete t.absences[pId];
        btn.className = `${ABS_BTN_BASE} bg-transparent text-transparent hover:bg-surface-100 hover:text-pebble cursor-default`;
        btn.innerText = "+";
    }
}

window.clearAllAbsences = function() {
    openConfirmModal("결시 전체 초기화", "입력된 모든 교사의 결시 데이터를<br>전체 초기화하시겠습니까?", "초기화 실행 (Enter)", () => {
        pushUndo();
        appData.teachers.forEach(t => t.absences = {});
        renderAbsencesTab();
        showToast("모든 결시 데이터가 초기화되었습니다.", "success");
    });
};
