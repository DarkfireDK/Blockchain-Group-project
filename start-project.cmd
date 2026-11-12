@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 未找到 Node.js。请安装 Node.js 22.14 或更高版本，再双击此文件。
  pause
  exit /b 1
)
node "%~dp0scripts\start-local.cjs"
if errorlevel 1 pause
