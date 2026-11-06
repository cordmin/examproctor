param(
    [Parameter(Mandatory = $true)][int]$InstallerPid,
    [Parameter(Mandatory = $true)][string]$AppPath,
    [string]$Version = ''
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$installer = Get-Process -Id $InstallerPid -ErrorAction SilentlyContinue
if ($installer) { try { $null = $installer.Handle } catch { $installer = $null } }
$state = @{ stage = 'installing'; started = Get-Date }
$form = New-Object System.Windows.Forms.Form
$form.Text = '시험감독 배정 프로그램 업데이트'
$form.ClientSize = New-Object System.Drawing.Size(460, 280)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'None'
$form.MaximizeBox = $false
$form.MinimizeBox = $true
$form.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#F8FAFC')
# 지정하지 않으면 작업 표시줄에 Windows 기본 창 아이콘이 나온다.
if ($PSScriptRoot -and (Test-Path (Join-Path $PSScriptRoot 'icon.ico'))) {
    $appIcon = New-Object System.Drawing.Icon((Join-Path $PSScriptRoot 'icon.ico'))
    $form.Icon = $appIcon
}
$form.Font = New-Object System.Drawing.Font('Malgun Gothic', 9)
$form.ForeColor = [System.Drawing.ColorTranslator]::FromHtml('#19263F')
$form.AutoScaleDimensions = New-Object System.Drawing.SizeF(96, 96)
$form.AutoScaleMode = 'Dpi'
function SetProgressWindowRegion {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $diameter = [int](32 * $form.DeviceDpi / 96)
    $path.AddArc(0, 0, $diameter, $diameter, 180, 90)
    $path.AddArc(($form.Width - $diameter), 0, $diameter, $diameter, 270, 90)
    $path.AddArc(($form.Width - $diameter), ($form.Height - $diameter), $diameter, $diameter, 0, 90)
    $path.AddArc(0, ($form.Height - $diameter), $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    $oldRegion = $form.Region
    $form.Region = New-Object System.Drawing.Region($path)
    if ($oldRegion) { $oldRegion.Dispose() }
    $path.Dispose()
}
$form.Add_SizeChanged({ if ($form.WindowState -ne 'Minimized') { SetProgressWindowRegion } })

$header = New-Object System.Windows.Forms.Panel
$header.Dock = 'Top'
$header.Height = 150
$header.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#19263F')
$logo = New-Object System.Windows.Forms.PictureBox
$logo.SetBounds(206, 18, 48, 48)
$logo.SizeMode = 'Zoom'
$logo.BackColor = $header.BackColor
if ($PSScriptRoot -and (Test-Path (Join-Path $PSScriptRoot 'icon.png'))) {
    $logo.Image = [System.Drawing.Image]::FromFile((Join-Path $PSScriptRoot 'icon.png'))
}
$appName = New-Object System.Windows.Forms.Label
$appName.Text = '시험감독 배정'
$appName.ForeColor = [System.Drawing.Color]::White
$appName.Font = New-Object System.Drawing.Font('Malgun Gothic', 14, [System.Drawing.FontStyle]::Bold)
$appName.TextAlign = 'MiddleCenter'
$appName.SetBounds(40, 72, 380, 32)
$heading = New-Object System.Windows.Forms.Label
$heading.Text = if ($Version) { "v$Version 업데이트" } else { '프로그램 업데이트' }
$heading.ForeColor = [System.Drawing.ColorTranslator]::FromHtml('#BFD0EB')
$heading.TextAlign = 'MiddleCenter'
$heading.SetBounds(40, 106, 380, 24)
$header.Controls.AddRange(@($logo, $appName, $heading))
$minimizeButton = New-Object System.Windows.Forms.Button
$minimizeButton.Text = '―'
$minimizeButton.AccessibleName = '최소화'
$minimizeButton.FlatStyle = 'Flat'
$minimizeButton.FlatAppearance.BorderSize = 0
$minimizeButton.FlatAppearance.MouseOverBackColor = [System.Drawing.ColorTranslator]::FromHtml('#2A3B5C')
$minimizeButton.ForeColor = [System.Drawing.Color]::White
$minimizeButton.TabStop = $false
$minimizeButton.SetBounds(414, 12, 32, 26)
$minimizeButton.Add_Click({ $form.WindowState = 'Minimized' })
$header.Controls.Add($minimizeButton)
# 창 끌기: 마우스가 움직인 만큼 창 위치를 옮긴다. 컴파일이 필요한 Add-Type 은 환경에 따라 실패해 쓰지 않는다.
$startDrag = {
    param($source, $mouse)
    if ($mouse.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
        $state.dragCursor = [System.Windows.Forms.Cursor]::Position
        $state.dragWindow = $form.Location
    }
}
$moveDrag = {
    if ($state.dragCursor) {
        $cursor = [System.Windows.Forms.Cursor]::Position
        $form.Location = New-Object System.Drawing.Point(($state.dragWindow.X + $cursor.X - $state.dragCursor.X), ($state.dragWindow.Y + $cursor.Y - $state.dragCursor.Y))
    }
}
$endDrag = { $state.dragCursor = $null }
$form.Controls.Add($header)

$status = New-Object System.Windows.Forms.Label
$status.Text = '새 버전을 설치하고 있습니다.'
$status.Font = New-Object System.Drawing.Font('Malgun Gothic', 11, [System.Drawing.FontStyle]::Bold)
$status.TextAlign = 'MiddleCenter'
$status.SetBounds(24, 164, 412, 28)
$detail = New-Object System.Windows.Forms.Label
$detail.Text = '설치가 끝나면 프로그램이 자동으로 열립니다.'
$detail.ForeColor = [System.Drawing.ColorTranslator]::FromHtml('#566780')
$detail.TextAlign = 'TopCenter'
$detail.SetBounds(24, 216, 412, 46)
$progress = New-Object System.Windows.Forms.Panel
$progress.AccessibleName = '업데이트 진행 중'
$progress.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#E3E9F1')
$progress.SetBounds(40, 198, 380, 6)
$progressFill = New-Object System.Windows.Forms.Panel
$progressFill.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#2A5088')
$progressFill.SetBounds(0, 0, 130, 6)
$progress.Controls.Add($progressFill)
$closeButton = New-Object System.Windows.Forms.Button
$closeButton.Text = '닫기'
$closeButton.SetBounds(356, 273, 80, 29)
$closeButton.FlatStyle = 'Flat'
$closeButton.BackColor = $progressFill.BackColor
$closeButton.ForeColor = [System.Drawing.Color]::White
$closeButton.Visible = $false
$closeButton.Add_Click({ $form.Close() })
$form.Controls.AddRange(@($status, $detail, $progress, $closeButton))
foreach ($control in @($form, $header, $logo, $appName, $heading, $status, $detail)) {
    $control.Add_MouseDown($startDrag)
    $control.Add_MouseMove($moveDrag)
    $control.Add_MouseUp($endDrag)
}
$animation = New-Object System.Windows.Forms.Timer
$animation.Interval = 30
$animation.Add_Tick({
    $progressFill.Left += 6
    if ($progressFill.Left -gt $progress.Width) { $progressFill.Left = -$progressFill.Width }
})

function ShowUpdateProblem([string]$message, [string]$explanation) {
    $state.stage = 'error'
    $heading.Text = '업데이트 확인 필요'
    $status.Text = $message
    $detail.Text = $explanation
    $animation.Stop()
    $progressFill.Visible = $false
    $form.ClientSize = New-Object System.Drawing.Size($form.ClientSize.Width, ([int](316 * $form.DeviceDpi / 96)))
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
$form.Add_Shown({ SetProgressWindowRegion; $form.Activate(); $timer.Start(); $animation.Start() })
$form.Add_FormClosed({ $timer.Stop(); $animation.Stop() })
try { [System.Windows.Forms.Application]::Run($form) }
finally { $timer.Dispose(); $animation.Dispose(); if ($logo.Image) { $logo.Image.Dispose() }; if ($appIcon) { $appIcon.Dispose() }; $form.Dispose(); if ($installer) { $installer.Dispose() } }
