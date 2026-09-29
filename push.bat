@echo off
rem Double-click to commit all changes and push to origin/main.
rem Or run: push.bat "commit message"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0push.ps1" %*
echo.
pause
