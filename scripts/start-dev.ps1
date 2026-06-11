param(
  [int]$ApiPort = 8001,
  [int]$WebPort = 5176
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$apiDir = Join-Path $repoRoot "apps\api"
$logDir = Join-Path $repoRoot "logs"
$apiLog = Join-Path $logDir "api.log"
$webLog = Join-Path $logDir "web.log"
$pythonPath = Join-Path $apiDir ".venv\Scripts\python.exe"

function Test-PortListening {
  param([int]$Port)

  $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  return $null -ne $connection
}

function Wait-HttpReady {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 30
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return $true
      }
    } catch {
      Start-Sleep -Milliseconds 800
    }
  }

  return $false
}

if (!(Test-Path -LiteralPath $pythonPath)) {
  throw "Backend Python not found: $pythonPath. Create apps/api/.venv and install dependencies first."
}

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

if (Test-PortListening -Port $ApiPort) {
  Write-Host "API port $ApiPort is already listening. Skip API startup."
} else {
  $apiCommand = "Set-Location -LiteralPath '$apiDir'; & '$pythonPath' -m uvicorn app.main:app --host 127.0.0.1 --port $ApiPort *> '$apiLog'"
  $apiProcess = Start-Process -FilePath "powershell" -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $apiCommand) -WindowStyle Hidden -PassThru
  Write-Host "Started API. PID $($apiProcess.Id). Log: $apiLog"
}

if (Wait-HttpReady -Url "http://127.0.0.1:$ApiPort/health" -TimeoutSeconds 30) {
  Write-Host "API health check passed: http://127.0.0.1:$ApiPort/health"
} else {
  Write-Warning "API health check did not pass yet. Check log: $apiLog"
}

if (Test-PortListening -Port $WebPort) {
  Write-Host "Web port $WebPort is already listening. Skip Web startup."
} else {
  $webCommand = "Set-Location -LiteralPath '$repoRoot'; `$env:VITE_USE_MOCK_API='false'; `$env:VITE_API_BASE_URL='http://127.0.0.1:$ApiPort'; corepack pnpm --filter @ai-agent-platform/web dev --port $WebPort --strictPort *> '$webLog'"
  $webProcess = Start-Process -FilePath "powershell" -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $webCommand) -WindowStyle Hidden -PassThru
  Write-Host "Started Web. PID $($webProcess.Id). Log: $webLog"
}

if (Wait-HttpReady -Url "http://127.0.0.1:$WebPort" -TimeoutSeconds 45) {
  Write-Host "Web is ready: http://127.0.0.1:$WebPort"
} else {
  Write-Warning "Web did not respond yet. Check log: $webLog"
}
