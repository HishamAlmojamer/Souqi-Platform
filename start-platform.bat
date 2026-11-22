@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install the current LTS version from https://nodejs.org/
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Reinstall Node.js with npm included, then try again.
  pause
  exit /b 1
)

if not exist "node_modules\expo\package.json" (
  echo Installing project dependencies...
  call npm ci
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

echo Starting Souqi in the web browser...
call npm run web
if errorlevel 1 (
  echo The platform stopped with an error.
  pause
  exit /b 1
)
