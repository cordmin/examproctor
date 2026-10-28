// 전역 상태.
// 모든 화면이 이 appData 하나를 읽고 쓴다. 가장 먼저 로드되어야 한다.

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

// 되돌리기용: 바꾸기 직전의 배정·결시 상태(JSON 문자열)를 쌓아 둔다.
const undoStack = [], redoStack = [];
