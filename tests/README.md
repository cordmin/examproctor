# 회귀 검사

`python scripts/test.py --unit`은 사용자 데이터와 분리된 임시 폴더에서 Python 검사를 실행합니다. `--ui`는 Playwright와 Edge로 화면을 검사합니다. 배포 시에는 단위 검사와 `desktop/test_update_installer.ps1`을 실행합니다.

- `unit/`: 배정 규칙, 입력 처리, 빈 상태·업데이트 보존, 자산 누락 검사
- `browser/`: 제외 입력, 드래그·자동 스크롤·교체, 표 정렬, 메뉴·검증 표시
- `desktop/`: 실제 WebView2 창이나 설치 프로그램이 필요한 검사
- `fixtures/`: 이전 데이터 정리와 재검증 호환성을 검사하는 가상 데이터 두 개

이전 시안 캡처와 중복되거나 현행 화면에 더 이상 없는 요소를 검사하던 파일은 제거했습니다. 회귀 검사는 Git으로 함께 관리합니다. 캡처는 `.local/test-artifacts/`나 OS 임시 폴더에 생성됩니다.
