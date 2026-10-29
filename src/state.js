// 전역 상태.
// 모든 화면이 이 appData 하나를 읽고 쓴다. 가장 먼저 로드되어야 한다.

const DEFAULT_RULES = Object.freeze({
    excludeSubject: true, excludeHomeroom: true, excludeHallwayConsecutive: false,
    excludeSameClass: false, excludeClassConsecutive: true,
    maxConsecutive: 99, maxDailyDiff: 99, balanceStrategy: 'FATIGUE',
    fatigueMain: 5, fatigueSub: 3, fatigueSp: 3, fatigueSep: 3, fatigueHall: 2, fatigueClass: 1,
});

function createEmptyData() { return {
    config: { examName: "", grades: [], classes: {}, hallways: {}, separated: {}, special: {}, subjects: [], examDates: [], rules: {}, invigCounts: {} },
    teachers: [], periods: [], classSubjects: {}, assignments: {}, validation: {}
}; }
let appData = createEmptyData();
let currentResultView = 'result-teacher'; 
let isDragging = false; let isRightDragging = false;
let activeBrush = { type: 'ALL', target: '', fill: 'bg-coral text-white' };
let toastTimeout;
let dragTargetBtn = null; 

let pendingSwapData = null;
let rcSwapData = null;
let confirmCallback = null;


// Stale saved results must never appear when their teachers, periods or grades are gone.
function hasAssignmentResults() {
    return appData.config.grades.length > 0 && appData.teachers.some(t =>
        appData.periods.some(p => {
            const label = appData.assignments?.[t.id]?.[p.id];
            return label && label !== '-';
        }));
}
