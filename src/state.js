// 전역 상태.
// 모든 화면이 이 appData 하나를 읽고 쓴다. 가장 먼저 로드되어야 한다.

const DEFAULT_RULES = Object.freeze({
    excludeSubject: true, excludeHomeroom: true, excludeHallwayConsecutive: false,
    excludeSameClass: false, excludeClassConsecutive: true,
    maxConsecutive: 99, maxDailyDiff: 99, balanceStrategy: 'FATIGUE',
    fatigueMain: 5, fatigueSub: 3, fatigueSp: 3, fatigueSep: 3, fatigueHall: 2, fatigueClass: 1,
});

let appData = {
    config: { examName: "", grades: [], classes: {}, hallways: {}, separated: {}, special: {}, subjects: [], examDates: [], rules: {}, invigCounts: {} },
    teachers: [], periods: [], classSubjects: {}, assignments: {}, validation: {}
};
let currentResultView = 'result-teacher'; 
let isDragging = false; let isRightDragging = false;
let activeBrush = { type: 'ALL', target: '', fill: 'bg-coral text-white' };
let toastTimeout;
let dragTargetBtn = null; 

let pendingSwapData = null;
let rcSwapData = null;
let confirmCallback = null;

