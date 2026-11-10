"""개인정보처리방침.md 를 앱 창(src/index.html), 사용권 글(src/license.txt), 공개 페이지(docs/privacy)로 옮긴다.

방침을 고치면 프로젝트 폴더에서 python scripts/build_privacy.py 를 실행한 뒤 test_privacy_policy.py 로 확인한다.
"""
import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LF, CRLF = chr(10), chr(13) + chr(10)
URL = re.compile(r'(https://[A-Za-z0-9./_-]*[A-Za-z0-9/_-])')


def inline(text):
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', html.escape(text, quote=False))
    return URL.sub(r'<a href="\1">\1</a>', text)


def cells(line):
    return [cell.strip() for cell in line.strip().strip('|').split('|')]


def to_html(lines, h2, h3, wide_tables):
    out, open_tag, first_row = [], None, False
    table_open = '<div class="table"><table>' if wide_tables else '<table>'
    table_close = '</table></div>' if wide_tables else '</table>'

    def close():
        nonlocal open_tag
        if open_tag:
            out.append({'ul': '</ul>', 'ol': '</ol>', 'table': table_close}[open_tag])
            open_tag = None

    def ensure(tag):
        nonlocal open_tag
        if open_tag != tag:
            close()
            out.append({'ul': '<ul>', 'ol': '<ol>', 'table': table_open}[tag])
            open_tag = tag

    for line in lines:
        if not line.strip():
            if open_tag != 'ol':
                close()
            continue
        if line.startswith('|---'):
            continue
        number = re.match(r'(\d+)\.\s+(.*)', line)
        if line.startswith('|'):
            first_row = open_tag != 'table'
            ensure('table')
            tag = 'th' if first_row else 'td'
            out.append('<tr>' + ''.join(f'<{tag}>{inline(cell)}</{tag}>' for cell in cells(line)) + '</tr>')
        elif number:
            start = f' start="{number.group(1)}"' if open_tag != 'ol' and number.group(1) != '1' else ''
            if open_tag != 'ol':
                close()
                out.append(f'<ol{start}>')
                open_tag = 'ol'
            out.append('<li>' + inline(number.group(2)) + '</li>')
        elif line.startswith('- '):
            ensure('ul')
            out.append('<li>' + inline(line[2:]) + '</li>')
        elif line.startswith('## '):
            close()
            out.append(f'<{h2}>' + inline(line[3:]) + f'</{h2}>')
        elif line.startswith('### '):
            close()
            out.append(f'<{h3}>' + inline(line[4:]) + f'</{h3}>')
        elif line.startswith('근거: '):
            close()
            out.append('<p class="basis">' + inline(line) + '</p>')
        else:
            close()
            out.append('<p>' + inline(line) + '</p>')
    close()
    return out


def to_plain(lines):
    plain = []
    for line in lines:
        if not line.strip() or line.startswith('|---'):
            continue
        if line.startswith('|'):
            plain.append('  '.join(cell.replace('`', '') for cell in cells(line)))
        elif line.startswith('## ') or line.startswith('### '):
            plain += ['', re.sub(r'^#+\s+', '', line)]
        else:
            plain.append(line.replace('`', ''))
    return plain


PAGE = '''<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<style>
  :root {{ color-scheme: light; --text:#26221C; --muted:#6B655B; --gold:#C2982D; --cream:#FAF5EA; --line:#D8D2C4; --head:#F2EDE1; }}
  body {{ margin:0; background:#fff; color:var(--text); font:15.5px/1.8 "Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif; word-break:keep-all; overflow-wrap:break-word; }}
  main {{ max-width:780px; margin:0 auto; padding:56px 24px 80px; }}
  h1 {{ margin:0 0 20px; padding-bottom:12px; border-bottom:3px solid var(--gold); font-size:27px; line-height:1.4; }}
  h2 {{ margin:44px 0 14px; padding:9px 14px; border-left:5px solid var(--gold); background:var(--cream); font-size:18px; line-height:1.45; }}
  h2 + p, h2 + ol {{ margin-top:0; }}
  h3 {{ margin:22px 0 8px; font-size:16px; }}
  p, ul, ol {{ margin:0 0 12px; }}
  ul, ol {{ padding-left:22px; }}
  li {{ margin-bottom:4px; }}
  code {{ font:inherit; font-weight:700; }}
  a {{ color:#7A5C10; }}
  .basis {{ margin-top:14px; color:var(--muted); font-size:13.5px; }}
  .table {{ overflow-x:auto; margin:0 0 14px; }}
  table {{ width:100%; min-width:520px; border-collapse:collapse; font-size:14px; line-height:1.6; }}
  th, td {{ padding:9px 12px; border:1px solid var(--line); text-align:left; vertical-align:top; }}
  th {{ background:var(--head); font-weight:700; }}
  @page {{ size:A4; margin:17mm 16mm; }}
  @media print {{ main {{ max-width:none; padding:0; }} h2 {{ break-after:avoid; margin-top:26px; }} tr, li, table {{ break-inside:avoid; }} .table {{ overflow:visible; }} table {{ min-width:0; }} }}
  @media (max-width:520px) {{ main {{ padding:36px 16px 56px; }} h1 {{ font-size:23px; }} h2 {{ font-size:16.5px; }} }}
</style>
</head>
<body>
  <main>
    <h1>{title}</h1>
{body}
  </main>
</body>
</html>
'''


def main():
    source = (ROOT / '개인정보처리방침.md').read_text(encoding='utf-8').splitlines()
    title, lines = source[0][2:], source[1:]
    # 체크리스트 번호는 심의용 공개 페이지에만 둔다.
    app_lines = [re.sub(r'\s*—\s*체크리스트.*$', '', line) if line.startswith('## ') else line for line in lines]

    path = ROOT / 'src' / 'index.html'
    text = path.read_bytes().decode('utf-8')
    nl = CRLF if CRLF in text else LF
    # 앱 창 안에서 페이지가 바뀌지 않도록 새 창 요청으로 보내 기본 브라우저에서 연다.
    modal = [line.replace('<a href=', '<a target="_blank" rel="noopener" href=') for line in to_html(app_lines, 'h4', 'h5', False)]
    body = nl.join(' ' * 16 + line for line in modal)
    match = re.search(r'(<div class="privacy-body[^>]*>\r?\n).*?(\r?\n {12}</div>)', text, re.S)
    path.write_bytes((text[:match.start()] + match.group(1) + body + match.group(2) + text[match.end():]).encode('utf-8'))

    path = ROOT / 'src' / 'license.txt'
    text = path.read_bytes().decode('utf-8')
    nl = CRLF if CRLF in text else LF
    start = text.rfind(nl + '─' * 30)
    plain = [title, ''] + to_plain(app_lines)
    path.write_bytes((text[:start + len(nl)] + '─' * 30 + nl * 2 + nl.join(plain) + nl).encode('utf-8'))

    body = LF.join(' ' * 4 + line for line in to_html(lines, 'h2', 'h3', True))
    (ROOT / 'docs' / 'privacy' / 'index.html').write_text(PAGE.format(title=title, body=body), encoding='utf-8', newline='')
    print('ok')


if __name__ == '__main__':
    main()
