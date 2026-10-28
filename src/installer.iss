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
CloseApplications=force
RestartApplications=no
SetupLogging=yes
WizardStyle=modern

[Languages]
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"

[Files]
Source: "update-progress.ps1"; Flags: dontcopy
Source: "dist\{#MyAppExe}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExe}"
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExe}"

[Run]
; 처음 설치: 마지막 화면의 '실행' 체크. 자동 업데이트(조용한 설치): 끝나면 바로 다시 켠다.
Filename: "{app}\{#MyAppExe}"; WorkingDir: "{app}"; BeforeInstall: PrepareAppRestart; Description: "프로그램 실행"; Flags: nowait postinstall skipifsilent
Filename: "{app}\{#MyAppExe}"; WorkingDir: "{app}"; BeforeInstall: PrepareAppRestart; Flags: nowait skipifnotsilent

[Code]
function SetEnvironmentVariable(lpName, lpValue: string): Boolean;
  external 'SetEnvironmentVariableW@kernel32.dll stdcall';

procedure PrepareAppRestart;
begin
  // 이전 버전에서 실행한 설치 파일도 새 인스턴스로 프로그램을 다시 켠다.
  SetEnvironmentVariable('PYINSTALLER_RESET_ENVIRONMENT', '1');
end;

function GetCurrentProcessId: LongWord;
  external 'GetCurrentProcessId@kernel32.dll stdcall';

procedure InitializeWizard;
var
  ResultCode: Integer;
  Parameters, PowerShellPath: string;
begin
  if not WizardSilent then Exit;
  // 기존 버전의 조용한 업데이트에서도 별도 진행 창은 표시한다.
  try
    ExtractTemporaryFile('update-progress.ps1');
    Parameters := '-NoProfile -NonInteractive -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File ' +
      AddQuotes(ExpandConstant('{tmp}\update-progress.ps1')) +
      ' -InstallerPid ' + IntToStr(GetCurrentProcessId) +
      ' -AppPath ' + AddQuotes(ExpandConstant('{app}\{#MyAppExe}'));
    if IsWin64 then
      PowerShellPath := ExpandConstant('{sysnative}\WindowsPowerShell\v1.0\powershell.exe')
    else
      PowerShellPath := ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe');
    if not Exec(PowerShellPath, Parameters, '', SW_HIDE, ewNoWait, ResultCode) then
      Log('업데이트 진행 창 실행 실패: ' + IntToStr(ResultCode));
  except
    Log('업데이트 진행 창 준비 실패: ' + GetExceptionMessage);
  end;
end;
