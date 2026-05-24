@echo off
setlocal enabledelayedexpansion

REM ============================================================================
REM  Crypt Crawlers - Windows dev server launcher (LAN + optional public tunnel)
REM  ---------------------------------------------------------------------------
REM  1. Verifies Node.js + npm are on PATH.
REM  2. Runs `npm install` if node_modules is missing.
REM  3. Scans TCP ports 5173..5200 for the first free one.
REM  4. Detects every LAN IPv4 address on this machine.
REM  5. Asks whether to start a public tunnel via npx localtunnel so the
REM     game can be reached from outside your network (no router config).
REM  6. Launches Vite bound to 0.0.0.0 so any device on your LAN can connect.
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

REM --- 4. List every LAN IPv4 address on this machine ------------------------
echo.
echo ------------------------------------------------------------
echo   LAN access (any device on the same Wi-Fi / wired LAN):
echo ------------------------------------------------------------
echo     http://localhost:%PORT%/
REM ipconfig prints lines like "   IPv4 Address. . . . . . . . : 192.168.1.42".
REM /R "IPv4.*:" matches localized variants like "IPv4-Adresse" too.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R "IPv4.*:"') do (
  set ADDR=%%a
  set ADDR=!ADDR: =!
  if not "!ADDR!"=="" (
    echo     http://!ADDR!:%PORT%/
  )
)

REM --- 5. Optional public tunnel via npx localtunnel -------------------------
echo.
echo ------------------------------------------------------------
echo   Public access (from outside your home network)
echo ------------------------------------------------------------
echo   Option A: Port-forward TCP %PORT% on your router to this
echo            machine, then share http://YOUR-WAN-IP:%PORT%/
echo            (look up YOUR-WAN-IP at https://ifconfig.me).
echo   Option B: Start a public tunnel via npx localtunnel.
echo            A free public https URL is printed in a new
echo            window. No router config required.
echo ------------------------------------------------------------

choice /c YN /n /m "  Start a public tunnel via localtunnel now? (Y/N): "
if errorlevel 2 (
  set TUNNEL=0
) else (
  set TUNNEL=1
)

if "%TUNNEL%"=="1" (
  REM Launch the tunnel in its own window so the user can see the public
  REM URL it prints. The 3-second wait gives Vite time to bind first.
  start "Crypt Crawlers - Public Tunnel" cmd /k ^
    "echo Starting public tunnel via npx localtunnel ... ^
     && echo This window prints the public https URL. ^
     && echo Press Ctrl-C here to stop sharing. ^
     && timeout /t 3 /nobreak >nul ^
     && npx --yes localtunnel --port %PORT%"
  echo.
  echo [TUNNEL] A new window is starting the public tunnel.
  echo          Watch that window for the https URL to share.
)

echo.
echo ------------------------------------------------------------
echo   Starting Vite on port %PORT% (bound to 0.0.0.0)
echo   Press Ctrl-C in this window to stop the server.
echo ------------------------------------------------------------
echo.

REM --- 6. Launch the dev server, bound to every interface --------------------
REM --host 0.0.0.0 = listen on all network adapters (LAN + tunnels)
REM --strictPort   = fail loudly if something grabbed the port between scan and now
call npm run dev -- --host 0.0.0.0 --port %PORT% --strictPort

endlocal
