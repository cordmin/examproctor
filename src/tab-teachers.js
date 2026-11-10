// 감독 명단 · 배정 제외 화면.
// 배정 제외 표는 드래그로 칠하는 방식이라 마우스 핸들러가 함께 있다.

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
    const subDis = !activeGrades.some(g => {
        const counts = appData.config.invigCounts?.[g] || {};
        return (appData.config.classes[g] || 0) > 0 && (counts.class ?? 2) >= 2;
    });
    const hwDis = totalHallways === 0;
    const sepDis = totalSeparated === 0;
    const spDis = totalSpecial === 0;

    // 기초 설정에서 쓰지 않는 감독 유형은 열째로 숨긴다. 남는 폭은 참고사항 열이 가져간다.
    const hiddenRole = { isSub: subDis, isClass1: c1Dis, isClass2: c2Dis, isClass3: c3Dis, isHallway: hwDis, isSeparated: sepDis, isSpecial: spDis };
    document.querySelectorAll('#tab-teachers [data-role]').forEach(el => el.classList.toggle('hidden', !!hiddenRole[el.dataset.role]));

    if (appData.teachers.length === 0) {
        const columns = 7 + Object.values(hiddenRole).filter(hidden => !hidden).length;
        tbody.innerHTML = emptyTableRows(columns);
        return;
    }

    let rows = "";
    appData.teachers.forEach((t, idx) => {
        rows += `
            <tr class="row-hover">
                <td class="py-2.5 px-1 border border-line bg-surface-100 font-bold text-[11px]">${idx+1}</td>
                <td class="py-2.5 px-1 border border-line"><input type="text" class="w-full text-center bg-transparent focus:outline-none font-bold text-[14.5px] p-0.5" value="${t.name||''}" onchange="updateTeacher('${t.id}', 'name', this.value, false); renderAbsencesTab();"></td>
                <td class="py-2.5 px-1 border border-line"><input type="text" class="w-full text-center bg-transparent focus:outline-none font-bold text-[14.5px] p-0.5" value="${t.subject||''}" onchange="updateTeacher('${t.id}', 'subject', this.value, false)"></td>
                <td class="py-2.5 px-1 border border-line"><input type="text" class="w-full text-center bg-transparent focus:outline-none font-bold text-[14.5px] p-0.5" value="${t.homeroom||''}" onchange="updateTeacher('${t.id}', 'homeroom', this.value, false)"></td>
                <td class="py-2.5 px-1 border border-line"><input type="checkbox" class="chk-custom" ${t.isMain!==false?'checked':''} onchange="updateTeacher('${t.id}', 'isMain', this.checked, false)"></td>
                ${subDis ? '' : `<td class="py-2.5 px-1 border border-line"><input type="checkbox" class="chk-custom" ${t.isSub!==false?'checked':''} onchange="updateTeacher('${t.id}', 'isSub', this.checked, false)"></td>`}
                
                ${c1Dis ? '' : `<td class="py-2.5 px-1 border border-line bg-yellow-50/80"><input type="checkbox" class="chk-custom" ${t.isClass1!==false?'checked':''} onchange="updateTeacher('${t.id}', 'isClass1', this.checked, false)"></td>`}
                ${c2Dis ? '' : `<td class="py-2.5 px-1 border border-line bg-emerald-50/80"><input type="checkbox" class="chk-custom" ${t.isClass2!==false?'checked':''} onchange="updateTeacher('${t.id}', 'isClass2', this.checked, false)"></td>`}
                ${c3Dis ? '' : `<td class="py-2.5 px-1 border border-line bg-blue-50/80"><input type="checkbox" class="chk-custom" ${t.isClass3!==false?'checked':''} onchange="updateTeacher('${t.id}', 'isClass3', this.checked, false)"></td>`}
                
                ${hwDis ? '' : `<td class="py-2.5 px-1 border border-line"><input type="checkbox" class="chk-custom" ${t.isHallway?'checked':''} onchange="updateTeacher('${t.id}', 'isHallway', this.checked, false)"></td>`}
                ${sepDis ? '' : `<td class="py-2.5 px-1 border border-line"><input type="checkbox" class="chk-custom" ${t.isSeparated?'checked':''} onchange="updateTeacher('${t.id}', 'isSeparated', this.checked, false)"></td>`}
                ${spDis ? '' : `<td class="py-2.5 px-1 border border-line"><input type="checkbox" class="chk-custom" ${t.isSpecial?'checked':''} onchange="updateTeacher('${t.id}', 'isSpecial', this.checked, false)"></td>`}
                <td class="py-2.5 px-1 border border-line w-full"><input type="text" id="note-t-${idx}" data-tid="${t.id}" class="w-full bg-transparent focus:outline-none text-stone text-sm p-0.5 text-left px-2" value="${t.notes||''}" onchange="updateTeacher('${t.id}', 'notes', this.value, false)" onkeydown="handleNotesKey(event, ${idx}, 't')" onpaste="handleNotesPaste(event, ${idx}, 't')"></td>
                <td class="py-2.5 px-1 border border-line"><button class="text-coral transition-transform flex items-center justify-center w-full h-full x-btn" onclick="deleteTeacher('${t.id}')"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg></button></td>
            </tr>`;
    });
    tbody.innerHTML = rows;
};
