// 배정 결과 표와 보기 전환.
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

// 교시 머리글에 마우스를 올리면 그 교시의 학년별 시험 과목을 말풍선으로 보여 준다 (ui.js 의 data-tip).
function periodSubjectsText(pid) {
    const subjects = appData.classSubjects[pid] || {};
    return [...appData.config.grades].sort().filter(g => subjects[g])
        .map(g => `${g}학년: ${subjectLabel(subjects[g])}`).join('  /  ');
}

function mountResultTable(container, html, periodsByDate, dates, periodTitle = p => p.name) {
    container.innerHTML = html;
    const table = container.querySelector('table');
    const head = table.tHead;
    // 날짜 구분용 굵은 선은 실제 시험 교시가 있을 때만 사용한다.
    if (!dates.length) head.querySelectorAll('.border-r-2').forEach(cell => {
        cell.classList.remove('border-r-2', 'border-slate-300');
        cell.classList.add('border-r', 'border-line');
    });
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
            const tip = periodSubjectsText(periods[index].id);
            if (tip) cell.dataset.tip = tip;
        });
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
    const grades = (appData.config.grades.length ? [...appData.config.grades] : [1,2,3]).sort((a, b) => a - b);
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
    btnExport.classList.toggle('hidden', !hasAssignmentResults());
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
        .filter(item => !hasAssignmentResults() || counts.some(cnt => cnt[item.key]));
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
    Array.from({length: Math.max(1, appData.periods.length)}).forEach(() => {
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
                const swapAttrs = `draggable="false" data-swap-teacher="${t.id}" data-swap-period="${p.id}" onpointerdown="handleAssignPointerDown(event, '${t.id}', '${p.id}')" ondragstart="handleAssignDragStart(event, '${t.id}', '${p.id}')" ondragover="handleAssignDragOver(event, '${t.id}', '${p.id}')" ondrop="handleAssignDrop(event, '${t.id}', '${p.id}')" oncontextmenu="handleRightClickSwap(event, '${t.id}', '${p.id}')"`;
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
        if (!dates.length) tHtml += '<td class="border border-line"></td>';
        tHtml += `</tr>`;
    });
    if (!appData.teachers.length) tHtml += emptyTableRows(2 + countCols + Math.max(1, appData.periods.length));
    mountResultTable(tContainer, tHtml + `</tbody></table>`, periodsByDate, dates);

    const cAssign = {}; 
    Object.keys(appData.assignments).forEach(tid => {
        const tobj = appData.teachers.find(tx => tx.id === tid);
        const pdict = appData.assignments[tid];
        Object.keys(pdict).forEach(pid => {
            const lbl = pdict[pid]; if(!lbl || !tobj || !appData.periods.some(p => p.id === pid)) return;
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
    const cColgroupHtml = `<colgroup><col style="width: 100px;">${'<col>'.repeat(Math.max(1, appData.periods.length))}</colgroup>`;
    grades.forEach(g => {
        const subjectOf = p => (appData.classSubjects[p.id] || {})[g] || '';
        const cParts = build2RowDatePeriodHeaderParts(periodsByDate, dates, 'text-[14px]');
        let cHtml = `<table class="w-full min-w-full table-fixed text-sm text-center whitespace-nowrap border-collapse">${cColgroupHtml}<thead class="bg-[#F1F5F9] text-text-main font-bold text-[13.5px] sticky top-0 z-20 shadow-sm"><tr><th rowspan="2" class="p-2 align-middle border-b border-r border-line text-[14px] bg-[#F1F5F9]">학급</th>${cParts.row1}</tr><tr>${cParts.row2}</tr></thead><tbody>`;
        const areas = Object.keys(cAssign).filter(cnm => g === 'all' || gradeOf(cnm) === String(g));
        if (!areas.length) cHtml += emptyTableRows(1 + Math.max(1, appData.periods.length));
        Object.keys(cAssign).filter(cnm => g === 'all' || gradeOf(cnm) === String(g)).sort(naturalSortKey).forEach(cnm => {
            cHtml += `<tr class="bg-surface-0"><td class="p-2 border border-line font-bold bg-surface-50 text-[14px]">${cnm}</td>`;
            dates.forEach((d, dIdx) => {
                periodsByDate[d].forEach((p, pIdx) => {
                    const borders = cellBorders(periodsByDate, dates, dIdx, pIdx);
                    const assigned = sortAssignedList([...(cAssign[cnm][p.id] || [])]);
                    if(assigned.length > 0) {
                        // 인원 수와 무관하게 교사별 표와 같은 글자 크기를 쓴다.
                        const nameAttrs = (x) => `draggable="false" data-swap-teacher="${x.tid}" data-swap-period="${p.id}" onpointerdown="handleAssignPointerDown(event, '${x.tid}', '${p.id}')" ondragstart="handleAssignDragStart(event, '${x.tid}', '${p.id}')" ondragover="handleAssignDragOver(event, '${x.tid}', '${p.id}')" ondrop="handleAssignDrop(event, '${x.tid}', '${p.id}')" oncontextmenu="handleRightClickSwap(event, '${x.tid}', '${p.id}')"`;
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
    if (!hasAssignmentResults()) { appData.validation = {}; renderValidateTab(); return; }
    showToast("최종 배정 결과를 재검증 중입니다...", "success");
    window.pywebview.api.revalidate(appData).then(res => {
        if(res.success) { appData.validation = res.validation; renderValidateTab(); showToast("재검증이 완료되었습니다!", "success"); }
        else showToast("재검증 오류: " + res.error, "error");
    });
};
