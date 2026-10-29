// 배정 검증 화면.

window.renderValidateTab = function() {
    const vContainer = document.getElementById('validate-container');
    const btnEvents = document.getElementById('btn-show-events');

    const hasResults = hasAssignmentResults();
    const v = hasResults || (appData.teachers.length && appData.periods.length && appData.config.grades.length && appData.validation?.shortage)
        ? appData.validation : {};
    const ready = hasResults && Array.isArray(v.stats);
    const stats = ready ? v.stats.filter(s => appData.teachers.some(t => t.id === s.id || t.name === s.name)) : [];
    document.getElementById('event-modal-content').innerHTML = '';

    // 인력 부족으로 아예 배정이 불가능한 경우
    if (v.shortage) {
        if(btnEvents) btnEvents.classList.add('hidden');
        vContainer.className = 'flex-1 min-h-0 overflow-auto p-6';
        vContainer.innerHTML = `
            <div class="bg-surface-0 border border-coral/30 rounded-2xl shadow-sm max-w-2xl mx-auto mt-8 overflow-hidden">
              <div class="px-5 py-3 bg-coral/10 border-b border-coral/30 flex items-center gap-2">
                <span class="text-coral">${icon('alert', 'w-4 h-4')}</span>
                <h3 class="font-semibold text-[14px] text-coral">현재 상황으로는 배정할 수 없습니다</h3>
              </div>
              <div class="p-6">
                ${v.need ? `<div class="text-center mb-2">
                  <div class="text-[12px] text-pebble font-semibold mb-1">더 있어야 하는 감독 선생님</div>
                  <div class="text-3xl font-semibold text-coral">최소 ${v.need}<span class="text-base font-bold ml-1">명</span></div>
                </div>` : ''}
                <p class="text-[13px] font-bold text-stone text-center mb-5 leading-relaxed">${v.summary || '배정을 다시 실행하면 부족한 원인과 해결 방법을 안내합니다.'}</p>
                ${(v.reasons || []).length ? `<p class="text-[12.5px] font-bold text-text-main mb-2">이것부터 해 보세요</p>
                <div class="space-y-2">${v.reasons.map(r => `
                  <div class="p-3 bg-surface-50 rounded-lg border border-line">
                    <p class="font-bold text-[13px] mb-1">${r.message}</p>
                    <p class="text-[13px] leading-relaxed text-stone">${r.action}</p>
                    ${GO_TARGET_LABELS[r.target] ? `<button type="button" class="${GO_TARGET_BTN}" onclick="goToTarget('${r.target}')">${GO_TARGET_LABELS[r.target]}</button>` : ''}
                  </div>`).join('')}
                </div>` : ''}
              </div>
            </div>`;
        return;
    }

    if(btnEvents) btnEvents.classList.toggle('hidden', !ready);

    // split: 감독 명단처럼 머리글 표와 본문 스크롤을 나눈 표 (본문이 직접 스크롤한다)
    const panel = (iconName, title, body, split = false) => `
        <div class="flex flex-col h-full min-h-0 min-w-0">
          <div class="inline-flex items-center gap-2 bg-[#1E293B] text-white px-4 py-1.5 rounded-t-lg font-bold text-[13px] self-start z-10 mb-[calc(var(--hair)*-1)]">
            ${icon(iconName, 'w-4 h-4 text-white')}
            <span>${title}</span>
          </div>
          <div class="bg-surface-0 border border-line rounded-b-xl rounded-tr-xl overflow-hidden shadow-sm flex flex-col flex-1 min-h-0 ${split ? '' : 'p-4'}">
            <div class="flex-1 min-h-0 ${split ? 'flex flex-col' : 'overflow-y-auto'}">${body}</div>
          </div>
        </div>`;

    const showMain = appData.teachers.some(t => t.isMain),
          showSub  = appData.teachers.some(t => t.isSub),
          showHall = appData.teachers.some(t => t.isHallway),
          showSep  = appData.teachers.some(t => t.isSeparated),
          showSp   = appData.teachers.some(t => t.isSpecial),
          showCls  = appData.teachers.some(t => t.isClass1 !== false || t.isClass2 !== false || t.isClass3 !== false);

    const roleCols = [[showMain,'정감독','main'], [showSub,'부감독','sub'], [showHall,'복도감독','hall'],
                      [showSep,'분리감독','sep'], [showCls,'수업감독','cls'], [showSp,'특수감독','sp']].filter(c => c[0]);

    // 평소엔 두 카드가 반반. 감독 칸이 늘어 칸 너비 합이 반보다 커지면 왼쪽 표가 넓어지고 오른쪽 검증 카드가 줄어든다.
    // 감독·합계·피로도 칸은 너비를 비워 두면 syncSplitTableHeader 가 모두 같은 너비로 맞추고,
    // 남는 너비는 이름 칸(80px 이상)이 받는다. NUM_COL 은 표가 이보다 좁아지지 않게 하는 최소 너비.
    const NUM_COL = 78;
    const colWidths = [32, 80, ...roleCols.map(() => NUM_COL), NUM_COL, NUM_COL];
    const tableWidth = colWidths.reduce((a, b) => a + b);
    const statsMinWidth = tableWidth + 9 + 2; // 세로 스크롤바(9px) + 카드 테두리
    const statsColgroup = `<colgroup>${colWidths.map((w, i) => i < 2 ? `<col style="width: ${w}px;">` : '<col>').join('')}</colgroup>`;

    // 피로도 머리글에 마우스를 올리면 (index.html 의 .hidden 은 !important 라 group-hover 로 못 푼다 → invisible 사용) 배정할 때 쓴 감독별 피로도 점수를 보여 준다.
    const rules = appData.config.rules || {};
    const fatigueCard = `
        <div class="invisible group-hover:visible absolute right-0 top-full mt-1 w-48 p-3 rounded-xl border border-line bg-surface-0 shadow-lg text-left font-normal z-30">
          <p class="font-bold text-[12.5px] text-center mb-2">감독별 피로도</p>
          ${[['정감독','fatigueMain'], ['부감독','fatigueSub'], ['특수감독','fatigueSp'],
             ['분리감독','fatigueSep'], ['복도감독','fatigueHall'], ['수업감독','fatigueClass']].map(([lbl, key]) => {
              const n = rules[key] || DEFAULT_RULES[key];
              const color = FATIGUE_COLORS[n - 1];
              return `<div class="flex items-center gap-2 py-0.5 text-[12px]">
                <span class="w-14 font-bold text-text-main">${lbl}</span>
                <span class="flex-1 h-1.5 rounded-full bg-surface-100 overflow-hidden"><span class="block h-full rounded-full" style="width:${n * 20}%;background:${color}"></span></span>
                <span class="w-7 text-right font-bold" style="color:${color}">${n}점</span>
              </div>`;
          }).join('')}
        </div>`;

    // 감독 명단·결시 관리와 같은 방식: 머리글 표를 스크롤 밖에 두고 syncSplitTableHeader 로 열 너비를 맞춘다.
    // 그래야 세로 스크롤바 옆에서도 머리글 아래 선이 어긋나지 않는다.
    const statsTable = `
      <div id="stats-header" class="flex-shrink-0 bg-[#F1F5F9] relative z-30">
        <table class="w-full text-center whitespace-nowrap table-fixed" style="min-width: ${tableWidth}px;">
          ${statsColgroup}
          <thead class="bg-[#F1F5F9] text-text-main font-bold text-[13px] sticky top-0 z-20 shadow-sm">
            <tr class="bg-[#F1F5F9]">
              <th class="py-2.5 px-1 whitespace-nowrap align-middle border-b border-r border-line text-text-main bg-[#F1F5F9]">순</th>
              <th class="py-2.5 px-1 whitespace-nowrap align-middle border-b border-r border-line text-[14.5px] text-text-main bg-[#F1F5F9]">이름</th>
              ${roleCols.map(([, lbl]) => `<th class="py-2.5 px-0 whitespace-nowrap align-middle border-b border-r border-line bg-[#F1F5F9]">${lbl}</th>`).join('')}
              <th class="py-2.5 px-1 whitespace-nowrap align-middle border-b border-r border-line bg-[#F1F5F9]">합계</th>
              <th class="group relative py-2.5 px-1 whitespace-nowrap align-middle border-b border-line bg-[#F1F5F9] cursor-help">
                <span class="relative">피로도<span class="absolute left-full top-1/2 -translate-y-1/2 ml-0.5 flex">${icon('info', 'w-3 h-3 text-pebble')}</span></span>
                ${fatigueCard}
              </th>
            </tr>
          </thead>
        </table>
      </div>
      <div id="stats-scroll" class="flex-1 min-h-0 overflow-auto">
        <table class="w-full text-center text-sm whitespace-nowrap table-fixed" style="min-width: ${tableWidth}px;">
          ${statsColgroup}
          <tbody class="bg-surface-0">
            ${stats.map((s, i) => `
              <tr class="hover:bg-surface-50 bg-surface-0 transition-colors">
                <td class="py-2.5 px-1 border border-line bg-surface-50 font-bold text-[13px]">${i+1}</td>
                <td class="py-2.5 px-1 border border-line font-bold text-[14.5px]">${s.name}</td>
                ${roleCols.map(([, , key]) => `<td class="py-2.5 px-1 border border-line text-stone font-semibold text-sm">${s[key] || ''}</td>`).join('')}
                <td class="py-2.5 px-1 border border-line font-semibold text-coral bg-coral/10 text-sm">${s.total}</td>
                <td class="py-2.5 px-1 border border-line font-semibold text-brand-700 bg-brand-50/50 text-sm">${s.workload || 0}</td>
              </tr>`).join('') || emptyTableRows(colWidths.length)}
          </tbody>
        </table>
      </div>`;

    let verifyHtml;
    if (!ready || !v.verify) {
        verifyHtml = `<div class="text-pebble text-[13px] text-center py-10 font-bold">배정을 실행하면 검증 결과가 표시됩니다.</div>`;
    } else {
        const allPass = v.verify.all_pass;
        const passed = v.verify.checks.filter(check => check.pass).length;
        const total = v.verify.checks.length;
        const banner = `
            <div class="verify-review ${allPass ? '' : 'has-issues'}">
              <div class="verify-summary">
                <span class="verify-seal" aria-hidden="true">${allPass ? '✓' : '!'}</span>
                <div><h3>${allPass ? '모든 규칙을 충족했어요' : '확인이 필요한 규칙이 있어요'}</h3>
                <p>${allPass ? '누락이나 중복 없이 배정되었습니다.' : `${total - passed}개 규칙의 위반 내용을 확인하세요.`}</p></div>
                <div class="verify-score">${passed}<small> / ${total}</small></div>
              </div>
              <div class="verify-progress" aria-hidden="true"><span style="width:${total ? passed / total * 100 : 0}%"></span></div>`;
        const cleanCheckName = (name) => {
            if (!name) return '';
            return name
                .replace(/\s*\((절대 규칙|형평성 규칙|슬롯 누락 확인|최대배정 제한)\)/g, '')
                .replace("시간 배정 금지", " 배정 금지")
                .replace("특정 감독 연속 배정 금지", "동일 역할(수업/복도) 연속 배정 금지");
        };
        const cards = v.verify.checks.map((c, index) => {
            const badge = `<span class="verify-status ${c.pass ? '' : 'is-failed'}">${c.pass ? '✓ 충족' : '! 확인 필요'}</span>`;
            let detail = '';
            if (!c.pass && c.messages.length) {
                // 교사가 정해진 메시지는 누르면 배정 결과의 해당 칸으로 이동한다.
                const li = (m, i) => {
                    const [tid, pid] = (c.targets && c.targets[i]) || [];
                    return tid ? `<li class="cursor-pointer hover:underline" title="배정 결과에서 보기" onclick="jumpToCell('${tid}', '${pid || ''}')">${m}</li>` : `<li>${m}</li>`;
                };
                detail = `<ul class="mt-2 ml-4 list-disc text-[11px] text-coral space-y-0.5 font-bold">${
                    c.messages.map(li).join('')}</ul>`;
                // 해결 방법과 바로 가기 (validator.py 의 fixes)
                if (c.fix) detail += `<div class="mt-2.5 pt-2.5 border-t border-coral/20 text-[11.5px] text-text-main font-semibold leading-relaxed">
                    <span class="font-bold">해결 방법</span> · ${c.fix}
                    ${GO_TARGET_LABELS[c.fix_target] ? `<div><button type="button" class="${GO_TARGET_BTN}" onclick="goToTarget('${c.fix_target}')">${GO_TARGET_LABELS[c.fix_target]}</button></div>` : ''}
                  </div>`;
            } else if (c.pass && c.messages.length && !c.messages[0].startsWith('(')) {
                detail = `<div class="mt-2 ml-4 text-[11px] text-stone font-bold">${c.messages[0]}</div>`;
            }
            return `
                <div class="verify-row ${c.pass ? '' : 'is-failed'}">
                  <div class="verify-row-heading">
                    <span class="verify-number">${String(index + 1).padStart(2, '0')}</span>
                    <span class="verify-rule-name">${cleanCheckName(c.name).replace(/^\s*\d+[.)]\s*/, '')}</span>${badge}
                  </div>${detail ? `<div class="verify-detail">${detail}</div>` : ''}
                </div>`;
        }).join('');
        verifyHtml = banner + `<div class="verify-list">${cards}</div></div>`;
    }

    document.getElementById('event-modal-content').innerHTML =
        (ready && v.logs && v.logs.length > 0)
            ? `<ul class="space-y-2 list-disc pl-5">${v.logs.map(l => `<li class="font-bold text-[12.5px]">${l}</li>`).join('')}</ul>`
            : !ready ? '' : `<div class="text-emerald-700 font-semibold text-center py-16 text-[14px] flex flex-col items-center gap-3">
                 ${icon('check-circle', 'w-8 h-8 text-emerald-600')} 모든 권장 규칙을 만족하며 배정되었습니다.
               </div>`;

    vContainer.className = 'flex-1 min-h-0 overflow-hidden flex flex-col p-5';
    vContainer.innerHTML = `
        <div class="grid gap-4 flex-1 min-h-0" style="grid-template-columns: minmax(${statsMinWidth}px, 1fr) minmax(0, 1fr);">
          ${panel('clipboard-check', '교사별 감독 배정 횟수', statsTable, true)}
          ${panel('search', '배정 결과 검증', verifyHtml, false)}
        </div>`;
    // 브라우저가 첫 프레임을 표시하기 전에 열 너비와 빈 행 높이를 확정한다.
    syncStatsHeader();
};

// shell.js 의 syncScrollHeads 가 화면이 바뀔 때마다 부른다.
function syncStatsHeader() {
    const scroll = document.getElementById('stats-scroll');
    if (scroll) syncSplitTableHeader(scroll, document.getElementById('stats-header'));
}

// 배정 결과(교사별) 표에서 해당 칸을 찾아 화면 가운데로 옮기고 잠깐 강조한다.
// 교시가 없는 메시지(배정 제한 초과 등)는 교사 줄 전체를 강조한다.
window.jumpToCell = function(tid, pid) {
    showTab('tab-result');
    document.querySelector('.result-sub-btn[data-target="result-teacher"]').click();
    const el = document.querySelector(pid ? `[data-cell="${tid}|${pid}"]` : `[data-row="${tid}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    el.classList.add('cell-flash');
    setTimeout(() => el.classList.remove('cell-flash'), 2000);
};
