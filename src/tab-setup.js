// 기본 설정 · 시험 교과 · 배정 규칙 화면.

window.renderConfigTab = function() {
    document.getElementById('exam-name').value = appData.config.examName || "";
    [1, 2, 3].forEach(grade => {
        const toggle = document.getElementById(`grade-${grade}`);
        const row = document.getElementById(`grade-row-${grade}`);
        const cIn = document.getElementById(`class-count-${grade}`), spIn = document.getElementById(`sp-count-${grade}`), sepIn = document.getElementById(`sep-count-${grade}`), hwIn = document.getElementById(`hw-count-${grade}`);
        if (appData.config.grades.includes(grade)) {
            toggle.classList.add('active'); row.classList.remove('grade-row-disabled');
            cIn.disabled = spIn.disabled = sepIn.disabled = hwIn.disabled = false;
            cIn.value = appData.config.classes[grade] ?? ''; spIn.value = appData.config.special[grade] ?? ''; sepIn.value = appData.config.separated[grade] ?? ''; hwIn.value = appData.config.hallways[grade] ?? '';
        } else { cIn.value = appData.config.classes[grade] ?? ''; spIn.value = appData.config.special[grade] ?? ''; sepIn.value = appData.config.separated[grade] ?? ''; hwIn.value = appData.config.hallways[grade] ?? ''; toggle.classList.remove('active'); row.classList.add('grade-row-disabled'); cIn.disabled = spIn.disabled = sepIn.disabled = hwIn.disabled = true; }
    });
    renderSubjects(); renderDates();
    if (window.renderSubjectsTab) renderSubjectsTab();
    if (window.renderRulesTab) renderRulesTab();
};

// 저장 값은 '자습', 화면 이름만 '수업'
window.subjectLabel = subject => subject === '자습' ? '수업' : subject;

window.renderSubjects = function() {
    const container = document.getElementById('subject-list'); container.innerHTML = ""; 
    ['자습', ...appData.config.subjects.filter(subject => subject !== '자습')].forEach(subject => {
        const b = document.createElement('div'); b.className = "flex items-center gap-1 px-3 py-1 bg-surface-0 border border-line rounded-full text-[12px] font-bold shadow-sm";
        if (subject === '자습') {
            b.classList.replace('bg-surface-0', 'bg-surface-200');
            b.style.paddingLeft = b.style.paddingRight = 'calc(1rem + 7.25px)';
            b.classList.add('justify-center');
            b.textContent = subjectLabel(subject);
            container.appendChild(b);
            return;
        }
        b.innerHTML = `<span>${subject}</span><button class="text-coral ml-1 flex items-center x-btn" onclick="removeSubject('${subject}')"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg></button>`; container.appendChild(b);
    });
};

window.renderDates = function() {
    const container = document.getElementById('date-list'); container.innerHTML = "";
    appData.config.examDates.forEach(dateObj => {
        const b = document.createElement('div'); b.className = "flex items-center gap-1 px-3 py-1 bg-surface-0 border border-line rounded-full text-[12px] font-bold shadow-sm";
        b.innerHTML = `<span>${formatBeautifulDate(dateObj.date)} (${dateObj.periods}교시)</span><button class="text-coral ml-1 flex items-center x-btn" onclick="removeDate('${dateObj.date}')"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg></button>`; container.appendChild(b);
    });
};

window.renderSubjectsTab = function() {
    closeAppSelect();
    const container = document.getElementById('subject-tables-container'); container.innerHTML = "";
    if (appData.periods.length === 0) {
        container.innerHTML = `<div style="display:grid !important;grid-template-columns:repeat(3,minmax(0,1fr)) !important;gap:24px !important;min-height:100% !important;width:100% !important">${[1,2,3].map(g => `
            <div class="flex flex-col"><div class="bg-[#1E293B] text-white px-3.5 py-1.5 rounded-t-lg font-bold text-[12.5px] self-start">${g}학년</div>
            <div class="bg-surface-0 border border-line rounded-b-xl rounded-tr-xl overflow-hidden flex-1"><table class="w-full table-fixed text-center text-[12.5px]"><thead class="bg-surface-100"><tr><th class="py-2.5 w-14 border-r border-line">교시</th><th>시험일</th></tr></thead><tbody>${emptyTableRows(2, 3)}</tbody></table></div></div>`).join('')}</div>`;
        return;
    }

    const { periodsByDate, dates } = groupPeriodsByDate();
    const maxPeriods = Math.max(...dates.map(d => periodsByDate[d].length));

    let html = '<div style="display: grid !important; grid-template-columns: repeat(3, minmax(0, 1fr)) !important; row-gap: 20px !important; column-gap: 24px !important; width: 100% !important; min-height: 100% !important; align-items: stretch !important;">';
    [1, 2, 3].forEach(grade => {
        const isSelected = appData.config.grades.includes(grade);

        html += `<div class="flex flex-col h-full"><div class="inline-flex items-center bg-[#1E293B] text-white px-3.5 py-1.5 rounded-t-lg font-bold text-[12.5px] self-start z-10 mb-[calc(var(--hair)*-1)]"><span>${grade}학년</span></div><div class="bg-surface-0 border border-line rounded-b-xl rounded-tr-xl overflow-hidden shadow-sm flex flex-col flex-1 min-h-[140px]">`;

        if (!isSelected) {
            html += `<div class="flex-1 flex items-center justify-center p-8 bg-surface-50 text-pebble font-bold text-[13px]">시험 없음</div></div></div>`;
        } else {
            html += `<div class="overflow-hidden flex-1"><table class="w-full h-full text-[12.5px] text-center table-fixed"><thead class="bg-surface-100 text-text-main font-bold text-[12px]"><tr><th class="py-2.5 px-1.5 w-14">교시</th>`;
            dates.forEach((date, dIdx) => html += `<th class="py-2.5 px-1.5 text-text-main">${formatBeautifulDate(date)}</th>`);
            html += `</tr></thead><tbody class="bg-surface-0">`;

            for(let i=0; i<maxPeriods; i++) {
                const isLastRow = (i === maxPeriods - 1);
                const borderTdClass = isLastRow ? 'py-2 px-1 align-middle bg-surface-0 border-t border-r border-line' : 'py-2 px-1 align-middle bg-surface-0 border border-line';
                const borderHeadTdClass = isLastRow ? 'py-2.5 px-1 font-bold bg-surface-50 text-[12px] border-t border-r border-line' : 'py-2.5 px-1 font-bold bg-surface-50 text-[12px] border border-line';
                const borderEmptyTdClass = isLastRow ? 'py-2.5 px-1 bg-surface-50 text-pebble border-t border-r border-line' : 'py-2.5 px-1 bg-surface-50 text-pebble border border-line';

                html += `<tr class="hover:bg-surface-50"><td class="${borderHeadTdClass}">${i+1}교시</td>`;
                dates.forEach((date, dIdx) => {
                    const p = periodsByDate[date][i];
                    if (p) {
                        const saved = (appData.classSubjects[p.id] || {})[grade] || "";
                        let opts = '<option value="">선택</option>';
                        const subjects = [...new Set(['자습', ...appData.config.subjects, ...(saved ? [saved] : [])])];
                        subjects.forEach(subject => { opts += `<option value="${subject}" ${saved === subject ? 'selected' : ''}>${subjectLabel(subject)}</option>`; });
                        html += `<td class="${borderTdClass}"><select id="grade-subject-${p.id}-${grade}" class="w-full grade-subject-source" aria-label="${grade}학년 ${formatBeautifulDate(date)} ${i+1}교시 과목" onchange="updateGradeSubject('${p.id}', '${grade}', this.value)">${opts}</select></td>`;
                    } else html += `<td class="${borderEmptyTdClass}">-</td>`;
                });
                html += `</tr>`;
            }
            html += `</tbody></table></div></div></div>`;
        }
    });
    html += '</div>';
    container.innerHTML = html;
    refreshDropdowns();
};

window.handleNotesKey = function(e, idx, tabName) {
    if(e.key === 'ArrowUp') { e.preventDefault(); let el = document.getElementById(`note-${tabName}-${idx-1}`); if(el) { el.focus(); el.select(); } }
    if(e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); let el = document.getElementById(`note-${tabName}-${idx+1}`); if(el) { el.focus(); el.select(); } }
};

window.handleNotesPaste = function(e, idx, tabName) {
    e.preventDefault(); let paste = (e.clipboardData || window.clipboardData).getData('text'); let lines = paste.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        let input = document.getElementById(`note-${tabName}-${idx + i}`);
        if (input && lines[i] !== undefined) { input.value = lines[i].trim(); updateTeacher(input.getAttribute('data-tid'), 'notes', input.value, false); }
    }
};

// 피로도 1~5점 색 (배정 검증 화면 툴팁도 함께 쓴다)
window.FATIGUE_COLORS = ['#16A34A', '#65A30D', '#A16207', '#EA580C', '#DC2626'];

window.updateFatigueSlider = function(slider) {
    const color = FATIGUE_COLORS[Number(slider.value) - 1];
    slider.style.setProperty('--fatigue-level', color);
    slider.setAttribute('aria-valuetext', `${slider.value}점`);
    const score = document.getElementById(`${slider.id}-score`);
    score.value = `${slider.value}점`;
    score.style.color = color;
};

function fillRuleControls(values) {
    const rules = {...DEFAULT_RULES, ...values};
    if (document.getElementById('rule-homeroom')) {
        document.getElementById('rule-homeroom').checked = rules.excludeHomeroom !== false;
        document.getElementById('rule-subject').checked = rules.excludeSubject !== false;
        document.getElementById('rule-sameclass').checked = rules.excludeSameClass !== false;
        document.getElementById('rule-classconsec').checked = rules.excludeClassConsecutive !== false;
        document.getElementById('rule-hallconsec').checked = rules.excludeHallwayConsecutive !== false;
        document.getElementById('rule-maxconsec').value = rules.maxConsecutive || 99;

        let maxDiffVal = rules.maxDailyDiff;
        if (maxDiffVal === 0) maxDiffVal = 1;
        document.getElementById('rule-maxdiff').value = maxDiffVal || 99;

        document.getElementById('rule-f-main').value = rules.fatigueMain || DEFAULT_RULES.fatigueMain;
        document.getElementById('rule-f-sub').value = rules.fatigueSub || DEFAULT_RULES.fatigueSub;
        document.getElementById('rule-f-class').value = rules.fatigueClass || DEFAULT_RULES.fatigueClass;
        document.getElementById('rule-f-hall').value = rules.fatigueHall || DEFAULT_RULES.fatigueHall;
        document.getElementById('rule-f-sep').value = rules.fatigueSep || DEFAULT_RULES.fatigueSep;
        document.getElementById('rule-f-sp').value = rules.fatigueSp || DEFAULT_RULES.fatigueSp;
        document.querySelectorAll('#equity-card .fatigue-slider').forEach(updateFatigueSlider);
        document.getElementById('rule-bal-strategy').value = rules.balanceStrategy || 'FATIGUE';
    }
    refreshDropdowns();
}
window.resetRulesToDefaults = function() { fillRuleControls(DEFAULT_RULES); };

window.renderRulesTab = function() {
    const invigs = appData.config.invigCounts || {};
    const tb = document.getElementById('rules-invig-body');
    let rows = "";
    [1, 2, 3].forEach(g => {
        const isActive = appData.config.grades.includes(g);
        const hasSp = (appData.config.special[g] || 0) > 0;
        const hasSep = (appData.config.separated[g] || 0) > 0;

        let iv = invigs[g] || { class: 2, special: 1, separated: 1 };
        
        let currentStyle = "single";
        if ((iv.class ?? 2) === 0) {
            currentStyle = "none";
        } else if ((iv.class ?? 2) === 2) {
            currentStyle = "double";
        } else {
            currentStyle = "single";
        }

        const disabledClass = isActive ? '' : 'grade-row-disabled';
        const disabledAttr = isActive ? '' : 'disabled';
        const spDisabledAttr = (isActive && hasSp) ? '' : 'disabled';
        const sepDisabledAttr = (isActive && hasSep) ? '' : 'disabled';


        const isLastRow = (g === 3);
        const tdBorderClass = isLastRow ? 'p-1.5 border-t border-r border-line' : 'p-1.5 border border-line';
        const tdFirstBorderClass = isLastRow ? 'p-1.5 border-t border-r border-line font-bold' : 'p-1.5 border border-line font-bold';

        let trHtml = `<tr class="bg-surface-0 hover:bg-surface-50 ${disabledClass}"><td class="${tdFirstBorderClass}">${g}학년</td>
                <td class="${tdBorderClass}">
                    <div class="flex flex-col items-center justify-center">
                        <select class="fld iv-select p-1 text-[12px] font-bold cursor-pointer" id="iv-style-${g}" onchange="saveRules()" ${disabledAttr}>
                            <option value="none" ${currentStyle==='none'?'selected':''}>없음</option>
                            <option value="single" ${currentStyle==='single'?'selected':''}>정감독 (1인)</option>
                            <option value="double" ${currentStyle==='double'?'selected':''}>정·부감독 (2인)</option>
                        </select>
                    </div>
                </td>
                <td class="${tdBorderClass}"><select class="fld iv-select p-1 text-[12px] font-bold cursor-pointer" id="iv-sp-${g}" onchange="saveRules()" ${spDisabledAttr}><option value="1" selected>정감독 (1인)</option></select></td>
                <td class="${tdBorderClass}"><select class="fld iv-select p-1 text-[12px] font-bold cursor-pointer" id="iv-sep-${g}" onchange="saveRules()" ${sepDisabledAttr}><option value="1" selected>정감독 (1인)</option></select></td>`;
        rows += trHtml + `</tr>`;
    });
    tb.innerHTML = rows;
    fillRuleControls(appData.config.rules);
};

window.onStyleChange = function(g) {};

function saveRules() {
    if(!appData.config.rules) appData.config.rules = {};
    if(!appData.config.invigCounts) appData.config.invigCounts = {};
    appData.config.grades.forEach(g => {
        const styleElem = document.getElementById(`iv-style-${g}`);
        const spElem = document.getElementById(`iv-sp-${g}`);
        const sepElem = document.getElementById(`iv-sep-${g}`);
        if (styleElem && spElem && sepElem) {
            const style = styleElem.value;
            let classCount = 0;
            if (style === 'single') classCount = 1;
            else if (style === 'double') classCount = 2;
            appData.config.invigCounts[g] = { 
                class: classCount, 
                special: 1,
                separated: 1
            };
        }
    });
    if (document.getElementById('rule-homeroom')) {
        appData.config.rules.excludeHomeroom = document.getElementById('rule-homeroom').checked;
        appData.config.rules.excludeSubject = document.getElementById('rule-subject').checked;
        appData.config.rules.excludeSameClass = document.getElementById('rule-sameclass').checked;
        appData.config.rules.excludeClassConsecutive = document.getElementById('rule-classconsec').checked;
        appData.config.rules.excludeHallwayConsecutive = document.getElementById('rule-hallconsec').checked;
        appData.config.rules.maxConsecutive = parseInt(document.getElementById('rule-maxconsec').value) || 99;
        appData.config.rules.maxDailyDiff = parseInt(document.getElementById('rule-maxdiff').value) || 99;
        appData.config.rules.fatigueMain = parseInt(document.getElementById('rule-f-main').value) || DEFAULT_RULES.fatigueMain;
        appData.config.rules.fatigueSub = parseInt(document.getElementById('rule-f-sub').value) || DEFAULT_RULES.fatigueSub;
        appData.config.rules.fatigueClass = parseInt(document.getElementById('rule-f-class').value) || DEFAULT_RULES.fatigueClass;
        appData.config.rules.fatigueHall = parseInt(document.getElementById('rule-f-hall').value) || DEFAULT_RULES.fatigueHall;
        appData.config.rules.fatigueSep = parseInt(document.getElementById('rule-f-sep').value) || DEFAULT_RULES.fatigueSep;
        appData.config.rules.fatigueSp = parseInt(document.getElementById('rule-f-sp').value) || DEFAULT_RULES.fatigueSp;
        appData.config.rules.balanceStrategy = document.getElementById('rule-bal-strategy').value || 'FATIGUE';
    }
}
