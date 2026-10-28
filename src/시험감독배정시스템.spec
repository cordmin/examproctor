import os

# 경로는 모두 이 spec 파일(src 폴더) 기준이다. 결과물은 실행한 위치의 dist\ 에 생긴다.

# 프론트엔드 정적 파일. index.html 의 <script> 순서와 일치해야 한다.
FRONTEND = ['index.html', 'tailwind.min.js',
            'flatpickr.min.js', 'flatpickr.min.css', 'flatpickr-ko.js',
            'state.js', 'labels.js', 'ui.js',
            'tab-setup.js', 'tab-teachers.js', 'tab-result.js', 'tab-validate.js',
            'shell.js', 'icon.ico', 'icon.png', 'motto-serif.woff2', 'motto-serif-LICENSE.txt',
            'sample_data.json']   # 처음 켤 때 보여 줄 예시 값 (main.py load_data)

a = Analysis(
    [os.path.join(SPECPATH, 'main.py')],
    pathex=[SPECPATH],
    binaries=[],
    datas=[(os.path.join(SPECPATH, f), '.') for f in FRONTEND],
    hiddenimports=['labels', 'scheduler', 'validator', 'excel'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['numpy', 'PIL', 'Pillow', 'lxml', 'cryptography', 'matplotlib', 'tkinter', 'unittest', 'scipy', 'pandas'],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='시험감독배정시스템',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=os.path.join(SPECPATH, 'icon.ico'),
)

