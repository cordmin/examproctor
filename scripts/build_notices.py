"""프로그램에 함께 들어가는 외부 부품의 저작권 표시와 라이선스 전문을 모은다.

설치된 패키지 정보를 읽으므로 빌드하는 환경에서 실행한다 (release.yml 이 빌드 직전에 실행).
결과: src/THIRD-PARTY-NOTICES.txt (설치 폴더에 들어감), src/index.html 라이선스 창 목록.
라이선스 글을 찾지 못한 부품이 있으면 멈춘다. 새 부품이 생기면 FALLBACK 이나 STATIC 에 글을 채운다.
"""
import html
import re
import sys
from importlib.metadata import distribution
from pathlib import Path

from packaging.requirements import Requirement

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'src'
LICENSE_FILE = re.compile(r'LICEN[CS]E|COPYING|NOTICE|AUTHORS', re.I)
BUILD_TOOLS = ['pyinstaller', 'pyinstaller-hooks-contrib']  # 실행 파일에 부트로더·런타임 훅이 들어간다


def mit(holder):
    return f'''MIT License

Copyright (c) {holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.'''


# 패키지 안에 라이선스 파일이 없어 원본 저장소에서 옮겨 온 글.
FALLBACK = {
    # https://github.com/pythonnet/clr-loader/blob/master/LICENSE
    'clr_loader': mit('2019-2026 Benedikt Reinartz'),
    # https://github.com/jtushman/proxy_tools/blob/master/LICENSE.txt (원문 그대로. PyPI 에는 MIT 로 표시됨)
    'proxy_tools': '''The BSD License (BSD)

Copyright (c) 2013 Armin Ronacher
Copyright (c) 2014 Jonathan Tushman

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright
    notice, this list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright
    notice, this list of conditions and the following disclaimer in the
    documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.''',
}

# 패키지 관리자로 설치하지 않고 src 에 직접 넣은 부품. 버전을 올리면 여기도 고친다.
STATIC = [
    ('Microsoft WebView2 SDK (pywebview에 포함)', '', 'BSD-3-Clause', '''Copyright (C) Microsoft Corporation. All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

   * Redistributions of source code must retain the above copyright
notice, this list of conditions and the following disclaimer.
   * Redistributions in binary form must reproduce the above
copyright notice, this list of conditions and the following disclaimer
in the documentation and/or other materials provided with the
distribution.
   * The name of Microsoft Corporation, or the names of its contributors
may not be used to endorse or promote products derived from this
software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.'''),
    ('Tailwind CSS', '3.4.17', 'MIT', mit('Tailwind Labs, Inc.')),
    ('flatpickr', '4.6.13', 'MIT', mit('2017 Gregory Petrosyan')),
    ('Lucide 아이콘', '', 'ISC', '''ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

---

Some Lucide icons (for example x, minus, square, upload, search) are derived
from the Feather project:

The MIT License (MIT) (for the icons derived from Feather)

''' + mit('2013-present Cole Bemis').split('\n', 2)[2]),
    ('Noto Serif KR 글꼴 (Motto Serif KR 이름으로 줄인 것)', '', 'OFL-1.1',
     (SRC / 'motto-serif-LICENSE.txt').read_text(encoding='utf-8-sig').strip()),
    ('Inno Setup (설치 프로그램)', '', 'Inno Setup License', '''Inno Setup License
==================

Except where otherwise noted, all of the documentation and software included in the Inno
Setup package is copyrighted by Jordan Russell.

Copyright (C) 1997-2026 Jordan Russell. All rights reserved.
Portions Copyright (C) 2000-2026 Martijn Laan. All rights reserved.

This software is provided "as-is," without any express or implied warranty. In no event shall
the author be held liable for any damages arising from the use of this software.

Permission is granted to anyone to use this software for any purpose, including commercial
applications, and to alter and redistribute it, provided that the following conditions are met:

1. All redistributions of source code files must retain all copyright notices that are currently
   in place, and this list of conditions without modification.

2. All redistributions in binary form must retain all occurrences of the above copyright notice
   and web site addresses that are currently in place (for example, in the About boxes).

3. The origin of this software must not be misrepresented; you must not claim that you wrote
   the original software. If you use this software to distribute a product, an acknowledgment
   in the product documentation would be appreciated but is not required.

4. Modified versions in source or binary form must be plainly marked as such, and must not
   be misrepresented as being the original software.


Jordan Russell
jr-2020 AT jrsoftware.org
https://jrsoftware.org/'''),
]


def package(name):
    dist = distribution(name)
    meta = dist.metadata
    key = re.sub(r'[-_.]+', '_', meta['Name'].lower())
    files = [f for f in dist.files or [] if '.dist-info' in str(f) and LICENSE_FILE.search(f.name)]
    texts = [f.read_text(encoding='utf-8').strip() for f in files]
    if not texts and key not in FALLBACK:
        sys.exit(f'라이선스 글을 찾지 못함: {meta["Name"]} {dist.version} → build_notices.py FALLBACK 에 원문을 넣으세요.')
    classifiers = [c.split(' :: ')[-1] for c in meta.get_all('Classifier') or [] if c.startswith('License ::')]
    kind = meta.get('License-Expression') or ((meta.get('License') or '').strip().splitlines() or [' / '.join(classifiers)])[0]
    if ' with ' in kind and len(kind) > 40:
        kind = kind.split(' with ')[0] + ' (예외 조항 포함)'
    return meta['Name'], dist.version, kind, '\n\n'.join(texts) or FALLBACK[key]


def runtime_packages():
    """requirements.txt 의 패키지와 그 하위 의존 패키지 (실행 파일에 들어가는 것)."""
    names, queue = [], [line for line in (ROOT / 'requirements.txt').read_text(encoding='utf-8').splitlines() if line.strip()]
    while queue:
        req = Requirement(queue.pop(0))
        if req.marker and not req.marker.evaluate({'extra': ''}) or req.name.lower() in names:
            continue
        names.append(req.name.lower())
        queue += distribution(req.name).requires or []
    return names


def main():
    python_license = Path(sys.base_prefix) / 'LICENSE.txt'
    if not python_license.is_file():
        sys.exit(f'Python 라이선스 파일이 없음: {python_license}')
    python = ('Python', '.'.join(map(str, sys.version_info[:3])), 'PSF-2.0 (함께 든 OpenSSL 등의 라이선스는 아래 글에 포함)',
              python_license.read_text(encoding='utf-8').strip())
    bundled = [python] + [package(n) for n in runtime_packages()] + STATIC[:4]
    fonts_tools = STATIC[4:] + [package(n) for n in BUILD_TOOLS]
    entries = bundled + fonts_tools

    head = ['시험감독 배정 프로그램 — 외부 구성 요소 저작권 및 라이선스 고지', '',
            '이 프로그램에는 아래 외부 구성 요소가 함께 들어 있습니다. 각 구성 요소의 저작권은 해당 권리자에게 있으며,',
            '각 구성 요소에는 아래에 적힌 라이선스가 적용됩니다. 이 파일은 scripts/build_notices.py 로 만듭니다.', '']
    head += [f'- {n} {v}'.rstrip() + f' · {k}' for n, v, k, _ in entries]
    body = [f'{"=" * 72}\n' + f'{n} {v}'.rstrip() + f'\n라이선스: {k}\n{"=" * 72}\n\n{t}\n' for n, v, k, t in entries]
    (SRC / 'THIRD-PARTY-NOTICES.txt').write_text('\n'.join(head) + '\n\n' + '\n'.join(body),
                                                 encoding='utf-8-sig', newline='\r\n')

    path = SRC / 'index.html'
    text = path.read_bytes().decode('utf-8')
    nl = '\r\n' if '\r\n' in text else '\n'
    item = lambda n, v, k: f'<li><b>{html.escape(n)}</b> {html.escape(v)}'.rstrip() + f' · {html.escape(k.split(" (함께")[0])}</li>'
    modal = ['<p>시험감독 배정 · © 2026 이경민 · MIT 라이선스 (<a target="_blank" rel="noopener" href="https://github.com/cordmin/examproctor/blob/main/LICENSE">전문</a>)</p>',
             '<p>이 프로그램에 함께 들어 있는 외부 소프트웨어·글꼴의 저작권은 각 권리자에게 있으며, 각 구성 요소의 라이선스가 적용됩니다. 저작권 표시와 라이선스 전문은 설치 폴더의 <code>THIRD-PARTY-NOTICES.txt</code>에 있습니다.</p>',
             '<h4>프로그램에 들어 있는 구성 요소</h4>', '<ul>', *[item(n, v, k) for n, v, k, _ in bundled], '</ul>',
             '<h4>글꼴과 만드는 도구</h4>', '<ul>', *[item(n, v, k) for n, v, k, _ in fonts_tools], '</ul>']
    match = re.search(r'(<div class="license-body[^>]*>\r?\n).*?(\r?\n {12}</div>)', text, re.S)
    if not match:
        sys.exit('index.html 에서 라이선스 창(license-body)을 찾지 못함')
    body = nl.join(' ' * 16 + line for line in modal)
    path.write_bytes((text[:match.start()] + match.group(1) + body + match.group(2) + text[match.end():]).encode('utf-8'))
    print(f'ok: {len(entries)} components')


if __name__ == '__main__':
    main()
