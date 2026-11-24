@echo off
setlocal
cd /d "%~dp0"
set "HOST=127.0.0.1"
set "KURUMNET_NODE=node"
where node >nul 2>nul
if errorlevel 1 (
  set "KURUMNET_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
)
"%KURUMNET_NODE%" server.cjs
if errorlevel 1 (
  echo.
  echo Node.js 24 veya uzeri kurulu olmali. Hata mesajini kontrol edin.
)
pause
