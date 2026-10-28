"""시험감독 배정 프로그램 — 진입점과 JS 브리지.

이 파일은 창을 띄우고 프론트엔드(index.html)의 호출을 받는 역할만 한다.
실제 일은 도메인 모듈이 한다:

    labels.py     배정 라벨 해석, 규칙 판정
    scheduler.py  자동 배정 알고리즘
    validator.py  사후 검증, 통계 집계
    excel.py      엑셀 양식/명단/결과 파일

파일 대화상자만 여기서 처리하고 경로를 모듈에 넘긴다.
그래서 도메인 모듈은 webview 없이도 단독 실행·검증이 가능하다.
"""
import json
import os
import subprocess
import sys
import tempfile
import traceback
import urllib.request

import webview

import excel
from labels import check_label
from scheduler import run_algorithm
from validator import summarize

EMPTY_DATA = {
    "config": {"grades": [], "classes": {}, "special": {}, "separated": {}, "hallways": {},
               "subjects": [], "examDates": [], "rules": {}, "invigCounts": {}},
    "teachers": [], "periods": [], "classSubjects": {}, "assignments": {}, "validation": {},
}

XLSX_TYPES = ('Excel 파일 (*.xlsx)', '모든 파일 (*.*)')
JSON_TYPES = ('JSON 파일 (*.json)', '모든 파일 (*.*)')

# 릴리스 태그(vX.Y.Z)와 반드시 같아야 한다. 다르면 GitHub Actions 빌드가 멈춘다.
APP_VERSION = '1.0.0'
# 업데이트를 받을 GitHub 공개 저장소 'owner/repo'. 비어 있으면 업데이트 확인을 건너뛴다.
UPDATE_REPO = 'cordmin/examproctor'
# 릴리스에 올리는 설치 파일 이름. installer.iss 의 OutputBaseFilename 과 같아야 한다.
SETUP_ASSET = 'ExamProctorSetup.exe'


def version_tuple(v):
    return tuple(int(x) for x in v.lstrip('v').split('.'))


class Api:
    def __init__(self):
        # 설치판은 프로그램 폴더 대신 사용자 폴더에 자동 저장한다 (업데이트·재설치에도 유지).
        if getattr(sys, 'frozen', False):
            data_dir = os.path.join(os.environ.get('APPDATA', '.'), '시험감독배정')
            os.makedirs(data_dir, exist_ok=True)
            self.data_file = os.path.join(data_dir, 'timetable_data.json')
        else:
            self.data_file = 'timetable_data.json'
        self.data = self.load_data()
        self._win = None        # webview.create_window() 결과. 창 제어에 쓴다.
        self._maximized = True  # create_window(maximized=True) 로 연다

    # ── 프레임리스 창 제어 ────────────────────────────────────────────
    # frameless=True 라 OS 타이틀바가 없다. index.html 의 커스텀 타이틀바와
    # 가장자리 리사이즈 핸들이 아래 메서드들을 호출한다.

    def minimize_window(self):
        if self._win:
            self._win.minimize()

    def toggle_maximize(self):
        if not self._win:
            return
        if self._maximized:
            self._win.restore()
        else:
            self._win.maximize()
        self._maximized = not self._maximized

    def close_window(self):
        if self._win:
            self._win.destroy()

    def get_bounds(self):
        if not self._win:
            return {'x': 0, 'y': 0, 'w': 0, 'h': 0}
        return {'x': self._win.x, 'y': self._win.y,
                'w': self._win.width, 'h': self._win.height}

    def set_bounds(self, x, y, w, h):
        if not self._win:
            return
        safe_x = max(-50, int(x))
        safe_y = max(0, int(y))
        self._win.move(safe_x, safe_y)
        self._win.resize(int(w), int(h))
        # 직접 크기를 바꿨으면 최대화 상태가 아니다 (더블클릭 토글 동기화)
        self._maximized = False

    # ── 파일 대화상자 ────────────────────────────────────────────────

    def _ask_save(self, filename, file_types):
        return webview.windows[0].create_file_dialog(
            webview.SAVE_DIALOG, save_filename=filename, file_types=file_types)

    def _ask_open(self, file_types):
        return webview.windows[0].create_file_dialog(
            webview.OPEN_DIALOG, allow_multiple=False, file_types=file_types)

    # ── 데이터 저장 / 불러오기 ───────────────────────────────────────

    def load_data(self):
        if os.path.exists(self.data_file):
            with open(self.data_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return json.loads(json.dumps(EMPTY_DATA))   # 매 호출마다 새 사본

    def _write_json(self, path, data):
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def get_initial_data(self):
        return self.data

    def save_data_dialog(self, data, default_filename):
        result = self._ask_save(default_filename, JSON_TYPES)
        if not result:
            return {"success": False, "canceled": True}
        try:
            self.data = data
            # 사용자가 고른 경로와 자동 복구용 파일 양쪽에 쓴다.
            self._write_json(result[0], self.data)
            self._write_json(self.data_file, self.data)
            return {"success": True, "path": result[0]}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def load_data_dialog(self):
        result = self._ask_open(JSON_TYPES)
        if not result:
            return {"success": False, "canceled": True}
        try:
            with open(result[0], 'r', encoding='utf-8') as f:
                self.data = json.load(f)
            self._write_json(self.data_file, self.data)
            return {"success": True, "data": self.data}
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ── 엑셀 ─────────────────────────────────────────────────────────

    def download_template(self):
        result = self._ask_save('감독명단_일괄등록양식.xlsx', XLSX_TYPES)
        if not result:
            return {"success": False, "canceled": True}
        try:
            excel.write_template(result[0])
            return {"success": True, "path": result[0]}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def upload_excel(self):
        result = self._ask_open(XLSX_TYPES)
        if not result:
            return {"success": False, "canceled": True}
        try:
            return {"success": True, "teachers": excel.read_teachers(result[0])}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def export_excel(self, appData, default_filename='시험감독배정_최종결과.xlsx'):
        result = self._ask_save(default_filename, XLSX_TYPES)
        if not result:
            return {"success": False, "canceled": True}
        try:
            excel.write_result(appData, result[0])
            return {"success": True, "path": result[0]}
        except Exception as e:
            print(traceback.format_exc())
            return {"success": False, "error": str(e)}

    # ── 배정 / 검증 ──────────────────────────────────────────────────

    def run_algorithm(self, appData):
        self.data = appData
        res = run_algorithm(appData)
        if res.get('success') or res.get('validation'):
            self.data['validation'] = res['validation']
        return res

    def revalidate(self, appData):
        """수동 교체 후 통계와 검증을 다시 계산한다."""
        try:
            self.data = appData
            prev = appData.get('validation', {})
            self.data['validation'] = summarize(
                appData.get('teachers', []),
                appData.get('periods', []),
                appData.get('assignments', {}),
                appData.get('classSubjects', {}),
                appData.get('config', {}).get('rules', {}),
                prev.get('logs', []),
                shortage=prev.get('shortage', False),
            )
            return {"success": True, "validation": self.data['validation']}
        except Exception as e:
            print(traceback.format_exc())
            return {"success": False, "error": str(e)}

    def check_manual_assignment(self, appData, t_id, p_id, label):
        """배정 결과 화면에서 감독을 수동 교체할 때 호출된다.
        검증 탭의 사후 검사와 같은 check_label() 을 쓰므로 판정이 어긋나지 않는다."""
        try:
            if not label or label == '-':
                return {"valid": True}
            t = next((x for x in appData.get('teachers', []) if x['id'] == t_id), None)
            if not t:
                return {"valid": False, "reason": "교사를 찾을 수 없습니다."}
            problems = check_label(t, p_id, label,
                                   appData.get('classSubjects', {}),
                                   appData.get('config', {}).get('rules', {}))
            if problems:
                return {"valid": False, "reason": "\n".join(msg for _, msg in problems)}
            return {"valid": True}
        except Exception as e:
            print(traceback.format_exc())
            return {"valid": False, "reason": f"검사 중 오류: {e}"}

    # ── 자동 업데이트 ────────────────────────────────────────────────
    # releases/latest 는 최신 태그 페이지로 넘어간다. API 를 쓰지 않으므로
    # 학교처럼 여러 PC 가 한 IP 를 쓰는 곳에서도 호출 제한에 걸리지 않는다.

    def check_update(self):
        if not UPDATE_REPO or not getattr(sys, 'frozen', False):
            return {"available": False}
        try:
            with urllib.request.urlopen(f'https://github.com/{UPDATE_REPO}/releases/latest', timeout=5) as r:
                tag = r.geturl().rstrip('/').rsplit('/', 1)[-1]
            if version_tuple(tag) <= version_tuple(APP_VERSION):
                return {"available": False}
            return {"available": True, "version": tag}
        except Exception as e:   # 오프라인이거나 릴리스가 없으면 조용히 넘어간다
            print(f"업데이트 확인 실패: {e}")
            return {"available": False}

    def install_update(self, tag):
        """설치 파일을 받아 조용히 설치하도록 띄우고 창을 닫는다. 설치가 끝나면 설치 파일이 프로그램을 다시 켠다."""
        try:
            url = f'https://github.com/{UPDATE_REPO}/releases/download/{tag}/{SETUP_ASSET}'
            path = os.path.join(tempfile.gettempdir(), SETUP_ASSET)
            urllib.request.urlretrieve(url, path)
            subprocess.Popen([path, '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART'],
                             creationflags=subprocess.DETACHED_PROCESS)
            self.close_window()
            return {"success": True}
        except Exception as e:
            print(traceback.format_exc())
            return {"success": False, "error": str(e)}

    def get_resource_path(self, relative_path):
        base_path = getattr(sys, '_MEIPASS', os.path.abspath("."))
        return os.path.join(base_path, relative_path)


if __name__ == '__main__':
    api = Api()

    # 기준 크기 1280x800 의 0.8배. shell.js 의 MIN_W/MIN_H 와 맞춘다.
    # 1366x768 노트북, 1920x1080 @150% 배율에서도 창이 화면 안에 들어간다.
    min_w, min_h = 1024, 640
    # 복원(최대화 해제) 시 크기. 최대화 상태로 열리고, 화면 크기는 shell.js 가 맞춘다.
    win_w, win_h = 1280, 800
    win_x, win_y = None, None

    try:
        screens = webview.screens
        if screens and len(screens) > 0:
            primary_screen = screens[0]
            win_w, win_h = min(win_w, primary_screen.width), min(win_h, primary_screen.height)
            win_x = max(0, int((primary_screen.width - win_w) / 2))
            win_y = max(0, int((primary_screen.height - win_h) / 2))
    except Exception as e:
        print(f"화면 위치 계산 중 오류 (기본값 사용): {e}")

    # frameless: 타이틀바를 index.html 이 직접 그린다.
    # easy_drag=False: 창 전체가 아니라 .pywebview-drag-region 만 드래그 대상이 된다.
    #                  (True 면 표 위에서 드래그할 때 창이 따라 움직인다)
    api._win = webview.create_window(
        '시험감독 배정 프로그램',
        api.get_resource_path('index.html'),
        js_api=api,
        width=win_w, height=win_h,
        x=win_x, y=win_y,
        min_size=(min_w, min_h),
        maximized=True,
        frameless=True,
        easy_drag=False,
    )
    webview.start()
