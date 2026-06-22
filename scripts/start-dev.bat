@echo off
setlocal EnableExtensions
chcp 65001 >nul

set "API_PORT=%~1"
set "WEB_PORT=%~2"
if not defined API_PORT set "API_PORT=8001"
if not defined WEB_PORT set "WEB_PORT=5176"

set "SCRIPT_DIR=%~dp0"
if not "%AI_AGENT_HIDDEN_RUN%"=="1" if not "%AI_AGENT_VISIBLE_CONSOLE%"=="1" (
  set "AI_AGENT_HIDDEN_RUN=1"
  wscript.exe "%SCRIPT_DIR%run-hidden.vbs" "%~f0" "%API_PORT%" "%WEB_PORT%"
  exit /b 0
)

for %%I in ("%~dp0..") do set "REPO_ROOT=%%~fI"
set "API_DIR=%REPO_ROOT%\apps\api"
set "LOG_DIR=%REPO_ROOT%\logs"
if "%API_PORT%"=="8001" (set "API_LOG=%LOG_DIR%\api.log") else (set "API_LOG=%LOG_DIR%\api-%API_PORT%.log")
if "%WEB_PORT%"=="5176" (set "WEB_LOG=%LOG_DIR%\web.log") else (set "WEB_LOG=%LOG_DIR%\web-%WEB_PORT%.log")
set "CONDA_ENV_NAME=%AI_AGENT_CONDA_ENV%"
if not defined CONDA_ENV_NAME set "CONDA_ENV_NAME=ai-agent-platform"
set "PYTHON_PATH="
set "PYTHON_SOURCE=Conda environment %CONDA_ENV_NAME%"

where conda >nul 2>&1
if errorlevel 1 (
  echo [ERROR] conda is not available on PATH.
  exit /b 1
)

for /f "usebackq delims=" %%I in (`conda run -n "%CONDA_ENV_NAME%" python -c "import sys; print(sys.executable)" 2^>nul`) do set "PYTHON_PATH=%%I"
if not defined PYTHON_PATH (
  if exist "%API_DIR%\.venv\Scripts\python.exe" (
    set "PYTHON_PATH=%API_DIR%\.venv\Scripts\python.exe"
    set "PYTHON_SOURCE=project virtual environment apps\api\.venv"
  ) else (
    echo [ERROR] Could not resolve Python from Conda environment: %CONDA_ENV_NAME%
    echo Create it with: conda create -n %CONDA_ENV_NAME% python=3.11 -y
    exit /b 1
  )
)

if not exist "%PYTHON_PATH%" (
  echo [ERROR] Conda Python not found: %PYTHON_PATH%
  exit /b 1
)

echo [INFO] Backend Python source: %PYTHON_SOURCE%
echo [INFO] Backend Python: %PYTHON_PATH%

where corepack >nul 2>&1
if errorlevel 1 (
  echo [ERROR] corepack is not available. Install Node.js and enable Corepack first.
  exit /b 1
)

where curl.exe >nul 2>&1
if errorlevel 1 (
  echo [ERROR] curl.exe is not available. Use a supported Windows 10 or Windows 11 environment.
  exit /b 1
)

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

call :is_port_listening %API_PORT%
if not errorlevel 1 (
  echo [INFO] API port %API_PORT% is already listening. Skipping API startup.
) else (
  call :start_api
  echo [INFO] API startup requested. Log: %API_LOG%
)

call :wait_http "http://127.0.0.1:%API_PORT%/health" 30
if errorlevel 1 (
  echo [WARN] API health check timed out. Check: %API_LOG%
) else (
  echo [OK] API is ready: http://127.0.0.1:%API_PORT%/health
)

call :is_port_listening %WEB_PORT%
if not errorlevel 1 (
  echo [INFO] Web port %WEB_PORT% is already listening. Skipping Web startup.
) else (
  call :start_web
  echo [INFO] Web startup requested. Log: %WEB_LOG%
)

call :wait_http "http://127.0.0.1:%WEB_PORT%" 45
if errorlevel 1 (
  echo [WARN] Web readiness check timed out. Check: %WEB_LOG%
  exit /b 1
)

echo [OK] Web is ready: http://127.0.0.1:%WEB_PORT%
exit /b 0

:start_api
type nul >"%API_LOG%"
wscript.exe "%SCRIPT_DIR%run-hidden.vbs" "%SCRIPT_DIR%run-api.bat" "%API_DIR%" "%PYTHON_PATH%" "%API_PORT%" "%API_LOG%"
exit /b 0

:start_web
type nul >"%WEB_LOG%"
wscript.exe "%SCRIPT_DIR%run-hidden.vbs" "%SCRIPT_DIR%run-web.bat" "%REPO_ROOT%" "%API_PORT%" "%WEB_PORT%" "%WEB_LOG%"
exit /b 0

:is_port_listening
netstat -ano -p tcp | findstr /R /C:":%~1 .*LISTENING" >nul 2>&1
exit /b %errorlevel%

:wait_http
set "READY_URL=%~1"
set /a "WAIT_SECONDS=%~2"
set /a "WAITED=0"

:wait_http_loop
curl.exe --silent --fail --output NUL --max-time 2 "%READY_URL%" >nul 2>&1
if not errorlevel 1 exit /b 0
if %WAITED% geq %WAIT_SECONDS% exit /b 1
>nul 2>&1 ping 127.0.0.1 -n 2
set /a "WAITED+=1"
goto :wait_http_loop
