// 배정 결과 화면과 수동 교체.
// 교체 가능 여부 판정은 main.py 의 check_label 에 위임한다(브리지 호출).

let assignmentDrag = null;
let assignmentPointer = null;
function clearAssignmentDrag() {
    const pointer = assignmentPointer;
    assignmentPointer = null;
    if (pointer?.source.hasPointerCapture(pointer.id)) pointer.source.releasePointerCapture(pointer.id);
    if (!assignmentDrag) return;
    cancelAnimationFrame(assignmentDrag.scrollFrame);
    assignmentDrag.source.classList.remove('assign-drag-source');
    assignmentDrag.target?.classList.remove('assign-drop-ready');
    assignmentDrag.card.remove();
    assignmentDrag = null;
}
function moveAssignmentCard(e) {
    if (!assignmentDrag) return;
    const zoom = parseFloat(document.documentElement.style.zoom) || 1;
    const { card, offsetX, offsetY } = assignmentDrag;
    const box = card.getBoundingClientRect();
    card.style.left = `${Math.max(0, Math.min(e.clientX - offsetX, innerWidth - box.width)) / zoom}px`;
    card.style.top = `${Math.max(0, Math.min(e.clientY - offsetY, innerHeight - box.height)) / zoom}px`;
}
window.handleAssignDragStart = function(e, tId, pId) {
    clearAssignmentDrag();
    if (e.dataTransfer) {
        e.dataTransfer.setData("text/plain", JSON.stringify({tId, pId}));
        e.dataTransfer.effectAllowed = 'move';
    }
    const source = e.currentTarget;
    const card = document.createElement('div');
    card.className = 'assign-drag-card';
    card.textContent = source.textContent;
    document.body.append(card);
    source.classList.add('assign-drag-source');
    const sourceBox = source.getBoundingClientRect(), cardBox = card.getBoundingClientRect();
    const offsetX = Math.max(0, Math.min(1, ((e.grabX ?? e.clientX) - sourceBox.left) / sourceBox.width)) * cardBox.width;
    const offsetY = Math.max(0, Math.min(1, ((e.grabY ?? e.clientY) - sourceBox.top) / sourceBox.height)) * cardBox.height;
    assignmentDrag = { tId, pId, source, card, offsetX, offsetY, target: null };
    moveAssignmentCard(e);
};
window.handleAssignDragOver = function(e, tId, pId) {
    const drag = assignmentDrag;
    if (!drag) { e.preventDefault(); return; }
    const ready = drag.pId === pId && drag.tId !== tId
        && ((appData.assignments[drag.tId] || {})[pId] || (appData.assignments[tId] || {})[pId]);
    if (!ready) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    if (drag.target !== e.currentTarget) {
        drag.target?.classList.remove('assign-drop-ready');
        drag.target = e.currentTarget;
        drag.target.classList.add('assign-drop-ready');
    }

};
document.addEventListener('dragover', e => {
    moveAssignmentCard(e);
    const drag = assignmentDrag;
    if (drag?.target && !drag.target.contains(e.target)) {
        drag.target.classList.remove('assign-drop-ready');
        drag.target = null;
    }
});
document.addEventListener('dragend', clearAssignmentDrag);
document.addEventListener('drop', clearAssignmentDrag);
// 포인터로 이동을 처리해 WebView의 반투명 기본 드래그 이미지가 생기지 않게 한다.
window.handleAssignPointerDown = function(e, tId, pId) {
    if (e.button !== 0 || !e.isPrimary) return;
    clearAssignmentDrag();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    assignmentPointer = { source: e.currentTarget, id: e.pointerId, tId, pId, x: e.clientX, y: e.clientY };
};
function updateAssignmentTarget(x, y) {
    const target = document.elementFromPoint(x, y)?.closest('[data-swap-teacher]');
    if (assignmentDrag.target !== target) {
        assignmentDrag.target?.classList.remove('assign-drop-ready');
        assignmentDrag.target = null;
    }
    if (target) handleAssignDragOver({ currentTarget: target, preventDefault() {} }, target.dataset.swapTeacher, target.dataset.swapPeriod);
}
function scrollAssignmentDrag(time) {
    const drag = assignmentDrag, pointer = assignmentPointer;
    if (!drag || !pointer) return;
    const scroll = pointer.source.closest('.result-table-scroll');
    const box = scroll?.getBoundingClientRect();
    const edge = box ? Math.min(40, box.height / 5) : 0;
    let direction = 0, pressure = 0;
    if (edge && pointer.clientX >= box.left && pointer.clientX <= box.right
        && pointer.clientY >= box.top - edge && pointer.clientY <= box.bottom + edge) {
        if (pointer.clientY < box.top + edge) { direction = -1; pressure = (box.top + edge - pointer.clientY) / edge; }
        else if (pointer.clientY > box.bottom - edge) { direction = 1; pressure = (pointer.clientY - box.bottom + edge) / edge; }
    }
    if (direction !== drag.scrollDirection) {
        drag.scrollDirection = direction;
        drag.edgeSince = time;
    }
    const elapsed = Math.min(32, time - (drag.scrollTime ?? time));
    drag.scrollTime = time;
    // 가장자리 40px 안에서 180ms 머문 뒤, 초당 80~400 화면 픽셀로 부드럽게 이동한다.
    if (direction && time - drag.edgeSince >= 180) {
        const zoom = parseFloat(document.documentElement.style.zoom) || 1;
        const before = scroll.scrollTop;
        scroll.scrollTop += direction * (80 + 320 * Math.min(1, pressure) ** 2) * elapsed / 1000 / zoom;
        if (scroll.scrollTop !== before) updateAssignmentTarget(pointer.clientX, pointer.clientY);
    }
    drag.scrollFrame = requestAnimationFrame(scrollAssignmentDrag);
}
document.addEventListener('pointermove', e => {
    const pointer = assignmentPointer;
    if (!pointer || pointer.id !== e.pointerId) return;
    if (!assignmentDrag) {
        if (Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) < 4) return;
        // 시작 함수의 정리 작업 뒤에도 현재 포인터 정보를 유지한다.
        handleAssignDragStart({ currentTarget: pointer.source, clientX: e.clientX, clientY: e.clientY, grabX: pointer.x, grabY: pointer.y }, pointer.tId, pointer.pId);
        assignmentPointer = pointer;
        pointer.source.setPointerCapture(pointer.id);
        assignmentDrag.scrollFrame = requestAnimationFrame(scrollAssignmentDrag);
    }
    pointer.clientX = e.clientX;
    pointer.clientY = e.clientY;
    moveAssignmentCard(e);
    updateAssignmentTarget(e.clientX, e.clientY);
});
document.addEventListener('pointerup', e => {
    const pointer = assignmentPointer;
    if (!pointer || pointer.id !== e.pointerId) return;
    const target = assignmentDrag?.target;
    clearAssignmentDrag();
    if (target) handleAssignDrop({ preventDefault() {}, dataTransfer: { getData: () => JSON.stringify({ tId: pointer.tId, pId: pointer.pId }) } }, target.dataset.swapTeacher, target.dataset.swapPeriod);
});
document.addEventListener('pointercancel', clearAssignmentDrag);
document.addEventListener('keydown', e => { if (e.key === 'Escape') clearAssignmentDrag(); });
window.addEventListener('blur', clearAssignmentDrag);
window.handleAssignDrop = function(e, targetTId, targetPId) {
    e.preventDefault();
    clearAssignmentDrag();
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
            const styleLabel = (l) => `<span class="swap-assignment">${l}</span>`;
            msgEl.innerHTML = (a1 && !a2)
                ? `<div>${name1} 교사의 ${styleLabel(a1)} 감독을</div><div class="mt-3">${name2} 교사의 ${styleLabel('공강 시간')}으로 넘기시겠습니까?</div>`
                : (!a1 && a2)
                ? `<div>${name2} 교사의 ${styleLabel(a2)} 감독을</div><div class="mt-3">${name1} 교사의 ${styleLabel('공강 시간')}으로 넘기시겠습니까?</div>`
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

    const infoStr = `<div class="swap-sentence">${t1.name} 교사의<br>${formatBeautifulDate(p.date)} ${p.name} <span class="swap-assignment">${a1}</span>을 교체합니다.</div>`;
    document.getElementById('rc-swap-info').innerHTML = infoStr;

    // 공강 → 배정 중 → 선택 불가 순으로 묶어 4열 메뉴로 보여 준다 (ui.js 의 grid-select).
    const groups = { free: [], busy: [], absent: [] };
    appData.teachers.forEach(t2 => {
        if (t2.id === tId) return;
        const a2 = (appData.assignments[t2.id] || {})[pId];
        const abs = t2.absences && t2.absences[pId];
        if (abs) {
            groups.absent.push(`<option value="${t2.id}" disabled>${t2.name}</option>`);
        } else if (a2) groups.busy.push(`<option value="${t2.id}" data-sub="${a2}">${t2.name}</option>`);
        else groups.free.push(`<option value="${t2.id}">${t2.name}</option>`);
    });
    const group = (label, items, state) => items.length ? `<optgroup label="${label}" data-count="${items.length}명" data-state="${state}">${items.join('')}</optgroup>` : '';
    document.getElementById('rc-swap-target').innerHTML = `<option value="">새로 투입할 교사를 선택하세요</option>`
        + group('공강', groups.free, 'free') + group('배정 중', groups.busy, 'busy') + group('선택 불가', groups.absent, 'absent');
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

// 불가 사유가 있으면 안내를 띄우고 true를 반환해 교체를 중단한다.
function reportSwapBlocked(t1, t2, [v1, v2]) {
    for (const [teacher, result] of [[t1, v1], [t2, v2]]) {
        if (result.valid) continue;
        showToast(result.code === 'absence' ? result.reason : `[${teacher.name} 교사 불가 사유]\n${result.reason}`, 'error');
        return true;
    }
    return false;
}
