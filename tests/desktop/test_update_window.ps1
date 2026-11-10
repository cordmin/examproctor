$ErrorActionPreference = 'Stop'
$src = (Resolve-Path (Join-Path $PSScriptRoot '..\..\src')).Path
$source = Get-Content "$src/update-progress.ps1" -Raw -Encoding UTF8
function Get-Process {
    param([int]$Id, [string]$Name, [string]$ErrorAction)
    if ($Id) { return $script:fakeInstaller }
}
$script:fakeInstaller = [pscustomobject]@{ HasExited = $false; ExitCode = 0; Handle = 1 }
$script:fakeInstaller | Add-Member ScriptMethod Dispose {}
$replacement = @'
try {
    if ($source -match 'Add-Type @') { throw 'Compiled helper must not be used' }
    $check = New-Object System.Windows.Forms.Timer
    $check.Interval = 400
    $check.Add_Tick({
        $check.Stop()
        try {
            if ($form.TopMost) { throw 'Window must not stay on top' }
            $before = $form.Location
            $mouse = New-Object System.Windows.Forms.MouseEventArgs([System.Windows.Forms.MouseButtons]::Left, 1, 10, 10, 0)
            $origin = [System.Windows.Forms.Cursor]::Position
            & $startDrag $header $mouse
            [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(($origin.X + 40), ($origin.Y + 25))
            & $moveDrag $header $mouse
            & $endDrag $header $mouse
            [System.Windows.Forms.Cursor]::Position = $origin
            $moved = $form.Location
            if (($moved.X - $before.X) -ne 40 -or ($moved.Y - $before.Y) -ne 25) { throw "Window did not follow drag: $before -> $moved" }
            & $moveDrag $header $mouse
            if ($form.Location -ne $moved) { throw 'Window moved after mouse release' }
            $minimizeButton.PerformClick()
            if ($form.WindowState -ne 'Minimized') { throw 'Window did not minimize' }
            if (-not $form.ShowInTaskbar) { throw 'Minimized window must stay in taskbar' }
            $form.WindowState = 'Normal'
            if ($form.Region -eq $null) { throw 'Rounded region lost' }
            $state.result = 'pass'
        } catch { $state.result = $_.Exception.Message }
        $form.Close()
    })
    $form.Add_Shown({ $timer.Stop(); $check.Start() })
    [System.Windows.Forms.Application]::Run($form)
    $check.Dispose()
    if ($state.result -ne 'pass') { throw "Failed: $($state.result)" }
}
'@
$testSource = $source.Replace('try { [System.Windows.Forms.Application]::Run($form) }', $replacement)
& ([scriptblock]::Create($testSource)) -InstallerPid 12345 -AppPath 'C:\test\app.exe'
Write-Output 'PASS: update window moves, minimizes, restores and is not topmost'
