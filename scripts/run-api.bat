@echo off
setlocal EnableExtensions

cd /d "%~1"
"%~2" -m uvicorn app.main:app --host 127.0.0.1 --port %~3 1>"%~4" 2>&1
