// 버튼과 입력칸 배선: 저장/불러오기, 단축키, 명단·과목·날짜 편집, 규칙 창, 엑셀 내보내기.
// 다른 파일들이 정의한 화면 함수를 쓰므로 가장 마지막에 로드한다.

document.getElementById('btn-global-save').addEventListener('click', () => {
    appData.config.examName = document.getElementById('exam-name').value;
    const d = new Date(); const yy = String(d.getFullYear()).slice(-2); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0');
    const filename = `시험감독배정결과및데이터(${yy}.${mm}.${dd}).json`;
    const pureData = { config: appData.config, teachers: appData.teachers, periods: appData.periods, classSubjects: appData.classSubjects, assignments: appData.assignments, baseAssignments: appData.baseAssignments, validation: appData.validation };
    window.pywebview.api.save_data_dialog(pureData, filename).then(res => { if(res.success) { markDataSaved(); showToast("데이터 전체 저장 완료!", "success"); } else if (!res.canceled) showToast("저장 실패: " + res.error, "error"); });
});

document.getElementById('btn-global-load').addEventListener('click', () => {
    window.pywebview.api.load_data_dialog().then(res => {
        if(res.success && res.data) {
            appData = res.data;
            sanitizeAppData(appData);
            renderConfigTab(); renderSubjectsTab(); renderTeachers(); renderAbsencesTab(); renderResultTab(); renderRulesTab(); renderValidateTab(); markDataSaved();
            showToast("데이터 불러오기 완료!", "success");
        }
        else if (!res.canceled) showToast("불러오기 실패: " + res.error, "error");
    });
});



document.addEventListener('keydown', (e) => {
    if (!document.getElementById('close-modal').classList.contains('hidden')) return;
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
    const ids = new Set(appData.periods.map(p => p.id));
    Object.keys(appData.classSubjects).forEach(id => { if (!ids.has(id)) delete appData.classSubjects[id]; });
    appData.teachers.forEach(t => Object.keys(t.absences || {}).forEach(id => { if (!ids.has(id)) delete t.absences[id]; }));
    [appData.assignments, appData.baseAssignments].filter(Boolean).forEach(assignments => {
        Object.values(assignments).forEach(slots => Object.keys(slots).forEach(id => { if (!ids.has(id)) delete slots[id]; }));
    });
    appData.validation = {};
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
    if(isActive) { row.classList.remove('grade-row-disabled'); cIn.disabled = hwIn.disabled = sepIn.disabled = spIn.disabled = false; if(!appData.config.grades.includes(g)) { appData.config.grades.push(g); appData.config.grades.sort((a, b) => a - b); }  }
    else { row.classList.add('grade-row-disabled'); cIn.disabled = hwIn.disabled = sepIn.disabled = spIn.disabled = true; appData.config.grades = appData.config.grades.filter(x => x !== g); }
    renderRulesTab();
    renderSubjectsTab();
    renderTeachers();
})});
[1, 2, 3].forEach(g => {
    Object.entries({class: 'classes', hw: 'hallways', sep: 'separated', sp: 'special'}).forEach(([prefix, key]) => {
        const input = document.getElementById(`${prefix}-count-${g}`);
        input.type = 'text';
        input.inputMode = 'numeric';
        const valid = value => /^(0|[1-9]\d*)$/.test(value) && Number(value) >= Number(input.min) && Number(value) <= Number(input.max);
        input.addEventListener('beforeinput', e => {
            if (!e.data || e.isComposing) return;
            const next = input.value.slice(0, input.selectionStart) + e.data + input.value.slice(input.selectionEnd);
            if (!valid(next)) e.preventDefault();
        });
        input.addEventListener('input', () => {
            if (!appData.config.grades.includes(g)) return;
            if (input.value === '') { delete appData.config[key][g]; }
            else if (!valid(input.value)) { input.value = appData.config[key][g] ?? ''; return; }
            else appData.config[key][g] = Number(input.value);
            renderRulesTab(); renderTeachers();
        });
    });
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

document.getElementById('btn-add-date').addEventListener('click', () => {
    const d = document.getElementById('new-date').value;
    const value = document.getElementById('daily-periods').value;
    if (!d) return showToast('시험 날짜를 선택해 주세요.', 'error');
    if (!/^[1-7]$/.test(value)) return showToast('교시는 1~7 사이의 정수로 입력해 주세요.', 'error');
    if (!appData.config.examDates.some(x => x.date === d)) {
        appData.config.examDates.push({date: d, periods: Number(value)});
        appData.config.examDates.sort((a,b) => a.date.localeCompare(b.date));
        renderDates(); autoSyncPeriods(); fpDate.clear();
    }
});
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
