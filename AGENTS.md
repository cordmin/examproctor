# 작업 전에 꼭 읽기 (Codex, Antigravity, Claude 등 모든 AI 도구 공통)

이 저장소(`cordmin/examproctor`)에는 **판이 두 개** 있고, 판마다 분기(branch)와 폴더가 따로 있다.

| 판 | 분기 | 로컬 폴더 | 배포 방법 |
|---|---|---|---|
| 설치판 (홈페이지 배포) | `main` | `시험감독배정 프로그램(작업소스)` | main 에 `src/**` 푸시 → `release.yml` 이 GitHub 릴리스 자동 배포, 설치된 프로그램이 스스로 업데이트 |
| 스토어판 (Microsoft Store) | `store` | `시험감독배정 프로그램(스토어버전)` | `scripts/build_store.ps1` 로 `.msix` 를 만들어 파트너 센터에 직접 올림 |

## 절대 하지 말 것

1. **`store` 를 `main` 에 합치지 않는다** (merge, rebase, cherry-pick, PR 모두 금지).
   - 스토어판은 자동 업데이트를 꺼 둔 판이다 (`UPDATE_REPO = ''`).
   - main 에 들어가면 자동 배포되고, 기존 설치판 사용자는 **앞으로 업데이트를 영영 못 받는다.** 되돌릴 방법이 없다.
   - 안전장치: main 의 `release.yml` 은 `UPDATE_REPO` 가 비어 있으면 배포를 멈춘다. 이 검사를 지우지 않는다.
2. **스토어버전 폴더에서 `main` 으로 푸시하지 않는다.** 이 폴더의 기본 푸시 대상은 `origin/store` 다.
3. 스토어판에서 `UPDATE_REPO` 를 다시 채우지 않는다 (스토어 정책 위반, 심사 탈락).

## 허용되는 방향: main → store

설치판에 생긴 기능·수정을 스토어판에 옮길 때만 합친다.

```
# 스토어버전 폴더에서
git fetch origin
git merge origin/main
```

합친 뒤 반드시 확인:
- `src/main.py` 의 `UPDATE_REPO = ''` 그대로인지
- `src/updates.js` 의 `unconfigured` 문구가 'Microsoft Store에서 자동으로 업데이트됩니다.' 인지
- `APP_VERSION` 이 스토어에 이미 올린 버전보다 높은지

## 스토어판에만 있는 것

- `src/main.py`: `UPDATE_REPO = ''` (자동 업데이트 끔)
- `src/updates.js`: 업데이트 확인 문구를 스토어 안내로 바꿈
- `src/msix/AppxManifest.xml`, `src/msix/Assets/*.png`: 스토어 포장 설명서와 아이콘
- `scripts/build_store.ps1`: exe 빌드 → `src/Output/시험감독배정_<버전>.msix` 생성 (서명 안 함, 스토어가 서명)

## 스토어 정보 (파트너 센터 '제품 ID' 화면 값, 비밀 아님)

- Package/Identity/Name: `LEEKYUNGMIN.3349950B60855`
- Package/Identity/Publisher: `CN=48242DEB-E6B5-4621-A918-3E598907EF0B`
- PublisherDisplayName: `LEE KYUNG MIN`
- Store ID: `9MVZN3HKWFGN`
- 앱 종류: MSIX 앱, 권한 runFullTrust (심사 때 사용 이유 제출함)

## 스토어 새 버전 내는 순서

1. 스토어버전 폴더에서 `git merge origin/main` (위 확인 사항 점검)
2. `powershell -ExecutionPolicy Bypass -File scripts\build_store.ps1`
3. 파트너 센터 → 시험감독배정 → 새 제출 → 패키지에 새 `.msix` 올리고 제출
4. `git push` (store 분기로 올라감)

## 기록

- 2026-11-20: 스토어판 처음 만듦 (v1.6.0), 파트너 센터에 제출해 인증 진행.
