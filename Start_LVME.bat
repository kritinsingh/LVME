@echo off
title LVME Local Server Core
color 0d
echo ===========================================
echo       Starting LVME AI Backend Engine
echo ===========================================
echo.
cd /d "C:\Users\janma\OneDrive\Desktop\LVME\ai_backend"

IF EXIST "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
) ELSE (
    echo [WARNING] No venv found. Trying to run uvicorn globally.
)

start /b uvicorn main:app --host 127.0.0.1 --port 8000 --log-level warning

echo Loading local Universe...
timeout /t 3 /nobreak >nul

echo Starting Desktop Interface...
start "" "C:\Users\janma\OneDrive\Desktop\LVME\frontend\dist-electron\win-unpacked\LVME.exe"

echo.
echo ===========================================
echo  Application is running! 
echo  Do NOT close this window if you want to stay connected securely!
echo  Just minimize it. Close this window when you're done using LVME.
echo ===========================================
:: Keep window open
cmd /k
