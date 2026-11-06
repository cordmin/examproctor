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
$form.ClientSize = New-Object System.Drawing.Size(460, 280)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'None'
$form.MaximizeBox = $false
$form.MinimizeBox = $true
$form.BackColor = [System.Drawing.Color]::White
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
$header.Height = 88
$header.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#19263F')
$appName = New-Object System.Windows.Forms.Label
$appName.Text = '시험감독 배정 프로그램'
$appName.ForeColor = [System.Drawing.ColorTranslator]::FromHtml('#C1CEE2')
$appName.SetBounds(24, 17, 380, 23)
$heading = New-Object System.Windows.Forms.Label
$heading.Text = '프로그램 업데이트'
$heading.ForeColor = [System.Drawing.Color]::White
$heading.Font = New-Object System.Drawing.Font('Malgun Gothic', 14, [System.Drawing.FontStyle]::Bold)
$heading.SetBounds(24, 42, 412, 32)
$header.Controls.AddRange(@($appName, $heading))
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
$status.SetBounds(24, 110, 412, 28)
$detail = New-Object System.Windows.Forms.Label
$detail.Text = '설치가 끝나면 프로그램이 자동으로 열립니다.'
$detail.ForeColor = [System.Drawing.ColorTranslator]::FromHtml('#566780')
$detail.SetBounds(24, 148, 412, 46)
$progress = New-Object System.Windows.Forms.Panel
$progress.AccessibleName = '업데이트 진행 중'
$progress.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#F0F4F9')
$progress.SetBounds(24, 210, 412, 6)
$progressFill = New-Object System.Windows.Forms.Panel
$progressFill.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#2A5088')
$progressFill.SetBounds(0, 0, 130, 6)
$progress.Controls.Add($progressFill)
$downloadState = New-Object System.Windows.Forms.Label
$downloadState.Text = '다운로드 완료'
$downloadState.ForeColor = $detail.ForeColor
$downloadState.SetBounds(24, 232, 180, 24)
$stageLabel = New-Object System.Windows.Forms.Label
$stageLabel.Text = '설치 진행 중'
$stageLabel.ForeColor = $progressFill.BackColor
$stageLabel.Font = New-Object System.Drawing.Font('Malgun Gothic', 9, [System.Drawing.FontStyle]::Bold)
$stageLabel.TextAlign = 'TopRight'
$stageLabel.SetBounds(256, 232, 180, 24)
$closeButton = New-Object System.Windows.Forms.Button
$closeButton.Text = '닫기'
$closeButton.SetBounds(356, 273, 80, 29)
$closeButton.FlatStyle = 'Flat'
$closeButton.BackColor = $progressFill.BackColor
$closeButton.ForeColor = [System.Drawing.Color]::White
$closeButton.Visible = $false
$closeButton.Add_Click({ $form.Close() })
$form.Controls.AddRange(@($status, $detail, $progress, $downloadState, $stageLabel, $closeButton))
foreach ($control in @($form, $header, $appName, $heading, $status, $detail, $downloadState, $stageLabel)) {
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
    $stageLabel.Text = '확인 필요'
    $stageLabel.ForeColor = [System.Drawing.ColorTranslator]::FromHtml('#B63D3D')
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
        $stageLabel.Text = '자동 실행 중'
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
finally { $timer.Dispose(); $animation.Dispose(); $form.Dispose(); if ($installer) { $installer.Dispose() } }
