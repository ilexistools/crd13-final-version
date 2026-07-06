param(
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 4200,
    [switch]$NoInstall
)

$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
$BackendDir = Join-Path $Root "backend"
$FrontendDir = Join-Path $Root "frontend"
$RuntimeDir = Join-Path $Root ".runtime"
$LogDir = Join-Path $RuntimeDir "logs"

New-Item -ItemType Directory -Force -Path $RuntimeDir, $LogDir | Out-Null

function Test-PortInUse {
    param([int]$Port)

    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    return $null -ne $connection
}

function Stop-StaleProcess {
    param(
        [string]$Name,
        [string]$PidFile
    )

    if (-not (Test-Path -LiteralPath $PidFile)) {
        return
    }

    $processId = (Get-Content -LiteralPath $PidFile -Raw).Trim()
    if ($processId -and ($processId -match "^\d+$")) {
        $process = Get-Process -Id ([int]$processId) -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "Stopping previous $Name process (PID $processId)..."
            Stop-Process -Id ([int]$processId) -Force
        }
    }

    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
}

function Start-LoggedProcess {
    param(
        [string]$Name,
        [string]$FilePath,
        [string[]]$ArgumentList,
        [string]$WorkingDirectory,
        [string]$PidFile,
        [string]$OutLog,
        [string]$ErrLog
    )

    Stop-StaleProcess -Name $Name -PidFile $PidFile

    $process = Start-Process `
        -FilePath $FilePath `
        -ArgumentList $ArgumentList `
        -WorkingDirectory $WorkingDirectory `
        -RedirectStandardOutput $OutLog `
        -RedirectStandardError $ErrLog `
        -WindowStyle Hidden `
        -PassThru

    Set-Content -LiteralPath $PidFile -Value $process.Id -Encoding ASCII
    Write-Host "$Name started with PID $($process.Id)."
}

if (-not (Test-Path -LiteralPath $BackendDir)) {
    throw "Backend directory not found: $BackendDir"
}

if (-not (Test-Path -LiteralPath $FrontendDir)) {
    throw "Frontend directory not found: $FrontendDir"
}

if (Test-PortInUse -Port $BackendPort) {
    throw "Port $BackendPort is already in use. Run .\stop-project.ps1 or choose another backend port."
}

if (Test-PortInUse -Port $FrontendPort) {
    throw "Port $FrontendPort is already in use. Run .\stop-project.ps1 or choose another frontend port."
}

$Python = Join-Path $BackendDir ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $Python)) {
    $Python = "python"
}

if (-not $NoInstall) {
    if (-not (Test-Path -LiteralPath (Join-Path $FrontendDir "node_modules"))) {
        Write-Host "Installing frontend dependencies..."
        Push-Location $FrontendDir
        try {
            npm install
        }
        finally {
            Pop-Location
        }
    }
}

Start-LoggedProcess `
    -Name "Backend" `
    -FilePath $Python `
    -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "$BackendPort", "--reload") `
    -WorkingDirectory $BackendDir `
    -PidFile (Join-Path $RuntimeDir "backend.pid") `
    -OutLog (Join-Path $LogDir "backend.out.log") `
    -ErrLog (Join-Path $LogDir "backend.err.log")

Start-LoggedProcess `
    -Name "Frontend" `
    -FilePath "npm.cmd" `
    -ArgumentList @("start", "--", "--host", "127.0.0.1", "--port", "$FrontendPort") `
    -WorkingDirectory $FrontendDir `
    -PidFile (Join-Path $RuntimeDir "frontend.pid") `
    -OutLog (Join-Path $LogDir "frontend.out.log") `
    -ErrLog (Join-Path $LogDir "frontend.err.log")

Write-Host ""
Write-Host "Project started."
Write-Host "Frontend: http://127.0.0.1:$FrontendPort"
Write-Host "Backend:  http://127.0.0.1:$BackendPort"
Write-Host "Logs:     $LogDir"
