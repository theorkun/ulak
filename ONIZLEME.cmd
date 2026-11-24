@echo off
setlocal
cd /d "%~dp0"
set "KURUMNET_NODE=node"
where node >nul 2>nul
if errorlevel 1 (
  set "KURUMNET_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
)
"%KURUMNET_NODE%" preview.cjs
pause
