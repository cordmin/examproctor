param(
    [Parameter(Mandatory = $true)][int]$InstallerPid,
    [Parameter(Mandatory = $true)][string]$AppPath
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$installer = Get-Process -Id $InstallerPid -ErrorAction SilentlyContinue
if ($installer) { try { $null = $installer.Handle } catch { $installer = $null } }
$state = @{ stage = 'installing'; started = Get-Date }
$form = New-Object System.Windows.Forms.Form
$form.Text = '시험감독 배정 프로그램 업데이트'
$form.ClientSize = New-Object System.Drawing.Size(440, 205)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.TopMost = $true
$form.BackColor = [System.Drawing.Color]::White
$form.Font = New-Object System.Drawing.Font('Malgun Gothic', 9)
$form.AutoScaleMode = 'Dpi'

$header = New-Object System.Windows.Forms.Panel
$header.Dock = 'Top'
$header.Height = 44
$header.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#1E293B')
$heading = New-Object System.Windows.Forms.Label
$heading.Text = '업데이트 진행 중'
$heading.ForeColor = [System.Drawing.Color]::White
$heading.Font = New-Object System.Drawing.Font('Malgun Gothic', 11, [System.Drawing.FontStyle]::Bold)
$heading.SetBounds(18, 11, 400, 25)
$header.Controls.Add($heading)
$form.Controls.Add($header)

$status = New-Object System.Windows.Forms.Label
$status.Text = '새 버전을 설치하고 있습니다.'
$status.Font = New-Object System.Drawing.Font('Malgun Gothic', 11, [System.Drawing.FontStyle]::Bold)
$status.SetBounds(20, 62, 400, 26)
$detail = New-Object System.Windows.Forms.Label
$detail.Text = "완료되면 프로그램이 자동으로 열립니다.`r`n잠시만 기다려 주세요."
$detail.SetBounds(20, 96, 400, 42)
$progress = New-Object System.Windows.Forms.ProgressBar
$progress.Style = 'Marquee'
$progress.MarqueeAnimationSpeed = 30
$progress.SetBounds(20, 151, 400, 12)
$closeButton = New-Object System.Windows.Forms.Button
$closeButton.Text = '닫기'
$closeButton.SetBounds(350, 175, 70, 25)
$closeButton.Visible = $false
$closeButton.Add_Click({ $form.Close() })
$form.Controls.AddRange(@($status, $detail, $progress, $closeButton))

function ShowUpdateProblem([string]$message, [string]$explanation) {
    $state.stage = 'error'
    $heading.Text = '업데이트 확인 필요'
    $status.Text = $message
    $detail.Text = $explanation
    $progress.Style = 'Blocks'
    $progress.Value = 0
    $closeButton.Visible = $true
}

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 300
$timer.Add_Tick({
    if ($state.stage -eq 'error') { return }
    if (((Get-Date) - $state.started).TotalSeconds -gt 120) {
        ShowUpdateProblem '업데이트가 예상보다 오래 걸리고 있습니다.' "이 안내를 닫아도 설치는 계속됩니다.`r`n잠시 기다린 뒤 바탕화면 바로가기로 실행해 주세요."
        return
    }
    if ($state.stage -eq 'installing') {
        if ($installer -and -not $installer.HasExited) { return }
        if ($installer -and $installer.ExitCode -notin @(0, 3010)) {
            ShowUpdateProblem '새 버전을 설치하지 못했습니다.' "설치 오류 코드: $($installer.ExitCode)`r`n프로그램을 다시 실행한 뒤 업데이트를 재시도해 주세요."
            return
        }
        $state.stage = 'starting'
        $heading.Text = '설치 완료'
        $status.Text = '프로그램을 다시 실행하고 있습니다.'
        $detail.Text = "첫 실행 준비에 시간이 걸릴 수 있습니다.`r`n프로그램 창이 열리면 이 안내는 자동으로 닫힙니다."
    }
    $ready = @(Get-Process -Name ([System.IO.Path]::GetFileNameWithoutExtension($AppPath)) -ErrorAction SilentlyContinue | Where-Object {
        try { $_.MainWindowHandle -ne 0 -and $_.Path -eq $AppPath } catch { $false }
    })
    if ($ready.Count -gt 0) {
        $state.stage = 'complete'
        $form.Close()
    }
})
$form.Add_Shown({ $timer.Start() })
$form.Add_FormClosed({ $timer.Stop() })
try { [System.Windows.Forms.Application]::Run($form) }
finally { $timer.Dispose(); $form.Dispose(); if ($installer) { $installer.Dispose() } }
