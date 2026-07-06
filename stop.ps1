param(
    [int[]]$Ports = @(8000, 4200)
)

$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
$RuntimeDir = Join-Path $Root ".runtime"

function Stop-ProcessTree {
    param([int]$ProcessId)

    $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$ProcessId" -ErrorAction SilentlyContinue
    foreach ($child in $children) {
        Stop-ProcessTree -ProcessId ([int]$child.ProcessId)
    }

    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if ($process) {
        Stop-Process -Id $ProcessId -Force
    }
}

function Stop-FromPidFile {
    param(
        [string]$Name,
        [string]$PidFile
    )

    if (-not (Test-Path -LiteralPath $PidFile)) {
        Write-Host "$Name PID file not found."
        return
    }

    $processId = (Get-Content -LiteralPath $PidFile -Raw).Trim()
    if ($processId -and ($processId -match "^\d+$")) {
        $process = Get-Process -Id ([int]$processId) -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "Stopping $Name process tree (PID $processId)..."
            Stop-ProcessTree -ProcessId ([int]$processId)
        }
        else {
            Write-Host "$Name process from PID file is not running."
        }
    }

    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
}

function Stop-ListenersOnPort {
    param([int]$Port)

    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique

    foreach ($processId in $processIds) {
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($process) {
            $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId=$processId" -ErrorAction SilentlyContinue
            $commandLine = if ($processInfo) { $processInfo.CommandLine } else { "" }
            if (-not $commandLine -or -not $commandLine.Contains($Root)) {
                Write-Host "Skipping listener on port $Port (PID $processId, $($process.ProcessName)); it was not started from this project."
                continue
            }

            Write-Host "Stopping listener on port $Port (PID $processId, $($process.ProcessName))..."
            Stop-ProcessTree -ProcessId ([int]$processId)
        }
    }
}

Stop-FromPidFile -Name "Backend" -PidFile (Join-Path $RuntimeDir "backend.pid")
Stop-FromPidFile -Name "Frontend" -PidFile (Join-Path $RuntimeDir "frontend.pid")

foreach ($port in $Ports) {
    Stop-ListenersOnPort -Port $port
}

Write-Host "Project stopped."
