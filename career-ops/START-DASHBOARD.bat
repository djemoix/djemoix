@echo off
REM Start Career-Ops Dashboard — just double-click this file!
cd /d "%~dp0"
cls
echo.
echo  ================================================
echo    Career-Ops Dashboard — Starting...
echo  ================================================
echo.
echo  Opening browser in 3 seconds...
echo.
start "" "http://localhost:3000"
timeout /t 3 /nobreak >nul 2>&1
node server.mjs
pause
