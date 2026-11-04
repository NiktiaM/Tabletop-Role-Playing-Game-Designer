@echo off
setlocal DisableDelayedExpansion
cd /d "%~dp0"
if not exist "package.json" goto missing_project
where node.exe >nul 2>&1
if errorlevel 1 goto missing_node
where npm.cmd >nul 2>&1
if errorlevel 1 goto missing_node
node.exe -e "if (Number(process.versions.node.split('.')[0]) < 24) process.exit(1)"
if errorlevel 1 goto missing_node
if not exist "node_modules\.bin\electron.cmd" goto install_dependencies
goto build_project

:install_dependencies
echo Installing dependencies. Internet access is required.
call npm.cmd ci
if errorlevel 1 goto install_failed

:build_project
echo Building Prison...
call npm.cmd run build
if errorlevel 1 goto build_failed
call npm.cmd start
if errorlevel 1 goto start_failed
exit /b 0

:missing_node
echo Node.js 24 LTS and npm are required.
echo Install from https://nodejs.org/ then reopen this file.
pause
exit /b 1

:missing_project
echo Extract the entire ZIP first. Keep this file next to package.json.
pause
exit /b 1

:install_failed
echo Dependency installation failed. See the error above.
pause
exit /b 1

:build_failed
echo Build failed. See the error above.
pause
exit /b 1

:start_failed
echo Application start failed. See the error above.
pause
exit /b 1
