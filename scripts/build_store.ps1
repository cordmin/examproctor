# Microsoft Store 에 올릴 .msix 를 만든다. 서명은 하지 않는다 (스토어가 대신 서명).
#   powershell -ExecutionPolicy Bypass -File scripts\build_store.ps1
# 결과: src\Output\시험감독배정_<버전>.msix
$ErrorActionPreference = 'Stop'
$src = Join-Path $PSScriptRoot '..\src' | Resolve-Path
Set-Location $src

$m = Select-String -Path main.py -Pattern "^APP_VERSION = '(\d+\.\d+\.\d+)'$"
if (-not $m) { throw 'main.py 에서 APP_VERSION 을 찾지 못했습니다.' }
$ver = $m.Matches[0].Groups[1].Value

python ..\scripts\build_notices.py
if ($LASTEXITCODE) { throw '라이선스 고지 파일을 만들지 못했습니다.' }
pyinstaller --noconfirm 시험감독배정시스템.spec
if ($LASTEXITCODE) { throw 'exe 를 만들지 못했습니다.' }

# 포장할 파일을 한 폴더에 모은다.
$layout = 'build\msix'
Remove-Item $layout -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory $layout | Out-Null
Copy-Item 'dist\시험감독배정시스템.exe', license.txt, motto-serif-LICENSE.txt, THIRD-PARTY-NOTICES.txt $layout
# 설치판과 같은 예시 파일(이름은 모두 가짜). 열기·시간표 불러오기 창이 프로그램 폴더에서 열린다.
Copy-Item '시험감독_배정결과(예시).json', '압핀_주간시간표(예시).xlsx', '컴시간_주간시간표(예시).xlsx' $layout
Copy-Item msix\Assets $layout -Recurse
(Get-Content msix\AppxManifest.xml -Raw -Encoding UTF8) -replace 'Version="0\.0\.0\.0"', "Version=`"$ver.0`"" |
    Set-Content "$layout\AppxManifest.xml" -Encoding UTF8

# Windows SDK 의 가장 최신 makeappx 를 쓴다.
$makeappx = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\makeappx.exe" |
    Sort-Object FullName | Select-Object -Last 1
if (-not $makeappx) { throw 'makeappx.exe 가 없습니다. Windows SDK 를 설치해 주세요.' }
New-Item -ItemType Directory Output -Force | Out-Null
& $makeappx.FullName pack /d $layout /p "Output\시험감독배정_$ver.msix" /o
if ($LASTEXITCODE) { throw '.msix 를 만들지 못했습니다.' }
Write-Host "완료: src\Output\시험감독배정_$ver.msix"
