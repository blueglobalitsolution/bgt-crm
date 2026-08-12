@echo off
title BGT CRM - Website Audit Engine Launcher
cd /d "%~dp0"

echo ==========================================================
echo  BGT CRM - Website Audit Engine
echo  Starts API + Frontend, and verifies the Python worker
echo ==========================================================
echo.

REM --- 1. Node dependencies ---------------------------------
if not exist "node_modules" (
  echo [1/4] Installing Node dependencies ^(npm install^)...
  call npm install
  if errorlevel 1 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
  )
) else (
  echo [1/4] Node dependencies OK
)

REM --- 2. Python check ----------------------------------------
where python >nul 2>nul
if errorlevel 1 (
  echo [2/4] ERROR: Python not found in PATH.
  echo        Install Python 3.10+ from https://www.python.org/downloads/
  echo        and make sure "python" is added to PATH.
  pause
  exit /b 1
)
echo [2/4] Python found

REM --- 3. Audit worker packages -------------------------------
python -c "import httpx, lxml, bs4" >nul 2>nul
if errorlevel 1 (
  echo [3/4] Installing Python audit worker packages...
  python -m pip install -r audit_worker\requirements.txt
  if errorlevel 1 (
    echo WARNING: pip install failed. Audits will fail to crawl.
  )
) else (
  echo [3/4] Python audit worker packages OK
)

REM --- 4. Launch server (opens browser after a few seconds) ---
echo [4/4] Starting BGT CRM on http://localhost:3000 ...
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"
call npm run dev

pause
