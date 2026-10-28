; 설치 파일 만들기 (Inno Setup 6)
;   (src 폴더에서 실행)
;   1) pyinstaller 시험감독배정시스템.spec   → dist\시험감독배정시스템.exe
;   2) ISCC /DMyAppVersion=1.0.0 installer.iss → Output\ExamProctorSetup.exe
; 관리자 권한 없이 사용자 폴더에 설치한다. 그래야 자동 업데이트가 확인 창 없이 조용히 설치된다.

#ifndef MyAppVersion
  #define MyAppVersion "0.0.0"
#endif
#define MyAppName "시험감독 배정 프로그램"
#define MyAppExe "시험감독배정시스템.exe"

[Setup]
; AppId 는 바꾸면 안 된다. 바꾸면 업데이트가 아니라 다른 프로그램으로 따로 설치된다.
AppId={{6F1C2A9E-4B7D-4E21-9A3F-2D8C5E7B1A40}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
DefaultDirName={autopf}\시험감독배정
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
DisableDirPage=yes
PrivilegesRequired=lowest
OutputDir=Output
; main.py 의 SETUP_ASSET 과 같아야 한다.
OutputBaseFilename=ExamProctorSetup
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\{#MyAppExe}
Compression=lzma2
SolidCompression=yes
CloseApplications=yes
WizardStyle=modern

[Languages]
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"

[Files]
Source: "dist\{#MyAppExe}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExe}"
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExe}"

[Run]
; 처음 설치: 마지막 화면의 '실행' 체크. 자동 업데이트(조용한 설치): 끝나면 바로 다시 켠다.
Filename: "{app}\{#MyAppExe}"; Description: "프로그램 실행"; Flags: nowait postinstall skipifsilent
Filename: "{app}\{#MyAppExe}"; Flags: nowait skipifnotsilent
