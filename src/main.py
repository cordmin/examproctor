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
import ctypes
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

# 앞 두 자리(1.0)만 손으로 고친다. 마지막 자리는 GitHub Actions(release.yml)가 빌드할 때 실행 번호로 채운다.
APP_VERSION = '1.0.0'
# 업데이트를 받을 GitHub 공개 저장소 'owner/repo'. 비어 있으면 업데이트 확인을 건너뛴다 (켤 때 최신 릴리스와 비교).
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
        # 마지막 창 위치·크기. 자동 저장 파일과 같은 폴더에 둔다.
        self.window_file = os.path.join(os.path.dirname(os.path.abspath(self.data_file)), 'window.json')
        # 화면 설정(가이드 투어 다시 보지 않기 등). 웹뷰 저장소는 창을 닫으면 지워지므로 파일에 둔다.
        self.settings_file = os.path.join(os.path.dirname(os.path.abspath(self.data_file)), 'settings.json')
        self._win = None        # webview.create_window() 결과. 창 제어에 쓴다.
        self._maximized = False
        self._normal_bounds = None   # 최대화 직전 위치·크기. 복원할 때 쓴다.

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
            self._apply_bounds(*self._normal_bounds)
            self._maximized = False
        else:
            self._normal_bounds = (self._win.x, self._win.y, self._win.width, self._win.height)
            self._apply_bounds(*self._work_area())
            self._maximized = True

    # 테두리 없는 창은 OS 최대화(WindowState)를 쓰면 창이 화면 모서리에서 밀려 열리고
    # 작업 표시줄까지 덮는다. 그래서 작업 영역(작업 표시줄 뺀 화면) 크기로 직접 맞춘다.
    def _work_area(self):
        class MONITORINFO(ctypes.Structure):
            _fields_ = [('cbSize', ctypes.c_ulong), ('rcMonitor', ctypes.c_long * 4),
                        ('rcWork', ctypes.c_long * 4), ('dwFlags', ctypes.c_ulong)]
        user32 = ctypes.windll.user32
        hwnd = self._win.native.Handle.ToInt32()
        mi = MONITORINFO(cbSize=ctypes.sizeof(MONITORINFO))
        user32.GetMonitorInfoW(user32.MonitorFromWindow(hwnd, 2), ctypes.byref(mi))
        scale = user32.GetDpiForWindow(hwnd) / 96   # 물리 픽셀 -> pywebview 논리 픽셀
        left, top, right, bottom = mi.rcWork
        return left / scale, top / scale, (right - left) / scale, (bottom - top) / scale

    def _apply_bounds(self, x, y, w, h):
        self._win.move(int(x), int(y))
        self._win.resize(int(w), int(h))

    def close_window(self):
        if self._win:
            self.save_window_state()
            self._win.destroy()

    def load_window_state(self):
        try:
            with open(self.window_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (OSError, ValueError):
            return None

    def save_window_state(self):
        try:
            x, y, w, h = self._normal_bounds if self._maximized else                 (self._win.x, self._win.y, self._win.width, self._win.height)
            if x < -10000:   # 최소화된 채로 닫으면 좌표가 -32000 이 된다
                return
            self._write_json(self.window_file, {'x': x, 'y': y, 'w': w, 'h': h, 'maximized': self._maximized})
        except Exception as e:
            print(f"창 크기 저장 실패: {e}")

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
        # 저장된 작업이 없으면(처음 설치) 무엇을 어떻게 넣는지 보이도록 예시 값으로 시작한다.
        for path in (self.data_file, self.get_resource_path('sample_data.json')):
            if os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f:
                    return json.load(f)
        return json.loads(json.dumps(EMPTY_DATA))   # 매 호출마다 새 사본

    def _write_json(self, path, data):
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def get_initial_data(self):
        return self.data

    def get_settings(self):
        try:
            with open(self.settings_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (OSError, ValueError):
            return {}

    def set_setting(self, key, value):
        settings = self.get_settings()
        settings[key] = value
        try:
            self._write_json(self.settings_file, settings)
            return {"success": True}
        except OSError as e:
            print(f"설정 저장 실패: {e}")
            return {"success": False, "error": str(e)}

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

    def download_template(self, teachers=None):
        result = self._ask_save('감독명단_일괄등록양식.xlsx', XLSX_TYPES)
        if not result:
            return {"success": False, "canceled": True}
        try:
            excel.write_template(result[0], teachers)
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

    def get_version(self):
        return APP_VERSION

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
        base_path = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
        return os.path.join(base_path, relative_path)


if __name__ == '__main__':
    api = Api()

    # 기준 크기 1280x800 의 0.8배. shell.js 의 MIN_W/MIN_H 와 맞춘다.
    # 1366x768 노트북, 1920x1080 @150% 배율에서도 창이 화면 안에 들어간다.
    min_w, min_h = 1024, 640
    # 처음 켤 때 크기. 이후로는 마지막에 쓰던 위치·크기(window.json)로 연다.
    # 화면 안 요소 크기는 shell.js 가 창 크기에 맞춘다.
    win_w, win_h = 1280, 800
    win_x, win_y = None, None
    saved = api.load_window_state()

    try:
        screens = webview.screens
        # 저장된 위치가 지금 연결된 모니터 안에 있을 때만 쓴다 (모니터를 뺐을 수도 있다)
        if saved and any(sc.x <= saved['x'] + 50 < sc.x + sc.width and sc.y <= saved['y'] + 50 < sc.y + sc.height
                         for sc in screens):
            win_x, win_y, win_w, win_h = int(saved['x']), int(saved['y']), int(saved['w']), int(saved['h'])
        elif screens:
            primary_screen = screens[0]
            win_w, win_h = min(win_w, primary_screen.width), min(win_h, primary_screen.height)
            win_x = max(0, int((primary_screen.width - win_w) / 2))
            win_y = max(0, int((primary_screen.height - win_h) / 2))
            saved = None
    except Exception as e:
        print(f"화면 위치 계산 중 오류 (기본값 사용): {e}")
        saved = None

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
        frameless=True,
        easy_drag=False,
    )
    api._win.events.closing += api.save_window_state   # Alt+F4, 작업 표시줄에서 닫기

    # create_window 의 크기는 테두리를 없애면서 조금 줄어든다. 그대로 두면 켤 때마다
    # 창이 작아지므로, 창이 뜬 뒤 저장된 크기를 다시 정확히 맞춘다.
    def restore_window():
        if not saved:
            return
        api._win.events.shown.wait()
        api._apply_bounds(win_x, win_y, win_w, win_h)
        if saved.get('maximized'):
            api.toggle_maximize()

    webview.start(restore_window)
