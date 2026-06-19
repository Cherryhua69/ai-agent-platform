$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$startScript = Get-Content -Raw (Join-Path $scriptDir 'start-dev.bat')
$stopScript = Get-Content -Raw (Join-Path $scriptDir 'stop-dev.bat')

if ($startScript -notmatch 'AI_AGENT_CONDA_ENV') {
    throw 'start-dev.bat must support selecting a Conda environment via AI_AGENT_CONDA_ENV.'
}

if ($startScript -notmatch 'conda run -n') {
    throw 'start-dev.bat must resolve the backend Python executable from Conda.'
}

if ($stopScript -match 'tasklist\s+/FI') {
    throw 'stop-dev.bat must not skip taskkill when tasklist access is denied.'
}

Write-Output 'Development script regression checks passed.'
