// 배정 결과 화면과 수동 교체.
// 교체 가능 여부 판정은 main.py 의 check_label 에 위임한다(브리지 호출).

window.handleAssignDragStart = function(e, tId, pId) { e.dataTransfer.setData("text/plain", JSON.stringify({tId, pId})); };
window.handleAssignDragOver = function(e) { e.preventDefault(); };
window.handleAssignDrop = function(e, targetTId, targetPId) {
    e.preventDefault();
    try {
        const data = JSON.parse(e.dataTransfer.getData("text/plain"));
        const sourceTId = data.tId; const sourcePId = data.pId;
        if(sourcePId !== targetPId) { showToast("동일한 교시 내에서만 감독을 교체할 수 있습니다.", "error"); return; }
        if(sourceTId === targetTId) return;
        
        const t1 = appData.teachers.find(t=>t.id === sourceTId);
        const t2 = appData.teachers.find(t=>t.id === targetTId);
        const a1 = (appData.assignments[t1.id] || {})[targetPId];
        const a2 = (appData.assignments[t2.id] || {})[targetPId];
        if(!a1 && !a2) { showToast("양쪽 모두 배정이 없어 교체할 감독이 없습니다.", "error"); return; }

        checkSwapPair(t1, t2, targetPId, a2, a1).then(res => {
            if(reportSwapBlocked(t1, t2, res)) return;

            pendingSwapData = { t1, t2, targetPId, a1, a2 };
            const msgEl = document.getElementById('swap-modal-msg');
            const name1 = `<span class="text-brand-600 font-bold text-[15px]">${t1.name}</span>`, name2 = `<span class="text-brand-600 font-bold text-[15px]">${t2.name}</span>`;
            const styleLabel = (l) => `<span class="inline-block bg-surface-100 px-2 py-0.5 rounded border border-surface-300 text-slate-800 font-bold mx-0.5">'${l}'</span>`;
            msgEl.innerHTML = (a1 && !a2) 
                ? `<div>${name1} 교사의 ${styleLabel(a1)} 감독을</div><div class="mt-3">${name2} 교사의 <span class="text-pebble font-bold">(공강 시간)</span>으로 넘기시겠습니까?</div>` 
                : (!a1 && a2) 
                ? `<div>${name2} 교사의 ${styleLabel(a2)} 감독을</div><div class="mt-3">${name1} 교사의 <span class="text-pebble font-bold">(공강 시간)</span>으로 넘기시겠습니까?</div>` 
                : `<div>${name1} 교사의 ${styleLabel(a1)} 감독과</div><div class="mt-3">${name2} 교사의 ${styleLabel(a2)} 감독을 교체하시겠습니까?</div>`;
            const m = document.getElementById('swap-modal'); m.classList.remove('hidden'); m.focus();
        }).catch(err => { console.error(err); showToast("교체 가능 여부 확인 실패: " + err, "error"); });
    } catch(err) { console.error(err); }
};

window.closeSwapModal = function() { pendingSwapData = null; document.getElementById('swap-modal').classList.add('hidden'); };
window.executePendingSwap = function() {
    if(!pendingSwapData) return;
    const { t1, t2, targetPId, a1, a2 } = pendingSwapData;
    if(!appData.assignments[t1.id]) appData.assignments[t1.id] = {};
    if(!appData.assignments[t2.id]) appData.assignments[t2.id] = {};
    if(a2) appData.assignments[t1.id][targetPId] = a2; else delete appData.assignments[t1.id][targetPId];
    if(a1) appData.assignments[t2.id][targetPId] = a1; else delete appData.assignments[t2.id][targetPId];
    closeSwapModal(); showToast("감독이 교체되었습니다! 재검증 탭에서 결과를 확인하세요.", "success");
    renderResultTab(); runRevalidation();
};

window.handleRightClickSwap = function(e, tId, pId) {
    e.preventDefault(); 
    const t1 = appData.teachers.find(t => t.id === tId);
    const p = appData.periods.find(px => px.id === pId);
    const a1 = (appData.assignments[tId] || {})[pId] || "-";

    rcSwapData = { tId, pId };

    const infoStr = `<div class="text-[15px] font-bold text-text-main leading-relaxed">${formatBeautifulDate(p.date)} ${p.name} <span class="text-brand-600 font-bold">${t1.name}</span> 교사의 <span class="inline-block bg-surface-100 px-2 py-0.5 rounded border border-surface-300 font-bold text-[14px] text-slate-800 mx-0.5">'${a1}'</span>을 교체합니다.</div>`;
    document.getElementById('rc-swap-info').innerHTML = infoStr;

    // 공강 → 배정 중 → 결시 순으로 묶어 3칸 바둑판 메뉴로 보여 준다 (ui.js 의 grid-select).
    const groups = { free: [], busy: [], absent: [] };
    appData.teachers.forEach(t2 => {
        if (t2.id === tId) return;
        const a2 = (appData.assignments[t2.id] || {})[pId];
        const abs = t2.absences && t2.absences[pId];
        if (abs) {
            const sub = abs.type === 'ALL' ? '' : (abs.type === 'GRADE' ? `${abs.target}학년 결시` : `${abs.target} 결시`);
            groups.absent.push(`<option value="${t2.id}" data-sub="${sub}" disabled>${t2.name}</option>`);
        } else if (a2) groups.busy.push(`<option value="${t2.id}" data-sub="${a2}">${t2.name}</option>`);
        else groups.free.push(`<option value="${t2.id}">${t2.name}</option>`);
    });
    const group = (label, items) => items.length ? `<optgroup label="${label}" data-count="${items.length}명">${items.join('')}</optgroup>` : '';
    document.getElementById('rc-swap-target').innerHTML = `<option value="">-- 교체할 교사 선택 --</option>`
        + group('공강', groups.free) + group('배정 중', groups.busy) + group('결시 · 선택 불가', groups.absent);
    refreshDropdowns();

    const m = document.getElementById('rightclick-swap-modal');
    m.classList.remove('hidden');
    m.focus();
};

window.closeRcSwapModal = function() {
    rcSwapData = null;
    const m = document.getElementById('rightclick-swap-modal');
    if(m) m.classList.add('hidden');
};

window.executeRcSwap = function() {
    if(!rcSwapData) return;
    const targetTId = document.getElementById('rc-swap-target').value;
    if(!targetTId) {
        showToast("교체할 대상을 선택하세요.", "error");
        return;
    }

    const sourceTId = rcSwapData.tId;
    const targetPId = rcSwapData.pId;

    const t1 = appData.teachers.find(t=>t.id === sourceTId);
    const t2 = appData.teachers.find(t=>t.id === targetTId);
    const a1 = (appData.assignments[t1.id] || {})[targetPId];
    const a2 = (appData.assignments[t2.id] || {})[targetPId];
    if(!a1 && !a2) { showToast("양쪽 모두 배정이 없어 교체할 감독이 없습니다.", "error"); return; }

    checkSwapPair(t1, t2, targetPId, a2, a1).then(res => {
        if(reportSwapBlocked(t1, t2, res)) return;

        if(!appData.assignments[t1.id]) appData.assignments[t1.id] = {};
        if(!appData.assignments[t2.id]) appData.assignments[t2.id] = {};
        if(a2) appData.assignments[t1.id][targetPId] = a2; else delete appData.assignments[t1.id][targetPId];
        if(a1) appData.assignments[t2.id][targetPId] = a1; else delete appData.assignments[t2.id][targetPId];

        closeRcSwapModal();
        showToast("감독이 교체되었습니다! 재검증 탭에서 결과를 확인하세요.", "success");
        renderResultTab();
        runRevalidation();
    }).catch(err => { console.error(err); showToast("교체 가능 여부 확인 실패: " + err, "error"); });
};

// 규칙 판정은 main.py 의 check_label() 하나만 쓴다. 검증 탭의 사후 검사와 같은 함수라
// 판정이 어긋날 수 없다.
// 두 교사를 한 번에 검사하고 [t1결과, t2결과] 를 돌려준다.
function checkSwapPair(t1, t2, pId, labelForT1, labelForT2) {
    return Promise.all([
        window.pywebview.api.check_manual_assignment(appData, t1.id, pId, labelForT1),
        window.pywebview.api.check_manual_assignment(appData, t2.id, pId, labelForT2)
    ]);
}

// 불가 사유가 있으면 토스트를 띄우고 false 를 돌려준다.
function reportSwapBlocked(t1, t2, [v1, v2]) {
    if(!v1.valid) { showToast(`[${t1.name} 교사 불가 사유]\n${v1.reason}`, "error"); return true; }
    if(!v2.valid) { showToast(`[${t2.name} 교사 불가 사유]\n${v2.reason}`, "error"); return true; }
    return false;
}

// 머리글은 세로 스크롤 밖에 두고, 본문과 같은 열 너비/가로 스크롤을 쓴다.
function syncResultHeader(scroll) {
    const header = scroll.previousElementSibling;
    if (!header?.classList.contains('result-table-header')) return;
    syncSplitTableHeader(scroll, header, header.firstElementChild);
}
const resultHeaderObserver = new ResizeObserver(entries => entries.forEach(entry => syncResultHeader(entry.target)));
function syncResultHeaders() {
    document.querySelectorAll('.result-table-scroll').forEach(syncResultHeader);
}

// 교시 머리글에 마우스를 올리면 그 교시의 학년별 시험 과목을 말풍선으로 보여 준다.
// 머리글 상자가 넘치는 부분을 숨기므로 칸 안이 아니라 body 에 띄운다.
const periodSubjectTip = document.createElement('div');
periodSubjectTip.className = 'fixed z-[9999] pointer-events-none hidden flex-col items-center';
periodSubjectTip.innerHTML = `<div class="w-0 h-0 border-x-4 border-x-transparent border-b-4 border-b-[#1E293B]"></div>
    <div class="bg-[#1E293B] text-white text-[11.5px] font-bold px-3 py-1.5 rounded-md shadow-2xl border border-white/20 whitespace-nowrap"></div>`;
document.body.append(periodSubjectTip);

function showPeriodSubjects(event) {
    const cell = event.target.closest('[data-pid]');
    const subjects = cell && (appData.classSubjects[cell.dataset.pid] || {});
    const text = cell && [...appData.config.grades].sort().filter(g => subjects[g])
        .map(g => `${g}학년: ${subjectLabel(subjects[g])}`).join('  /  ');
    if (!text) return hidePeriodSubjects();
    periodSubjectTip.lastElementChild.textContent = text;
    periodSubjectTip.classList.replace('hidden', 'flex');
    const zoom = parseFloat(document.documentElement.style.zoom) || 1;
    const r = cell.getBoundingClientRect();
    periodSubjectTip.style.left = `${(r.left + r.width / 2) / zoom - periodSubjectTip.offsetWidth / 2}px`;
    periodSubjectTip.style.top = `${r.bottom / zoom + 2}px`;
}
function hidePeriodSubjects() { periodSubjectTip.classList.replace('flex', 'hidden'); }

function mountResultTable(container, html, periodsByDate, dates, periodTitle = p => p.name) {
    container.innerHTML = html;
    const table = container.querySelector('table');
    const head = table.tHead;
    const periods = dates.flatMap(date => periodsByDate[date]);
    const fixedWidth = [...table.querySelector('colgroup').children].reduce((sum, col) => sum + (parseFloat(col.style.width) || 0), 0);
    table.style.minWidth = `${fixedWidth + periods.length * 56}px`;
    const headerTable = table.cloneNode(false);
    headerTable.append(table.querySelector('colgroup').cloneNode(true), head);
    head.className = 'text-text-main font-bold text-[13px]';
    head.querySelectorAll('.border-r-2').forEach(cell => cell.classList.add('border-thick'));
    if (periods.length) {
        const periodHeaders = [...head.rows[1].cells].slice(-periods.length);
        periodHeaders.forEach((cell, index) => {
            cell.classList.add('result-period-title');
            cell.textContent = periodTitle(periods[index]);
            cell.dataset.pid = periods[index].id;
        });
        headerTable.addEventListener('mouseover', showPeriodSubjects);
        headerTable.addEventListener('mouseleave', hidePeriodSubjects);
        const dateHeaders = [...head.rows[0].cells].slice(-dates.length);
        dateHeaders[0].classList.add('border-edge');
        periodHeaders[0].classList.add('border-edge');
        let column = 0;
        dates.forEach((date, index) => {
            column += periodsByDate[date].length;
            dateHeaders[index].classList.add('border-thick');
            periodHeaders[column - 1].classList.add('border-thick');
        });
    }
    const header = document.createElement('div');
    header.className = 'result-table-header flex-shrink-0';
    const viewport = document.createElement('div');
    viewport.className = 'result-header-viewport';
    viewport.append(headerTable);
    header.append(viewport);
    const scroll = document.createElement('div');
    scroll.className = 'result-table-scroll flex-1 min-h-0 overflow-auto pb-4';
    scroll.append(table);
    container.replaceChildren(header, scroll);
    scroll.addEventListener('scroll', () => syncResultHeader(scroll));
    resultHeaderObserver.observe(scroll);
    requestAnimationFrame(() => syncResultHeader(scroll));
}

// ── 배정 결과 보기 전환: 교사별 + 시험 보는 학년마다 하나 ────────────
const RESULT_BTN_ON  = 'result-sub-btn bg-brand-600 text-brand-text shadow-sm px-3 py-1 rounded-md font-bold text-[12.5px] transition-all cursor-pointer';
const RESULT_BTN_OFF = 'result-sub-btn bg-transparent text-stone hover:text-text-main px-3 py-1 rounded-md font-bold text-[12.5px] transition-all cursor-pointer';

// 학년이 둘 이상이면 맨 오른쪽에 전체 학년을 한 표로 보는 '전체'(키 'all')를 둔다.
function buildResultViews() {
    const grades = [...appData.config.grades].sort((a, b) => a - b);
    if (grades.length > 1) grades.push('all');
    const views = [['result-teacher', '교사별'], ...grades.map(g => [`result-grade-${g}`, g === 'all' ? '전체' : `${g}학년`])];
    if (!views.some(([id]) => id === currentResultView)) currentResultView = 'result-teacher';
    document.getElementById('result-view-btns').innerHTML = views.map(([id, lbl]) =>
        `<button class="${id === currentResultView ? RESULT_BTN_ON : RESULT_BTN_OFF}" data-target="${id}">${lbl}</button>`).join('');
    const box = document.getElementById('result-views');
    box.querySelectorAll('[id^="result-grade-"]').forEach(el => el.remove());
    grades.forEach(g => box.insertAdjacentHTML('beforeend', `<div id="result-grade-${g}" class="result-view w-full h-full min-h-0 flex flex-col"></div>`));
    box.querySelectorAll('.result-view').forEach(view => view.classList.toggle('hidden', view.id !== currentResultView));
    return grades;
}

window.renderResultTab = function() {
    resultHeaderObserver.disconnect();
    const grades = buildResultViews();
    const tContainer = document.getElementById('result-teacher'), btnExport = document.getElementById('btn-export-excel');
    if(!appData.assignments || Object.keys(appData.assignments).length === 0) {
        document.querySelectorAll('#result-views .result-view').forEach(view => view.innerHTML = `<div class="p-12 text-center text-pebble font-bold bg-surface-50 rounded-xl border border-dashed border-surface-300 flex flex-col items-center justify-center gap-3 min-h-[240px]">${icon('play', 'w-7 h-7 text-pebble')}<span>사이드바의 '배정 실행' 버튼을 눌러주세요.</span></div>`);
        btnExport.classList.add('hidden'); return;
    }
    btnExport.classList.remove('hidden');
    const { periodsByDate, dates } = groupPeriodsByDate();
    // 교사별 횟수 칸: 정·부·복·분·특·수 순서, 모든 교사가 0회인 칸은 뺀다 (excel.py 의 RESULT_ROLES 와 같다).
    const counts = appData.teachers.map(t => {
        const cnt = {main:0, sub:0, hall:0, sep:0, cls:0, sp:0, total:0};
        appData.periods.forEach(p => {
            const assigned = appData.assignments[t.id] && appData.assignments[t.id][p.id];
            if(assigned && assigned !== '-') { cnt.total++; cnt[ROLE_COL[roleKey(assigned)]]++; }
        });
        return cnt;
    });
    const activeSubCols = [{ key: 'main', lbl: '정' }, { key: 'sub', lbl: '부' }, { key: 'hall', lbl: '복' },
                           { key: 'sep', lbl: '분' }, { key: 'sp', lbl: '특' }, { key: 'cls', lbl: '수' }]
        .filter(item => counts.some(cnt => cnt[item.key]));
    const countCols = activeSubCols.length + 1; // +1: 합

    const parts = build2RowDatePeriodHeaderParts(periodsByDate, dates, 'text-[13px] min-w-[72px] w-[72px]');

    let countSubThs = '';
    activeSubCols.forEach(item => {
        countSubThs += `<th class="py-2 px-0.5 font-bold text-text-main text-[12.5px] border-b border-line border-r bg-[#F1F5F9]">${item.lbl}</th>`;
    });
    countSubThs += `<th class="py-2 px-0.5 font-bold text-text-main text-[12.5px] border-b border-line border-r-2 border-slate-300 bg-[#F1F5F9]">합</th>`;

    const row1Html = `<tr>
        <th rowspan="2" class="py-2 px-1 whitespace-nowrap align-middle border-b border-r border-line text-text-main bg-[#F1F5F9]">순</th>
        <th rowspan="2" class="py-2 px-1 whitespace-nowrap align-middle border-b border-r border-line text-[14.5px] text-text-main bg-[#F1F5F9]">성명</th>
        <th colspan="${countCols}" class="py-1.5 px-1 font-bold text-center border-b border-line border-r-2 border-slate-300 text-text-main text-[13.5px] bg-[#F1F5F9]">배정 횟수</th>
        ${parts.row1}
    </tr>`;

    const row2Html = `<tr>
        ${countSubThs}
        ${parts.row2}
    </tr>`;

    let colgroupHtml = `<colgroup>
        <col style="width: 36px;">
        <col style="width: 80px;">`;
    activeSubCols.forEach(() => {
        colgroupHtml += `<col style="width: 24px;">`;
    });
    colgroupHtml += `<col style="width: 26px;">`;
    appData.periods.forEach(() => {
        colgroupHtml += `<col>`;
    });
    colgroupHtml += `</colgroup>`;

    let tHtml = `<table class="w-full min-w-full table-fixed text-sm text-center whitespace-nowrap border-collapse">${colgroupHtml}<thead class="bg-[#F1F5F9] text-text-main font-bold text-[13px] sticky top-0 z-20 shadow-sm">${row1Html}${row2Html}</thead><tbody>`;
    appData.teachers.forEach((t, idx) => {
        const cnt = counts[idx];
        tHtml += `<tr data-row="${t.id}" class="hover:bg-surface-50 bg-surface-0">
            <td class="py-2.5 px-1 border border-line bg-surface-50 font-bold text-[13px]">${idx+1}</td>
            <td class="py-2.5 px-1 border border-line font-bold text-[14.5px]">${t.name}</td>`;
            
            activeSubCols.forEach(item => {
                tHtml += `<td class="py-2.5 px-0.5 border-b border-r border-line font-semibold text-stone bg-surface-50 text-sm">${cnt[item.key]||''}</td>`;
            });
            tHtml += `<td class="py-2.5 px-0.5 border-b border-thick font-semibold text-coral bg-coral/10 text-sm">${cnt.total||''}</td>`;
            
        dates.forEach((d, dIdx) => {
            periodsByDate[d].forEach((p, pIdx) => {
                const borders = cellBorders(periodsByDate, dates, dIdx, pIdx);
                const assigned = appData.assignments[t.id] && appData.assignments[t.id][p.id];
                const swapAttrs = `draggable="true" ondragstart="handleAssignDragStart(event, '${t.id}', '${p.id}')" ondragover="handleAssignDragOver(event)" ondrop="handleAssignDrop(event, '${t.id}', '${p.id}')" oncontextmenu="handleRightClickSwap(event, '${t.id}', '${p.id}')"`;
                const cellStyle = assigned ? "bg-slate-100 text-slate-800 font-bold" : "text-pebble";
                const base = appData.baseAssignments;
                const changed = base && (assigned || '') !== ((base[t.id] || {})[p.id] || '') ? 'cell-changed' : '';

                let txtSize = "text-[14px]";
                if(assigned) {
                    if(assigned.length >= 10) txtSize = "text-[11.5px]";
                    else if(assigned.length >= 8) txtSize = "text-[12.5px]";
                    else if(assigned.length >= 6) txtSize = "text-[13.5px]";
                }

                tHtml += `<td ${swapAttrs} data-cell="${t.id}|${p.id}" class="py-2.5 px-1 border border-line ${txtSize} ${cellStyle} ${borders} ${changed} hover-swap overflow-hidden truncate">${assigned || '-'}</td>`;
            });
        });
        tHtml += `</tr>`;
    });
    mountResultTable(tContainer, tHtml + `</tbody></table>`, periodsByDate, dates);

    const cAssign = {}; 
    Object.keys(appData.assignments).forEach(tid => {
        const tobj = appData.teachers.find(tx => tx.id === tid);
        const pdict = appData.assignments[tid];
        Object.keys(pdict).forEach(pid => {
            const lbl = pdict[pid]; if(!lbl) return;
            const { area: cnm, role: rstr } = parseLabel(lbl);
            if(!cAssign[cnm]) cAssign[cnm] = {};
            if(!cAssign[cnm][pid]) cAssign[cnm][pid] = [];
            cAssign[cnm][pid].push({ tid, txt: rstr ? `${tobj.name}(${rstr})` : tobj.name });
        });
    });
    function sortAssignedList(list) {
        return list.sort((a, b) => {
            function getPriority(str) {
                if (str.includes('(정)')) return 1;
                if (str.includes('(부)')) return 2;
                if (str.includes('(수업)') || str.includes('(수)')) return 3;
                const m = str.match(/\((\d+)\)/);
                if (m) return 10 + parseInt(m[1]);
                return 99;
            }
            const priA = getPriority(a.txt);
            const priB = getPriority(b.txt);
            if (priA !== priB) return priA - priB;
            return a.txt.localeCompare(b.txt, 'ko');
        });
    }

    // 학년별 보기: 그 학년 반·특수·분리·복도 자리만, 교시 머리글에 그 학년 과목을 괄호로 붙인다.
    // '전체'는 모든 학년 자리를 보이고, 학년마다 과목이 달라 머리글에는 교시만 쓴다.
    const cColgroupHtml = `<colgroup><col style="width: 100px;">${'<col>'.repeat(appData.periods.length)}</colgroup>`;
    grades.forEach(g => {
        const subjectOf = p => (appData.classSubjects[p.id] || {})[g] || '';
        const cParts = build2RowDatePeriodHeaderParts(periodsByDate, dates, 'text-[14px]');
        let cHtml = `<table class="w-full min-w-full table-fixed text-sm text-center whitespace-nowrap border-collapse">${cColgroupHtml}<thead class="bg-[#F1F5F9] text-text-main font-bold text-[13.5px] sticky top-0 z-20 shadow-sm"><tr><th rowspan="2" class="p-2 align-middle border-b border-r border-line text-[14px] bg-[#F1F5F9]">학급</th>${cParts.row1}</tr><tr>${cParts.row2}</tr></thead><tbody>`;
        Object.keys(cAssign).filter(cnm => g === 'all' || gradeOf(cnm) === String(g)).sort(naturalSortKey).forEach(cnm => {
            cHtml += `<tr class="bg-surface-0"><td class="p-2 border border-line font-bold bg-surface-50 text-[14px]">${cnm}</td>`;
            dates.forEach((d, dIdx) => {
                periodsByDate[d].forEach((p, pIdx) => {
                    const borders = cellBorders(periodsByDate, dates, dIdx, pIdx);
                    const assigned = sortAssignedList([...(cAssign[cnm][p.id] || [])]);
                    if(assigned.length > 0) {
                        // 인원 수와 무관하게 교사별 표와 같은 글자 크기를 쓴다.
                        const nameAttrs = (x) => `draggable="true" ondragstart="handleAssignDragStart(event, '${x.tid}', '${p.id}')" ondragover="handleAssignDragOver(event)" ondrop="handleAssignDrop(event, '${x.tid}', '${p.id}')" oncontextmenu="handleRightClickSwap(event, '${x.tid}', '${p.id}')"`;
                        // 한 명뿐이면 칩을 셀에 꽉 채워 셀 전체가 그레이로 보이게 한다.
                        const solo = assigned.length === 1;
                        const tdPad = solo ? 'p-0' : 'py-1.5 px-1';
                        const chipCls = solo ? 'py-2.5 px-1' : 'rounded px-1 py-0.5';
                        cHtml += `<td class="${tdPad} border border-line bg-surface-0 text-slate-800 font-bold ${borders} text-[13.5px] leading-tight min-w-[80px] w-[80px] overflow-hidden swap-cell"><div class="flex flex-col gap-1">` + assigned.map(x=>`<span class="truncate swap-name block bg-slate-100 ${chipCls}" ${nameAttrs(x)}>${x.txt}</span>`).join('') + `</div></td>`;
                    } else {
                        cHtml += `<td class="p-2 border border-line text-pebble ${borders} min-w-[80px] w-[80px]">-</td>`;
                    }
                });
            });
            cHtml += `</tr>`;
        });
        mountResultTable(document.getElementById(`result-grade-${g}`), cHtml + `</tbody></table>`, periodsByDate, dates,
            p => g !== 'all' && subjectOf(p) ? `${p.name}(${subjectLabel(subjectOf(p))})` : p.name);
    });
};

window.runRevalidation = function() {
    if(!appData.assignments || Object.keys(appData.assignments).length === 0) return;
    showToast("최종 배정 결과를 재검증 중입니다...", "success");
    window.pywebview.api.revalidate(appData).then(res => {
        if(res.success) { appData.validation = res.validation; renderValidateTab(); showToast("재검증이 완료되었습니다!", "success"); }
        else showToast("재검증 오류: " + res.error, "error");
    });
};
