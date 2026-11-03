@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
 echo Установите Node.js 24 LTS, затем запустите этот файл снова.
 pause
 exit /b 1
)
if not exist node_modules (
 call npm ci
 if errorlevel 1 (
  pause
  exit /b 1
 )
)
call npm run build
if errorlevel 1 (
 pause
 exit /b 1
)
call npm start
if errorlevel 1 pause
