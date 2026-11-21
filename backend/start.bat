@echo off
REM Start MirrorFlix AniList Sync Service
REM This batch script installs dependencies and starts the FastAPI server

echo Starting MirrorFlix AniList Sync Service...
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed. Please install Python first.
    echo Download from: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo This will install dependencies first. This may take a few minutes...
echo.

REM Install dependencies
pip install -r requirements.txt -q

if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies.
    echo Please install manually: pip install -r requirements.txt
    pause
    exit /b 1
)

echo.
echo Starting the server on port 8002...
echo API documentation will be available at: http://127.0.0.1:8002/docs
echo Press Ctrl+C to stop the server.
echo.

python main.py

pause