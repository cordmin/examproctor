"""개인정보처리방침 원문이 프로그램 화면과 설치 사용권 글에 빠짐없이 들어 있어야 한다."""
import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / 'src'
SOURCE = ROOT.parent / '개인정보처리방침.md'


def flat(text):
    return re.sub(r'\s+', '', html.unescape(re.sub(r'<[^>]+>', '', text)))


lines = [re.sub(r'^(#+|-|\d+\.)\s+', '', line).replace('`', '').replace('|', '')
         for line in SOURCE.read_text(encoding='utf-8').splitlines()[1:] if line.strip() and not line.startswith('|---')]
modal = (ROOT / 'index.html').read_text(encoding='utf-8').split('id="privacy-modal"')[1].split('id="update-modal"')[0]
license_text = (ROOT / 'license.txt').read_text(encoding='utf-8-sig')
page = (ROOT.parent / 'docs' / 'privacy' / 'index.html').read_text(encoding='utf-8').split('<body>')[1]
for line in lines:
    assert flat(line) in flat(page), line
    app_line = flat(re.sub(r'\s*—\s*체크리스트.*$', '', line))
    assert app_line in flat(modal) and app_line in flat(license_text), line
assert '체크리스트' not in modal and '체크리스트' not in license_text and '체크리스트' not in page
print('PASS: privacy policy matches source in app, installer license and public page')
