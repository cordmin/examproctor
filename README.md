# 시험감독 배정

Windows용 시험감독 자동 배정 프로그램입니다. 버전은 `src/main.py`의 `APP_VERSION`에서 지정합니다.

## 실행

Python 3.12 이상과 Microsoft Edge WebView2가 필요합니다.

```powershell
python -m pip install -r requirements.txt
python src/main.py
```

`프로그램 실행.bat`으로도 실행할 수 있습니다. 실행 위치와 관계없이 소스 실행의 자동 저장·창 설정은 `.local/`에 보관합니다. 설치판은 기존대로 `%APPDATA%/시험감독배정/`에 보관합니다.

## 폴더

| 경로 | 용도 |
|---|---|
| `src/` | 실행 소스, 화면 라이브러리, 아이콘·글꼴 |
| `tests/unit/` | 배정 규칙, 입출력, 업데이트, 자산 검사 |
| `tests/browser/` | Edge에서 조작·레이아웃을 검증하는 회귀 검사 |
| `tests/desktop/` | Windows 창·설치 파일 검사 |
| `tests/fixtures/` | 검사에만 쓰는 가상 데이터. 앱·공유소스에는 미포함 |
| `scripts/` | 검사 실행, 개인정보처리방침 생성, 공유소스 내보내기 |
| `docs/privacy/` | 공개 개인정보처리방침 페이지 |
| `.local/` | 개인 자료·이전 파일 백업·테스트 도구. Git·공유 대상 제외 |

화면 모듈은 기본 설정(`tab-setup.js`), 감독 명단(`tab-teachers.js`), 배정 제외(`tab-absences.js`), 결과 표(`tab-result.js`), 드래그·교체(`result-interactions.js`), 검증(`tab-validate.js`)으로 나뉩니다. `state.js`는 공통 상태, `ui.js`와 `shell.js`는 공통 UI·창을 담당합니다. 스크립트 순서는 `index.html`에서 관리하고 자산 검사가 빌드 누락을 방지합니다.

## 검사

```powershell
python scripts/test.py --unit
npm install --prefix .local/test-tools playwright@1.65.0 pngjs@7.0.0
python scripts/test.py --ui
```

브라우저 검사는 Node.js와 Microsoft Edge가 필요합니다. 실제 Windows 창 검사는 `tests/desktop/`에서 별도로 실행합니다. `scripts/build_privacy.py`는 개인정보처리방침 원문을 앱·설치 사용권·공개 페이지에 반영합니다.

## 빌드와 배포

```powershell
python -m pip install -r requirements-build.txt
cd src
python -m PyInstaller 시험감독배정시스템.spec
ISCC /DMyAppVersion=1.4.0 installer.iss
```

Inno Setup 6이 필요합니다. 실행 파일은 `src/dist/`, 설치 파일은 `src/Output/`에 생성됩니다.

버전과 `RELEASE_NOTES.md`를 갱신하고 `main`에 푸시하면 GitHub Actions가 검사·빌드·릴리즈를 수행합니다. 기존 태그를 덮어쓰지 않고 새 버전으로 배포합니다.

공유소스는 커밋 후 `python scripts/export_source.py --output "공유소스 폴더의 전체 경로"`로 내보냅니다. 실행에 필요한 추적 파일만 복사하고, 기존 폴더는 `.local/share-backups/`에 먼저 백업합니다.
