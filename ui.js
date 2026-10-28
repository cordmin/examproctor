// 공통 UI 조각.
// 아이콘, 토스트, 확인 모달, 날짜 포맷, 날짜×교시 표 헬퍼.

window.icon = (name, cls = 'w-4 h-4') => `<svg class="${cls}"><use href="#i-${name}"/></svg>`;

window.showToast = function(message, type = 'success') {
    const toast = document.getElementById('toast-notification');
    const mark = type === 'success'
        ? `<span class="text-teal flex-shrink-0">${icon('check-circle', 'w-5 h-5')}</span>`
        : `<span class="text-coral flex-shrink-0">${icon('alert', 'w-5 h-5')}</span>`;
    toast.innerHTML = `${mark}<span class="whitespace-pre-line leading-relaxed">${message}</span>`;
    toast.classList.remove('translate-y-10', 'opacity-0', 'pointer-events-none');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0', 'pointer-events-none');
    }, type === 'error' ? 5000 : 3000);
};

window.openConfirmModal = function(title, msg, confirmText, callback) {
    // 제목 옆 경고 아이콘은 그대로 두고 <span> 안의 글자만 바꾼다.
    document.querySelector('#confirm-modal-title span').innerText = title;
    document.getElementById('confirm-modal-msg').innerHTML = msg;
    const btn = document.getElementById('confirm-modal-btn');
    btn.innerText = confirmText;
    confirmCallback = callback;
    const m = document.getElementById('confirm-modal');
    m.classList.remove('hidden');
    m.focus();
};

window.closeConfirmModal = function() {
    confirmCallback = null;
    document.getElementById('confirm-modal').classList.add('hidden');
};

window.executeConfirm = function() {
    if(confirmCallback) confirmCallback();
    closeConfirmModal();
};

function formatBeautifulDate(dateStr) {
    if(!dateStr) return "";
    const [y, m, d] = dateStr.split('-'); const dateObj = new Date(y, parseInt(m)-1, d); const days = ['일','월','화','수','목','금','토'];
    return `${parseInt(m)}월 ${parseInt(d)}일(${days[dateObj.getDay()]})`;
}

function formatHomeroom(val) {
    if(!val) return "";
    let m = val.match(/^(\d+)-(\d+)$/);
    if(m) return `${m[1]}-${m[2]}`;
    return val;
}

function naturalSortKey(a, b) {
    return a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'});
}

// ── 날짜 x 교시 표 공통 ──────────────────────────────────────────────────
// 시험교과/결시/배정결과 탭이 모두 '날짜를 묶고 그 아래 교시를 펼치는' 같은 표를 쓴다.

function groupPeriodsByDate() {
    const periodsByDate = {};
    appData.periods.forEach(p => (periodsByDate[p.date] ||= []).push(p));
    return { periodsByDate, dates: Object.keys(periodsByDate).sort() };
}

// 날짜가 바뀌는 경계에는 굵은 세로선, 표 맨 왼쪽 데이터 칸에는 굵은 왼쪽 선.
// .border-thick / .border-edge 는 index.html 에 정의된 !important 유틸이다.
// (Tailwind 의 border-l-4 는 th,td 기본 테두리 규칙과 충돌해 쓰지 않는다)
function cellBorders(periodsByDate, dates, dIdx, pIdx) {
    const lastOfDate = pIdx === periodsByDate[dates[dIdx]].length - 1;
    const thick = lastOfDate ? 'border-thick' : '';
    const firstCol = (dIdx === 0 && pIdx === 0) ? 'border-edge' : '';
    return `${thick} ${firstCol}`;
}



function build2RowDatePeriodHeaderParts(periodsByDate, dates, periodClass) {
    let row1 = '';
    let row2 = '';
    dates.forEach((d, dIdx) => {
        const periods = periodsByDate[d];
        const isLastDate = dIdx === dates.length - 1;
        const borderR = isLastDate ? '' : 'border-r-2 border-slate-300';
        row1 += `<th colspan="${periods.length}" class="py-1.5 px-2 font-bold text-center border-b border-line text-text-main text-[13.5px] bg-[#F1F5F9] ${borderR}">${formatBeautifulDate(d)}</th>`;
        periods.forEach((p, pIdx) => {
            const isLastP = pIdx === periods.length - 1;
            const bClass = isLastP ? (isLastDate ? '' : 'border-r-2 border-slate-300') : 'border-r border-line';
            row2 += `<th class="py-2 px-1 font-bold text-text-main text-center bg-[#F1F5F9] border-b border-line ${bClass} ${periodClass}">${p.name}</th>`;
        });
    });
    return { row1, row2 };
}
