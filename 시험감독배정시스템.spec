import os

# 프론트엔드 정적 파일. index.html 의 <script> 순서와 일치해야 한다.
FRONTEND = ['index.html', 'tailwind.min.js',
            'flatpickr.min.js', 'flatpickr.min.css', 'flatpickr-ko.js',
            'state.js', 'labels.js', 'ui.js',
            'tab-setup.js', 'tab-teachers.js', 'tab-result.js', 'tab-validate.js',
            'shell.js', 'icon.png', 'icon.ico']

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[(f, '.') for f in FRONTEND],
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
    icon=os.path.abspath('icon.ico'),
)

