$ErrorActionPreference = 'Stop'
$source = Get-Content "$PSScriptRoot/update-progress.ps1" -Raw -Encoding UTF8
function Get-Process {
    param([int]$Id, [string]$Name, [string]$ErrorAction)
    if ($Id) { return $script:fakeInstaller }
    $script:readyChecks++
    if ($script:scenario -eq 'success' -and $script:readyChecks -ge 2) {
        return [pscustomobject]@{ MainWindowHandle = 1; Path = 'C:\test\app.exe' }
    }
}
$replacement = @'
try {
    $watch = New-Object System.Windows.Forms.Timer
    $watch.Interval = 25
    $form.Add_Shown({
        $form.Hide()
        if ($script:scenario -eq 'timeout') { $state.started = (Get-Date).AddSeconds(-121) }
        $watch.Start()
    })
    $watch.Add_Tick({
        if ($state.stage -eq 'starting') { $script:sawStarting = $true }
        if ($state.stage -eq 'error') {
            $state.problemShown = $heading.Text -eq '업데이트 확인 필요'
            $state.problemDetail = $detail.Text
            $form.Close()
        }
        if (((Get-Date) - $state.started).TotalSeconds -gt 5 -and $script:scenario -ne 'timeout') {
            $state.timedOut = $true
            $form.Close()
        }
    })
    [System.Windows.Forms.Application]::Run($form)
    $watch.Stop()
    $watch.Dispose()
    if ($state.timedOut) { throw 'Test timed out' }
    if ($script:scenario -eq 'success') {
        if ($state.stage -ne 'complete' -or -not $script:sawStarting) { throw 'Restart state missing' }
    } elseif ($state.stage -ne 'error' -or -not $state.problemShown) { throw 'Problem notice missing' }
    if ($script:scenario -eq 'failure' -and $state.problemDetail -notmatch '5') { throw "Exit code missing: $($state.problemDetail)" }
}
'@
foreach ($case in @('success', 'failure', 'timeout')) {
    $script:scenario = $case
    $script:readyChecks = 0
    $script:sawStarting = $false
    $script:fakeInstaller = [pscustomobject]@{ HasExited = ($case -ne 'timeout'); ExitCode = $(if ($case -eq 'failure') { 5 } else { 0 }); Handle = 1 }
    $script:fakeInstaller | Add-Member ScriptMethod Dispose {}
    $testSource = $source.Replace('try { [System.Windows.Forms.Application]::Run($form) }', $replacement)
    & ([scriptblock]::Create($testSource)) -InstallerPid 12345 -AppPath 'C:\test\app.exe'
    Write-Output "PASS: $case"
}
