@echo off
setlocal
cd /d "%~dp0"
set "HOST=0.0.0.0"
set "KURUMNET_NODE=node"
where node >nul 2>nul
if errorlevel 1 (
  set "KURUMNET_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
)
echo KurumNet kurum aginda calistiriliyor. Guvenlik duvari otomatik degistirilmez.
"%KURUMNET_NODE%" server.cjs
if errorlevel 1 (
  echo.
  echo Node.js 24 veya uzeri kurulu olmali. Hata mesajini kontrol edin.
)
pause
