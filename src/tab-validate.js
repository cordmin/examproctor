// 배정 검증 화면.

window.renderValidateTab = function() {
    const vContainer = document.getElementById('validate-container');
    const btnEvents = document.getElementById('btn-show-events');

    if(!appData.validation || Object.keys(appData.validation).length === 0) {
        vContainer.innerHTML = `<div class="p-12 text-center text-pebble font-bold mt-10">배정을 먼저 실행해주세요.</div>`;
        if(btnEvents) btnEvents.classList.add('hidden');
        return;
    }

    const v = appData.validation;

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
                <p class="text-[13px] font-bold text-stone text-center mb-6 leading-relaxed">
                  설정된 시험 구역(슬롯)에 비해 감독 가능한 교사의 총 감독 횟수가 부족합니다.
                </p>
                <div class="flex justify-center items-stretch gap-10">
                  <div class="text-center">
                    <div class="text-[11px] text-pebble font-semibold mb-1.5 tracking-wide">필요 구역(슬롯) 수</div>
                    <div class="text-3xl font-semibold text-coral">${v.required}<span class="text-base font-bold ml-1">개</span></div>
                  </div>
                  <div class="w-px bg-surface-200"></div>
                  <div class="text-center">
                    <div class="text-[11px] text-pebble font-semibold mb-1.5 tracking-wide">현재 가용 횟수</div>
                    <div class="text-3xl font-semibold text-coral">${v.available}<span class="text-base font-bold ml-1">번</span></div>
                  </div>
                </div>
              </div>
            </div>`;
        return;
    }

    if(btnEvents) btnEvents.classList.remove('hidden');

    const panel = (iconName, title, body, noPadding = false) => `
        <div class="flex flex-col h-full min-h-0">
          <div class="inline-flex items-center gap-2 bg-[#1E293B] text-white px-4 py-1.5 rounded-t-lg font-bold text-[13px] self-start z-10 -mb-[1px]">
            ${icon(iconName, 'w-4 h-4 text-white')}
            <span>${title}</span>
          </div>
          <div class="bg-surface-0 border border-line rounded-b-xl rounded-tr-xl overflow-hidden shadow-sm flex flex-col flex-1 min-h-0 ${noPadding ? '' : 'p-4'}">
            <div class="flex-1 overflow-y-auto min-h-0">${body}</div>
          </div>
        </div>`;

    const showMain = appData.teachers.some(t => t.isMain),
          showSub  = appData.teachers.some(t => t.isSub),
          showHall = appData.teachers.some(t => t.isHallway),
          showSep  = appData.teachers.some(t => t.isSeparated),
          showSp   = appData.teachers.some(t => t.isSpecial),
          showCls  = appData.teachers.some(t => t.isClass1 !== false || t.isClass2 !== false || t.isClass3 !== false);

    const roleCols = [[showMain,'정','main'], [showSub,'부','sub'], [showHall,'복','hall'],
                      [showSep,'분','sep'], [showCls,'수','cls'], [showSp,'특','sp']].filter(c => c[0]);

    let statsColgroup = `<colgroup>
        <col style="width: 38px;">
        <col style="width: 86px;">
        <col style="width: 48px;">
        <col style="width: 48px;">`;
    roleCols.forEach(() => {
        statsColgroup += `<col style="width: 48px;">`;
    });
    statsColgroup += `</colgroup>`;

    const statsTable = `
        <table class="w-full min-w-full text-center text-sm whitespace-nowrap border-collapse table-fixed">
          ${statsColgroup}
          <thead class="bg-[#F1F5F9] text-text-main font-bold text-[13px] sticky top-0 z-20 shadow-sm">
            <tr class="bg-[#F1F5F9]">
              <th class="py-2.5 px-1 whitespace-nowrap align-middle border-b border-r border-line text-text-main bg-[#F1F5F9]">순</th>
              <th class="py-2.5 px-1 whitespace-nowrap align-middle border-b border-r border-line text-[14.5px] text-text-main bg-[#F1F5F9]">성명</th>
              <th class="py-2.5 px-1 text-brand-600 whitespace-nowrap align-middle border-b border-r border-line bg-[#F1F5F9]">피로도</th>
              <th class="py-2.5 px-1 text-amber whitespace-nowrap align-middle border-b border-r border-line bg-[#F1F5F9]">총</th>
              ${roleCols.map(([,, key], idx) => {
                  const isLast = idx === roleCols.length - 1;
                  const bClass = isLast ? 'border-b border-line' : 'border-b border-r border-line';
                  return `<th class="py-2.5 px-1 whitespace-nowrap align-middle ${bClass} bg-[#F1F5F9]">${roleCols[idx][1]}</th>`;
              }).join('')}
            </tr>
          </thead>
          <tbody class="bg-surface-0">
            ${v.stats.map((s, i) => `
              <tr class="hover:bg-surface-50 bg-surface-0 transition-colors">
                <td class="py-2.5 px-1 border border-line bg-surface-50 font-bold text-[13px]">${i+1}</td>
                <td class="py-2.5 px-1 border border-line font-bold text-[14.5px]">${s.name}</td>
                <td class="py-2.5 px-1 border border-line font-semibold text-brand-700 bg-brand-50/50 text-sm">${s.workload || 0}</td>
                <td class="py-2.5 px-1 border border-line font-semibold text-coral bg-coral/10 text-sm">${s.total}</td>
                ${roleCols.map(([, , key]) => `<td class="py-2.5 px-1 border border-line text-stone font-semibold text-sm">${s[key] || ''}</td>`).join('')}
              </tr>`).join('')}
          </tbody>
        </table>`;

    let verifyHtml;
    if (!v.verify) {
        verifyHtml = `<div class="text-pebble text-[13px] text-center py-10 font-bold">배정을 다시 실행하면 정밀 규칙 검사가 갱신됩니다.</div>`;
    } else {
        const allPass = v.verify.all_pass;
        const banner = `
            <div class="rounded-xl p-3.5 mb-4 font-semibold text-[14px] flex items-center justify-center gap-2 border ${
                allPass ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-bold' : 'bg-coral/10 border-coral/30 text-text-main'}">
              ${icon(allPass ? 'check-circle' : 'alert', 'w-5 h-5 ' + (allPass ? 'text-emerald-600' : ''))}
              ${allPass ? '모든 필수 규칙 검증 통과' : '일부 규칙 위반 사항이 감지됨'}
            </div>`;
        const cleanCheckName = (name) => {
            if (!name) return '';
            return name
                .replace(/\s*\((절대 규칙|형평성 규칙|슬롯 누락 확인|최대배정 제한)\)/g, '')
                .replace("시간 배정 금지", " 배정 금지")
                .replace("특정 감독 연속 배정 금지", "동일 역할(수업/복도) 연속 배정 금지");
        };
        const cards = v.verify.checks.map(c => {
            const badge = c.pass
                ? `<span class="text-emerald-700 font-bold text-[10.5px] bg-emerald-100/90 border border-emerald-200/60 px-2 py-0.5 rounded-full flex-shrink-0">PASS</span>`
                : `<span class="text-coral font-bold text-[10.5px] bg-coral/15 px-2 py-0.5 rounded-full flex-shrink-0">FAIL</span>`;
            let detail = '';
            if (!c.pass && c.messages.length) {
                // 교사가 정해진 메시지는 누르면 배정 결과의 해당 칸으로 이동한다.
                const li = (m, i) => {
                    const [tid, pid] = (c.targets && c.targets[i]) || [];
                    return tid ? `<li class="cursor-pointer hover:underline" title="배정 결과에서 보기" onclick="jumpToCell('${tid}', '${pid || ''}')">${m}</li>` : `<li>${m}</li>`;
                };
                detail = `<ul class="mt-2 ml-4 list-disc text-[11px] text-coral space-y-0.5 font-bold">${
                    c.messages.map(li).join('')}</ul>`;
            } else if (c.pass && c.messages.length && !c.messages[0].startsWith('(')) {
                detail = `<div class="mt-2 ml-4 text-[11px] text-stone font-bold">${c.messages[0]}</div>`;
            }
            return `
                <div class="border rounded-lg p-3 shadow-sm ${c.pass ? 'border-surface-200 bg-surface-0' : 'border-coral/30 bg-coral/5'}">
                  <div class="flex items-start justify-between gap-2">
                    <div class="font-bold text-[12.5px] break-keep leading-snug">${cleanCheckName(c.name)}</div>${badge}
                  </div>${detail}
                </div>`;
        }).join('');
        verifyHtml = banner + `<div class="grid grid-cols-1 gap-2.5">${cards}</div>`;
    }

    document.getElementById('event-modal-content').innerHTML =
        (v.logs && v.logs.length > 0)
            ? `<ul class="space-y-2 list-disc pl-5">${v.logs.map(l => `<li class="font-bold text-[12.5px]">${l}</li>`).join('')}</ul>`
            : `<div class="text-emerald-700 font-semibold text-center py-16 text-[14px] flex flex-col items-center gap-3">
                 ${icon('check-circle', 'w-8 h-8 text-emerald-600')} 모든 권장 규칙을 만족하며 배정되었습니다.
               </div>`;

    vContainer.className = 'flex-1 min-h-0 overflow-hidden flex flex-col p-5';
    vContainer.innerHTML = `
        <div class="grid grid-cols-2 gap-4 flex-1 min-h-0">
          ${panel('clipboard-check', '교사별 감독 배정수(피로도/감독별)', statsTable, true)}
          ${panel('search', '배정 결과 검증', verifyHtml, false)}
        </div>`;
};

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
