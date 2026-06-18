@echo off
setlocal EnableExtensions

set "VITE_USE_MOCK_API=false"
set "VITE_API_BASE_URL=http://127.0.0.1:%~2"
cd /d "%~1"
corepack pnpm --filter @ai-agent-platform/web dev --port %~3 --strictPort 1>"%~4" 2>&1
