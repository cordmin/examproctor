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
        def wait_for(script):
            for _ in range(150):
                if api._win.evaluate_js(script): return
                time.sleep(.1)
            raise AssertionError('Timed out: '+script)
        def test():
            try:
                api._win.events.loaded.wait(15)
                wait_for('typeof savedSnapshot !== "undefined" && savedSnapshot !== null')
                api._win.evaluate_js("appData.config.examName = '변경'")
                api.close_window()
                wait_for('!document.getElementById("close-modal").classList.contains("hidden")')
                api._win.evaluate_js('document.querySelector("#close-modal .modal-close").click()')
                for _ in range(100):
                    if not api._close_pending: break
                    time.sleep(.1)
                assert not api._allow_close and not api._close_pending
                assert api._win.evaluate_js('1+1') == 2
                api.close_window()
                wait_for('!document.getElementById("close-modal").classList.contains("hidden")')
                with patch.object(api, '_ask_save', return_value=None):
                    api._win.evaluate_js('document.getElementById("close-save").click()')
                    wait_for('document.getElementById("close-modal").dataset.busy === "false"')
                    assert not api._allow_close
                saved_path=str(Path(folder)/'saved.json')
                with patch.object(api, '_ask_save', return_value=[saved_path]):
                    api._win.evaluate_js('document.getElementById("close-save").click()')
                    assert api._win.events.closed.wait(15)
                import json
                assert json.loads(Path(saved_path).read_text(encoding='utf-8'))['config']['examName']=='변경'
            except Exception as e:
                failures.append(e)
                api._allow_close=True
                api.close_window()
        webview.start(test,gui='edgechromium')
        if failures: raise failures[0]
        print('PASS: real WebView2 themed close dialog, X cancels, canceled save keeps edits, saved data verified before exit, no deadlock')
