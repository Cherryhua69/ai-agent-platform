@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

set "API_PORT=%~1"
set "WEB_PORT=%~2"
set "EXTRA_PORT=%~3"
if not defined API_PORT set "API_PORT=8001"
if not defined WEB_PORT set "WEB_PORT=5176"

set "SCRIPT_DIR=%~dp0"
if not "%AI_AGENT_HIDDEN_RUN%"=="1" if not "%AI_AGENT_VISIBLE_CONSOLE%"=="1" (
  set "AI_AGENT_HIDDEN_RUN=1"
  wscript.exe "%SCRIPT_DIR%run-hidden.vbs" "%~f0" "%API_PORT%" "%WEB_PORT%" "%EXTRA_PORT%"
  exit /b 0
)

set "STOP_FAILED=0"
call :stop_port %API_PORT%
call :stop_port %WEB_PORT%
if defined EXTRA_PORT call :stop_port %EXTRA_PORT%

>nul 2>&1 ping 127.0.0.1 -n 2

call :verify_stopped %API_PORT%
call :verify_stopped %WEB_PORT%
if defined EXTRA_PORT call :verify_stopped %EXTRA_PORT%

if "%STOP_FAILED%"=="1" (
  echo [ERROR] One or more project ports are still listening.
  exit /b 1
)

echo [OK] Project services stopped.
exit /b 0

:stop_port
set "TARGET_PORT=%~1"
set "FOUND_PROCESS=0"
for /f "tokens=5" %%P in ('netstat -ano -p tcp ^| findstr /R /C:":%TARGET_PORT% .*LISTENING"') do (
  set "FOUND_PROCESS=1"
  call :stop_pid %%P %TARGET_PORT%
)
if "!FOUND_PROCESS!"=="0" echo [INFO] No listener found on port %TARGET_PORT%.
exit /b 0

:stop_pid
set "TARGET_PID=%~1"
set "TARGET_PORT=%~2"
if "%TARGET_PID%"=="0" exit /b 0
tasklist /FI "PID eq %TARGET_PID%" 2>nul | findstr /R /C:" %TARGET_PID% " >nul 2>&1
if errorlevel 1 exit /b 0
echo [INFO] Stopping PID %TARGET_PID% on port %TARGET_PORT%.
taskkill /PID %TARGET_PID% /T /F >nul 2>&1
if errorlevel 1 (
  echo [WARN] Failed to stop PID %TARGET_PID%.
  set "STOP_FAILED=1"
)
exit /b 0

:verify_stopped
netstat -ano -p tcp | findstr /R /C:":%~1 .*LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo [WARN] Port %~1 is still listening.
  set "STOP_FAILED=1"
)
exit /b 0
