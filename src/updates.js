// 프로그램 시작 시 자료 불러오기, 업데이트 확인, 정보 창, 개인정보처리방침 창.

window.addEventListener('pywebviewready', function() {
    mountResizeHandles();
    winApi().is_maximized().then(setMaximized);
    window.pywebview.api.get_initial_data().then(data => {
        if(data) appData = data;
        sanitizeAppData(appData);
        renderConfigTab(); renderSubjectsTab(); renderTeachers(); renderAbsencesTab(); renderResultTab(); renderRulesTab(); renderValidateTab(); markDataSaved();
        showPageHint(activeTarget);
    });
    // 켤 때마다 가이드 투어를 띄운다. '다시 보지 않기'를 체크했으면 띄우지 않는다.
    window.pywebview.api.get_settings().then(settings => {
        examPlaceGuideSeen = !!settings.examPlaceGuideSeen;
        renderExamPlaceGuide();
        tourHidden = !!settings.hideTour;
        if (!tourHidden) startTour();
    });
    window.pywebview.api.get_version().then(v => { document.getElementById('app-version').textContent = `v${v}`; });
    // 켜자마자(작업 전) 확인하고, 새 버전이 있으면 받을지 묻는다. 설치하면 창이 닫혔다가 다시 켜진다.
    // [나중에]를 눌러도 제목 줄의 [업데이트] 버튼으로 언제든 다시 물을 수 있다.
    window.pywebview.api.check_update().then(res => {
        if (!res.available) return;
        const btn = document.getElementById('btn-update');
        btn.title = `새 버전(${res.version}) 설치`;
        btn.onclick = () => askUpdate(res);
        btn.classList.remove('hidden');
        document.getElementById('tour').classList.add('hidden');   // 가이드 투어보다 업데이트 질문을 먼저 보인다
        askUpdate(res);
    });
});

function askUpdate(res, startImmediately = false) {
    const m = document.getElementById('update-modal');
    if (m.dataset.busy === 'true') return;
    const confirm = document.getElementById('update-modal-ok');
    const close = document.getElementById('update-modal-close');
    const later = document.getElementById('update-modal-later');
    const message = document.getElementById('update-modal-message');
    const progress = document.getElementById('update-download-progress');
    document.getElementById('update-from').textContent = res.current;
    document.getElementById('update-to').textContent = res.version;
    confirm.disabled = later.disabled = close.disabled = false;
    confirm.textContent = '업데이트'; later.textContent = '나중에';
    message.textContent = '새 버전이 나왔습니다. 지금 업데이트하시겠습니까?';
    progress.classList.add('invisible');
    confirm.onclick = async () => {
        if (m.dataset.busy === 'true') return;
        m.dataset.busy = 'true';
        confirm.disabled = later.disabled = close.disabled = true;
        confirm.textContent = '준비 중…';
        message.textContent = '업데이트 파일을 다운로드하고 있습니다.\n설치가 시작되면 별도 창에서 진행 상황을 안내합니다.';
        progress.classList.remove('invisible');
        try {
            const result = await window.pywebview.api.install_update(res.version, appData);
            if (!result.success) throw new Error(result.error || '설치를 시작하지 못했습니다.');
            message.textContent = '설치를 시작했습니다.\n별도 안내 창에서 설치와 재실행 상태를 확인해 주세요.';
        } catch (error) {
            message.textContent = `업데이트를 시작하지 못했습니다.\n${error.message || error}`;
            progress.classList.add('invisible');
            m.dataset.busy = 'false';
            confirm.disabled = later.disabled = close.disabled = false;
            confirm.textContent = '다시 시도'; later.textContent = '닫기';
        }
    };
    m.classList.remove('hidden');
    m.focus();
    if (startImmediately) confirm.click();
}

let aboutUpdate = null;
window.runAboutUpdate = function() {
    if (document.getElementById('about-check').disabled) return;
    if (!aboutUpdate) return checkAboutUpdate();
    closeAboutModal();
    askUpdate(aboutUpdate, true);
};

window.closeAboutModal = function() {
    document.getElementById('about-modal').classList.add('hidden');
    document.getElementById('app-version').focus();
};

window.openAboutModal = async function() {
    const modal = document.getElementById('about-modal');
    modal.classList.remove('hidden');
    modal.querySelector('button').focus();
    document.getElementById('about-version').textContent = document.getElementById('app-version').textContent;
    checkAboutUpdate();
};

window.openPrivacyModal = function() {
    const modal = document.getElementById('privacy-modal');
    modal.classList.remove('hidden');
    modal.focus();
};

window.closePrivacyModal = function() {
    document.getElementById('privacy-modal').classList.add('hidden');
    document.getElementById('about-privacy').focus();
};

window.checkAboutUpdate = async function() {
    const button = document.getElementById('about-check');
    if (button.disabled) return;
    const status = document.getElementById('about-update-status');
    button.disabled = true;
    aboutUpdate = null;
    button.textContent = '확인 중…';
    status.textContent = '업데이트를 확인하고 있습니다…';
    try {
        if (!winApi()) throw new Error('프로그램 실행 환경에서 확인할 수 있습니다.');
        const version = await winApi().get_version();
        document.getElementById('about-version').textContent = `v${version}`;
        const res = await winApi().check_update();
        if (res.available) {
            status.textContent = `새 버전 ${res.version} · 업데이트 가능`;
            aboutUpdate = res;
        } else {
            status.textContent = {
                latest: '현재 최신 버전을 사용하고 있습니다.',
                development: '',
                unconfigured: '업데이트 저장소 미설정',
                error: '확인 실패 · 인터넷 연결을 확인하세요.',
            }[res.status] ?? '확인 실패 · 다시 시도해 주세요.';
        }
    } catch (error) {
        status.textContent = '확인 불가 · 프로그램에서 다시 확인하세요.';
    } finally {
        button.textContent = aboutUpdate ? '업데이트 받기' : '업데이트 확인';
        button.disabled = false;
    }
};
