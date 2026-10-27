@echo off
REM ============================================================
REM Career-Ops Windows One-Click Installer
REM Double-click this file to install everything automatically
REM ============================================================

setlocal enabledelayedexpansion
color 0A
title Career-Ops Installer - Manish Verma

echo.
echo  ================================================
echo    CAREER-OPS AUTOMATION - ONE-CLICK INSTALLER
echo    For: Manish Verma
echo  ================================================
echo.

REM --- Check Git ---
echo [1/6] Checking Git...
where git >nul 2>nul
if errorlevel 1 (
    echo   X Git is NOT installed!
    echo.
    echo   Download Git from: https://git-scm.com/download/win
    echo   Install it, then run this installer again.
    echo.
    pause
    start https://git-scm.com/download/win
    exit /b 1
)
echo   OK Git found

REM --- Check Node.js ---
echo [2/6] Checking Node.js...
where node >nul 2>nul
if errorlevel 1 (
    echo   X Node.js is NOT installed!
    echo.
    echo   Download Node.js LTS from: https://nodejs.org
    echo   Install it, then run this installer again.
    echo.
    pause
    start https://nodejs.org/
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo   OK Node.js %%v

REM --- Set install location ---
set INSTALL_DIR=%USERPROFILE%\career-ops-manish
echo [3/6] Install location: %INSTALL_DIR%

if exist "%INSTALL_DIR%" (
    echo   Folder already exists. Updating...
    cd /d "%INSTALL_DIR%"
    git pull origin claude/install-career-ops-GGGES
) else (
    echo   Cloning repository...
    git clone https://github.com/djemoix/djemoix.git "%INSTALL_DIR%-temp"
    if errorlevel 1 (
        echo   X Clone failed. Check internet or repo access.
        pause
        exit /b 1
    )
    cd /d "%INSTALL_DIR%-temp"
    git checkout claude/install-career-ops-GGGES
    xcopy /E /I /Q career-ops "%INSTALL_DIR%"
    cd /d %USERPROFILE%
    rmdir /S /Q "%INSTALL_DIR%-temp"
)

cd /d "%INSTALL_DIR%"

REM --- Install npm dependencies ---
echo [4/6] Installing dependencies (this takes 1-2 min)...
call npm install --silent
if errorlevel 1 (
    echo   X npm install failed
    pause
    exit /b 1
)
echo   OK Dependencies installed

REM --- Setup .env ---
echo [5/6] Setting up .env file...
if not exist .env (
    copy .env.example .env >nul
    echo   OK .env created
) else (
    echo   OK .env already exists
)

REM --- Create run.bat shortcut ---
echo [6/6] Creating desktop shortcut...
(
echo @echo off
echo cd /d "%INSTALL_DIR%"
echo cls
echo echo Running Career-Ops Daily...
echo echo.
echo node run-daily.mjs
echo echo.
echo echo ================================
echo echo   Done! Press any key to close.
echo echo ================================
echo pause ^>nul
) > "%USERPROFILE%\Desktop\Run-Career-Ops.bat"
echo   OK Desktop shortcut: Run-Career-Ops.bat

echo.
echo  ================================================
echo    INSTALLATION COMPLETE!
echo  ================================================
echo.
echo  NEXT STEPS:
echo.
echo  1. Open Gmail App Password:
echo     https://myaccount.google.com/apppasswords
echo.
echo  2. Generate password for "Mail"
echo.
echo  3. Edit the .env file:
echo     %INSTALL_DIR%\.env
echo     Put your Gmail password there
echo.
echo  4. Double-click: Run-Career-Ops.bat (on your Desktop)
echo.

choice /C YN /M "Open .env file now to add Gmail password"
if errorlevel 2 goto :END
notepad "%INSTALL_DIR%\.env"

choice /C YN /M "Open Gmail App Password page now"
if errorlevel 2 goto :END
start https://myaccount.google.com/apppasswords

:END
echo.
pause
