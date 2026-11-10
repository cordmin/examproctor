"""방침 창의 링크는 앱 안이 아니라 기본 브라우저에서 열려야 한다 (실제 WebView2 창으로 확인)."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', '..', 'src'))
import time
from pathlib import Path

import webview
from webview.platforms import edgechromium

INDEX = str(Path(__file__).resolve().parents[2] / 'src' / 'index.html')
opened, result = [], {}
edgechromium.webbrowser.open = opened.append


def check(window):
    time.sleep(2)
    start = window.get_current_url()
    links = window.evaluate_js("document.querySelectorAll('.privacy-body a').length")
    blank = window.evaluate_js("document.querySelectorAll('.privacy-body a[target=\"_blank\"]').length")
    window.evaluate_js("document.querySelector('.privacy-body a').click()")
    time.sleep(1.5)
    result.update(start=start, end=window.get_current_url(), links=links, blank=blank)
    window.destroy()


window = webview.create_window('privacy link test', INDEX, hidden=True)
webview.start(check, window)
assert result['links'] >= 5 and result['links'] == result['blank'], result
assert result['start'] == result['end'], result
assert opened == ['https://www.kopico.go.kr/'], opened
print('PASS: privacy links open in the default browser and the app page stays')
