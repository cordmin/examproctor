"""개인정보처리방침 원문이 프로그램 화면과 설치 사용권 글에 빠짐없이 들어 있어야 한다."""
import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parent / '개인정보처리방침.md'


def flat(text):
    return re.sub(r'\s+', '', html.unescape(re.sub(r'<[^>]+>', '', text)))


lines = [re.sub(r'^(#+|-)\s+', '', line).replace('`', '')
         for line in SOURCE.read_text(encoding='utf-8').splitlines()[1:] if line.strip()]
modal = (ROOT / 'index.html').read_text(encoding='utf-8').split('id="privacy-modal"')[1].split('id="update-modal"')[0]
license_text = (ROOT / 'license.txt').read_text(encoding='utf-8-sig')
for target in (flat(modal), flat(license_text)):
    for line in lines:
        assert flat(line) in target, line
print('PASS: privacy policy matches source in app and installer license')
