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
    pushUndo();
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

    let options = `<option value="">-- 교체할 교사 선택 --</option>`;
    appData.teachers.forEach(t2 => {
        if (t2.id === tId) return;
        const a2 = (appData.assignments[t2.id] || {})[pId] || "공강";

        let absText = "";
        if(t2.absences && t2.absences[pId]) {
            const absType = t2.absences[pId].type;
            absText = absType === 'ALL' ? '[결시]' : (absType === 'GRADE' ? `[${t2.absences[pId].target}학년 결시]` : `[${t2.absences[pId].target} 결시]`);
        }

        options += `<option value="${t2.id}" ${absText ? 'disabled' : ''}>${t2.name} (현재: ${a2}) ${absText}</option>`;
    });
    document.getElementById('rc-swap-target').innerHTML = options;

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

        pushUndo();
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

window.renderResultTab = function() {
    const tContainer = document.getElementById('result-teacher'), cContainer = document.getElementById('result-class'), btnExport = document.getElementById('btn-export-excel');
    if(!appData.assignments || Object.keys(appData.assignments).length === 0) {
        tContainer.innerHTML = cContainer.innerHTML = `<div class="p-12 text-center text-pebble font-bold bg-surface-50 rounded-xl border border-dashed border-surface-300 flex flex-col items-center justify-center gap-3 min-h-[240px]">${icon('zap', 'w-7 h-7 text-pebble')}<span>사이드바의 '자동 배정' 버튼을 눌러주세요.</span></div>`;
        btnExport.classList.add('hidden'); return;
    }
    btnExport.classList.remove('hidden');
    const { periodsByDate, dates } = groupPeriodsByDate();
    const showMain = appData.teachers.some(t => t.isMain), showSub = appData.teachers.some(t => t.isSub), showHall = appData.teachers.some(t => t.isHallway), showSep = appData.teachers.some(t => t.isSeparated), showSp = appData.teachers.some(t => t.isSpecial), showCls = appData.teachers.some(t => t.isClass1 !== false || t.isClass2 !== false || t.isClass3 !== false);
    const countCols = (showMain?1:0) + (showSub?1:0) + (showHall?1:0) + (showSep?1:0) + (showCls?1:0) + (showSp?1:0); 
    
    const parts = build2RowDatePeriodHeaderParts(periodsByDate, dates, 'text-[13px] min-w-[72px] w-[72px]');
    
    const activeSubCols = [];
    if(showMain) activeSubCols.push({ key: 'main', lbl: '정' });
    if(showSub) activeSubCols.push({ key: 'sub', lbl: '부' });
    if(showHall) activeSubCols.push({ key: 'hall', lbl: '복' });
    if(showSep) activeSubCols.push({ key: 'sep', lbl: '분' });
    if(showCls) activeSubCols.push({ key: 'cls', lbl: '수' });
    if(showSp) activeSubCols.push({ key: 'sp', lbl: '특' });

    let countSubThs = '';
    activeSubCols.forEach((item, idx) => {
        const isLast = idx === activeSubCols.length - 1;
        const bClass = isLast ? 'border-r-2 border-slate-300' : 'border-r border-line';
        countSubThs += `<th class="py-2 px-0.5 font-bold text-text-main text-[12.5px] border-b border-line ${bClass} bg-[#F1F5F9]">${item.lbl}</th>`;
    });

    const row1Html = `<tr>
        <th rowspan="2" class="py-2 px-1 whitespace-nowrap align-middle border-b border-r border-line text-text-main bg-[#F1F5F9]">순</th>
        <th rowspan="2" class="py-2 px-1 whitespace-nowrap align-middle border-b border-r border-line text-[14.5px] text-text-main bg-[#F1F5F9]">성명</th>
        <th rowspan="2" class="py-2 px-0.5 whitespace-nowrap text-text-main leading-tight font-bold align-middle border-b border-r border-line bg-[#F1F5F9]">총</th>
        <th colspan="${countCols}" class="py-1.5 px-1 font-bold text-center border-b border-line border-r-2 border-slate-300 text-text-main text-[13.5px] bg-[#F1F5F9]">횟수</th>
        ${parts.row1}
    </tr>`;

    const row2Html = `<tr>
        ${countSubThs}
        ${parts.row2}
    </tr>`;

    let colgroupHtml = `<colgroup>
        <col style="width: 36px;">
        <col style="width: 80px;">
        <col style="width: 26px;">`;
    activeSubCols.forEach(() => {
        colgroupHtml += `<col style="width: 24px;">`;
    });
    appData.periods.forEach(() => {
        colgroupHtml += `<col>`;
    });
    colgroupHtml += `</colgroup>`;

    let tHtml = `<table class="w-full min-w-full table-fixed text-sm text-center whitespace-nowrap border-collapse">${colgroupHtml}<thead class="bg-[#F1F5F9] text-text-main font-bold text-[13px] sticky top-0 z-20 shadow-sm">${row1Html}${row2Html}</thead><tbody>`;
    appData.teachers.forEach((t, idx) => {
        let cnt = {main:0, sub:0, hall:0, sep:0, cls:0, sp:0, total:0};
        appData.periods.forEach(p => { 
            let assigned = appData.assignments[t.id] && appData.assignments[t.id][p.id];
            if(assigned && assigned !== '-') {
                cnt.total++;
                cnt[ROLE_COL[roleKey(assigned)]]++;
            }
        });
        
        tHtml += `<tr data-row="${t.id}" class="hover:bg-surface-50 bg-surface-0">
            <td class="py-2.5 px-1 border border-line bg-surface-50 font-bold text-[13px]">${idx+1}</td>
            <td class="py-2.5 px-1 border border-line font-bold text-[14.5px]">${t.name}</td>
            <td class="py-2.5 px-0.5 border border-line font-semibold text-coral bg-coral/10 text-sm">${cnt.total||''}</td>`;
            
            activeSubCols.forEach((item, cIdx) => {
                const isLast = cIdx === activeSubCols.length - 1;
                const bClass = isLast ? 'border-thick' : 'border-r border-line';
                tHtml += `<td class="py-2.5 px-0.5 border-b ${bClass} font-semibold text-stone bg-surface-50 text-sm">${cnt[item.key]||''}</td>`;
            });
            
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
    tContainer.innerHTML = tHtml + `</tbody></table>`;

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
    const cParts = build2RowDatePeriodHeaderParts(periodsByDate, dates, 'text-[14px]');
    const cRow1Html = `<tr><th rowspan="2" class="p-2 align-middle border-b border-r border-line text-[14px] bg-[#F1F5F9]">학급</th>${cParts.row1}</tr>`;
    const cRow2Html = `<tr>${cParts.row2}</tr>`;

    let cColgroupHtml = `<colgroup><col style="width: 100px;">`;
    appData.periods.forEach(() => {
        cColgroupHtml += `<col>`;
    });
    cColgroupHtml += `</colgroup>`;

    let cHtml = `<table class="w-full min-w-full table-fixed text-sm text-center whitespace-nowrap border-collapse">${cColgroupHtml}<thead class="bg-[#F1F5F9] text-text-main font-bold text-[13.5px] sticky top-0 z-20 shadow-sm">${cRow1Html}${cRow2Html}</thead><tbody>`;
    
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

    Object.keys(cAssign).sort(naturalSortKey).forEach(cnm => {
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
    cContainer.innerHTML = cHtml + `</tbody></table>`;
};

window.runRevalidation = function() {
    if(!appData.assignments || Object.keys(appData.assignments).length === 0) return;
    showToast("최종 배정 결과를 재검증 중입니다...", "success");
    window.pywebview.api.revalidate(appData).then(res => {
        if(res.success) { appData.validation = res.validation; renderValidateTab(); showToast("재검증이 완료되었습니다!", "success"); }
        else showToast("재검증 오류: " + res.error, "error");
    });
};
