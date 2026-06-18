@echo off
setlocal EnableExtensions
chcp 65001 >nul

set "SCRIPT_DIR=%~dp0"
set "API_PORT=%~1"
set "WEB_PORT=%~2"
set "EXTRA_PORT=%~3"
if not defined API_PORT set "API_PORT=8001"
if not defined WEB_PORT set "WEB_PORT=5176"

if not "%AI_AGENT_HIDDEN_RUN%"=="1" if not "%AI_AGENT_VISIBLE_CONSOLE%"=="1" (
  set "AI_AGENT_HIDDEN_RUN=1"
  wscript.exe "%SCRIPT_DIR%run-hidden.vbs" "%~f0" "%API_PORT%" "%WEB_PORT%" "%EXTRA_PORT%"
  exit /b 0
)

echo [INFO] Stopping project services before restart.
call "%~dp0stop-dev.bat" "%API_PORT%" "%WEB_PORT%" "%EXTRA_PORT%"
if errorlevel 1 (
  echo [ERROR] Restart aborted because services could not be stopped cleanly.
  exit /b 1
)

>nul 2>&1 ping 127.0.0.1 -n 2

echo [INFO] Starting project services.
call "%~dp0start-dev.bat" "%API_PORT%" "%WEB_PORT%"
exit /b %errorlevel%
