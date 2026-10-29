param([string]$Compiler = (Get-Command iscc -ErrorAction Stop).Source)
$ErrorActionPreference = 'Stop'
$folder = Join-Path ([IO.Path]::GetTempPath()) ('exam-update-test-' + [guid]::NewGuid())
$null = New-Item -ItemType Directory -Path $folder
$stub = Join-Path $folder '시험감독배정시스템.exe'
# Real installer, with a delayed app window. Separate AppId, directory and no shortcuts/registry.
Add-Type -ReferencedAssemblies System.Windows.Forms -OutputAssembly $stub -OutputType WindowsApplication -TypeDefinition @'
using System;
using System.Threading;
using System.Windows.Forms;
public class UpdateTestApp {
    [STAThread] public static void Main() {
        Thread.Sleep(10000);
        var form = new Form { Text = "Exam update smoke app" };
        var timer = new System.Windows.Forms.Timer { Interval = 5000 };
        timer.Tick += (s,e) => form.Close();
        form.Shown += (s,e) => timer.Start();
        Application.Run(form);
    }
}
'@
$source = Get-Content "$PSScriptRoot/installer.iss" -Raw -Encoding UTF8
$source = $source -replace 'AppId=.*', ('AppId=ExamUpdateSmoke-' + [guid]::NewGuid())
$source = $source.Replace('[Setup]', "[Setup]`r`nUninstallable=no`r`nCreateUninstallRegKey=no`r`nUsePreviousAppDir=no")
$source = $source -replace '(?s)\[Icons\].*?(?=\[Run\])', ''
$source = $source.Replace('Source: "dist\{#MyAppExe}"', ('Source: "' + $stub + '"'))
$source = $source.Replace('Source: "update-progress.ps1"', ('Source: "' + $PSScriptRoot + '\update-progress.ps1"'))
$source = $source.Replace('SetupIconFile=icon.ico', ('SetupIconFile=' + $PSScriptRoot + '\icon.ico'))
$source = $source.Replace('LicenseFile=license.txt', ('LicenseFile=' + $PSScriptRoot + '\license.txt'))
$source = $source.Replace('Source: "license.txt"', ('Source: "' + $PSScriptRoot + '\license.txt"'))
$source = $source.Replace('Source: "motto-serif-LICENSE.txt"', ('Source: "' + $PSScriptRoot + '\motto-serif-LICENSE.txt"'))
$source = $source.Replace("ExpandConstant('{userappdata}\시험감독배정')", "'$folder'")
$source = $source.Replace("ExpandConstant('{userappdata}\시험감독배정\update-progress.ps1')", "'$folder\update-progress.ps1'")
$iss = Join-Path $folder 'smoke.iss'
[IO.File]::WriteAllText($iss, $source, (New-Object Text.UTF8Encoding($true)))
& $Compiler "/O$folder" $iss
if ($LASTEXITCODE -ne 0) { throw 'Installer compilation failed' }
$installDir = Join-Path $folder 'installed'
$log = Join-Path $folder 'install.log'
$process = Start-Process (Join-Path $folder 'ExamProctorSetup.exe') -WindowStyle Hidden -PassThru -ArgumentList @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', "/DIR=`"$installDir`"", "/LOG=`"$log`"")
$seenNotice = $false
$seenApp = $false
$deadline = (Get-Date).AddSeconds(45)
try {
    do {
        $notices = @(Get-Process powershell -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -eq '시험감독 배정 프로그램 업데이트' })
        $apps = @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -eq 'Exam update smoke app' })
        if ($notices.Count) { $seenNotice = $true }
        if ($apps.Count) { $seenApp = $true }
        if ($seenNotice -and -not $seenApp -and -not $notices.Count) { throw 'Notice closed before application window appeared' }
        if ($seenApp -and -not $notices.Count) { break }
        Start-Sleep -Milliseconds 100
    } while ((Get-Date) -lt $deadline)
    if (-not $seenNotice) { throw "Notice never appeared. Log: $(Get-Content $log -Raw)" }
    if (-not $seenApp -or $notices.Count) { throw 'Notice did not remain until restart and close automatically' }
    $process.WaitForExit(5000) | Out-Null
    if ($process.ExitCode -ne 0) { throw "Installer exit code: $($process.ExitCode)" }
    Write-Output 'PASS: actual silent installer starts notice, retains it during delayed restart, closes it after app window appears'
} finally {
    Get-Process -ErrorAction SilentlyContinue | Where-Object { try { $_.Path -eq (Join-Path $installDir '시험감독배정시스템.exe') } catch { $false } } | Stop-Process
}
