"""Exercise real WebView2 closing callbacks without blocking the Windows UI thread."""
import copy
import tempfile
import threading
import time
from pathlib import Path
from unittest.mock import patch
import webview
import main

if __name__ == '__main__':
    with tempfile.TemporaryDirectory() as folder:
        api = main.Api()
        api.data = copy.deepcopy(main.EMPTY_DATA)
        api.data_file = str(Path(folder) / 'data.json')
        api.settings_file = str(Path(folder) / 'settings.json')
        api.window_file = str(Path(folder) / 'window.json')
        Path(api.settings_file).write_text('{"hideTour":true}',encoding='utf-8')
        api._win = webview.create_window('Close regression',api.get_resource_path('index.html'),js_api=api,hidden=True)
        api._win.events.closing += api.on_closing
        failures=[]
        answers=[]
        def test():
            try:
                api._win.events.loaded.wait(15)
                for _ in range(100):
                    if api._win.evaluate_js('typeof savedSnapshot !== "undefined" && savedSnapshot !== null'): break
                    time.sleep(.1)
                else: raise AssertionError('Startup did not complete')
                api._win.evaluate_js("appData.config.examName = '변경'")
                answers.append(2)
                api.close_window()
                for _ in range(100):
                    if not api._close_pending: break
                    time.sleep(.1)
                assert not api._allow_close
                assert api._win.evaluate_js('1+1') == 2, 'UI remains responsive after cancel'
                answers.append(7)
                api.close_window()
                assert api._win.events.closed.wait(15), 'Discard should close the window'
                assert answers == []
            except Exception as e:
                failures.append(e)
                api._allow_close=True
                api.close_window()
        with patch.object(main.ctypes.windll.user32,'MessageBoxW',side_effect=lambda *args:answers.pop(0)):
            webview.start(test,gui='edgechromium')
        if failures: raise failures[0]
        print('PASS: real hidden WebView2 close/cancel/discard, responsive Windows UI, no deadlock')
