param(
  [int[]]$Ports = @(8001, 5176),
  [switch]$IncludeLegacyVite5173
)

$ErrorActionPreference = "Stop"

if ($IncludeLegacyVite5173 -and ($Ports -notcontains 5173)) {
  $Ports += 5173
}

$connections = Get-NetTCPConnection -LocalPort $Ports -State Listen -ErrorAction SilentlyContinue
if (!$connections) {
  Write-Host "No listening project ports found: $($Ports -join ', ')"
  exit 0
}

$connections | Select-Object LocalAddress, LocalPort, State, OwningProcess | Format-Table

$processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($processId in $processIds) {
  if (!$processId -or $processId -eq 0) {
    continue
  }

  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
  if (!$process) {
    continue
  }

  Write-Host "Stopping PID $processId ($($process.ProcessName))"
  Stop-Process -Id $processId -Force
}

Start-Sleep -Seconds 1

$remaining = Get-NetTCPConnection -LocalPort $Ports -State Listen -ErrorAction SilentlyContinue
if ($remaining) {
  Write-Warning "Some ports are still listening:"
  $remaining | Select-Object LocalAddress, LocalPort, State, OwningProcess | Format-Table
  exit 1
}

Write-Host "Stopped project services on ports: $($Ports -join ', ')"
