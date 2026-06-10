@echo off
title SpectraStrike Hub - Unified WLED, WiZ & OpenRGB Hub
echo =============================================================
echo            SPECTRASTRIKE HUB STARTUP UTILITY
echo =============================================================
echo.

:: Check for Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in your PATH.
    echo Please install Python 3.10+ and try again.
    pause
    exit /b 1
)

:: Check for Node.js / NPM
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in your PATH.
    echo Please install Node.js 18+ and try again.
    pause
    exit /b 1
)

echo [INFO] Installing / Updating Python dependencies...
python -m pip install -r backend\requirements.txt
if %errorlevel% neq 0 (
    echo [WARNING] Direct requirements install failed. Attempting manual installation of key packages...
    python -m pip install fastapi uvicorn mss Pillow mcp requests httpx openrgb-python winsdk
)

echo.
echo [INFO] Installing / Updating Frontend npm packages...
cd frontend
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
)
cd ..

echo.
echo =============================================================
echo   [SUCCESS] Dependencies verified.
echo   SpectraStrike Hub is starting up!
echo.
echo   - FastAPI Backend will run at: http://localhost:8000
echo   - React Dev Server will run at:  http://localhost:5173
echo.
echo   Open http://localhost:5173 in your browser to view the app!
echo.
echo   To connect Claude Desktop or other client to the MCP server,
echo   add this server configuration:
echo   Command: python
echo   Args: C:\Users\aayus\.gemini\antigravity-ide\scratch\wled-wiz-hub\backend\mcp_server.py
echo =============================================================
echo.

:: Launch React Dev Server in a separate window
echo [INFO] Launching React Dev Server in a new window...
start cmd /k "title SpectraStrike Hub React Dev Server && cd frontend && npm run dev"

:: Launch FastAPI Backend in current window
echo [INFO] Launching FastAPI Backend...
python backend\main.py

pause
