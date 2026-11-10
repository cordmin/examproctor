"""Export a clean source copy next to the work folder, backing up the previous copy."""
import argparse
from datetime import datetime
from pathlib import Path
import re
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parent.parent
ROOT_FILES = {'LICENSE', '.gitignore', '개인정보처리방침.md', 'RELEASE_NOTES.md',
              'requirements.txt', 'requirements-build.txt', '프로그램 실행.bat'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--zip', type=Path)
    args = parser.parse_args()
    destination = args.output.resolve()
    # 재귀 정리 대상은 사용자가 지정한 이웃 공유소스 폴더로만 제한한다.
    if destination.parent != ROOT.parent or '공유소스' not in destination.name or destination.is_symlink():
        parser.error('작업 폴더 바로 옆의 공유소스 폴더만 지정할 수 있습니다.')
    archive = args.zip.resolve() if args.zip else None
    if archive and archive.is_relative_to(destination):
        parser.error('ZIP은 공유소스 폴더 바깥에 지정하세요.')
    version = re.search(r"^APP_VERSION = '([^']+)'", (ROOT / 'src/main.py').read_text(encoding='utf-8'), re.M)[1]
    commit = subprocess.check_output(['git', 'rev-parse', '--short', 'HEAD'], cwd=ROOT, text=True).strip()
    files = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode('utf-8').split('\0')
    if destination.exists():
        backup = ROOT / '.local/share-backups' / datetime.now().strftime('%Y%m%d-%H%M%S')
        shutil.copytree(destination, backup)
        print(f'Backup: {backup}')
        shutil.rmtree(destination)
    destination.mkdir(parents=True)
    for name in filter(None, files):
        relative = Path(name)
        if relative.parts[0] != 'src' and name not in ROOT_FILES:
            continue
        source, target = ROOT / relative, destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
    readme = f'''# 시험감독 배정 — 공유용 소스

버전 {version} · 기준 커밋 {commit}

## 실행

Windows와 Python 3.12 이상, Microsoft Edge WebView2가 필요합니다.

```powershell
python -m pip install -r requirements.txt
python src/main.py
```

설치 후 `프로그램 실행.bat`으로도 실행할 수 있습니다. 새 소스는 빈 자료로 시작하고 자동 저장·창 설정은 `.local/`에 생성됩니다. 설치판 자료는 `%APPDATA%/시험감독배정/`에 유지됩니다.

## 실행 파일·설치 파일 빌드

```powershell
python -m pip install -r requirements-build.txt
cd src
python -m PyInstaller 시험감독배정시스템.spec
ISCC /DMyAppVersion={version} installer.iss
```

Inno Setup 6이 필요합니다. 결과물은 `src/dist/시험감독배정시스템.exe`와 `src/Output/ExamProctorSetup.exe`입니다.

`src/`에는 실행·빌드에 필요한 소스, 라이브러리, 아이콘·글꼴만 포함했습니다. 개인 자료·자동 저장·예시 데이터·테스트·Git 기록은 포함하지 않았습니다. MIT 및 동봉된 구성 요소의 라이선스를 유지하세요.
'''
    (destination / 'README.md').write_text(readme, encoding='utf-8')
    if archive:
        archive.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as package:
            for source in sorted(destination.rglob('*')):
                if source.is_file():
                    package.write(source, source.relative_to(destination))
        print(f'ZIP: {archive}')
    print(f'Exported v{version} ({commit}): {destination}')


if __name__ == '__main__':
    main()
