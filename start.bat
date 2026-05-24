@echo off
setlocal enabledelayedexpansion

REM ============================================================================
REM  Crypt Crawlers - Windows dev server launcher
REM  ---------------------------------------------------------------------------
REM  1. Verifies Node.js + npm are on PATH.
REM  2. Runs `npm install` if node_modules is missing.
REM  3. Scans TCP ports 5173..5200 for the first one not in LISTENING state.
REM  4. Launches the Vite dev server bound to that port via `npm run dev`.
REM
REM  Double-click this file, or run `start.bat` from a Command Prompt.
REM ============================================================================

cd /d "%~dp0"

echo.
echo ============================================================
echo   Crypt Crawlers - dev server launcher
echo ============================================================

REM --- 1. Verify Node + npm are on PATH --------------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not on PATH.
  echo         Install Node 18+ from https://nodejs.org/ and re-run.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm is not on PATH.
  pause
  exit /b 1
)

REM --- 2. Install dependencies if missing ------------------------------------
if not exist "node_modules" (
  echo [SETUP] node_modules not found, running `npm install`...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

REM --- 3. Find the first free TCP port starting at 5173 ----------------------
set START_PORT=5173
set MAX_PORT=5200
set PORT=

echo [SCAN] Looking for a free TCP port between %START_PORT% and %MAX_PORT%...

for /l %%P in (%START_PORT%,1,%MAX_PORT%) do (
  if not defined PORT (
    REM Filter on LISTENING so that a remote endpoint with the same port number
    REM (e.g. an ESTABLISHED connection) doesn't get flagged as "in use".
    netstat -ano | findstr LISTENING | findstr /C:":%%P " >nul 2>nul
    if errorlevel 1 (
      set PORT=%%P
    ) else (
      echo        Port %%P is in use, trying next...
    )
  )
)

if not defined PORT (
  echo [ERROR] No free port found between %START_PORT% and %MAX_PORT%.
  pause
  exit /b 1
)

echo.
echo ------------------------------------------------------------
echo   Starting Vite on port %PORT%
echo   URL:  http://localhost:%PORT%/
echo   Press Ctrl-C to stop the server.
echo ------------------------------------------------------------
echo.

REM --- 4. Launch the dev server ----------------------------------------------
REM --strictPort makes Vite fail loudly if something grabbed the port between
REM the scan above and now, instead of silently jumping to another one.
call npm run dev -- --port %PORT% --strictPort

endlocal
