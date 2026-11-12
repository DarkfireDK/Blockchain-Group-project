@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 22.14 or newer.
  pause
  exit /b 1
)
node "%~dp0scripts\simulate-policy.cjs" %*
set "SIM_EXIT=%ERRORLEVEL%"
echo.
pause
exit /b %SIM_EXIT%
