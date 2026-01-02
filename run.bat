@echo off
REM Fashion AI Chatbot - Run Script for Windows
REM Starts both backend and frontend servers

echo ============================================================
echo 🎨 FASHION AI CHATBOT - STARTING SERVERS
echo ============================================================

REM Check if we're in the right directory
if not exist "backend" (
    echo ❌ Error: Please run this script from the project root directory
    exit /b 1
)

REM Start Backend in new window
echo.
echo 🚀 Starting Backend (port 8000)...
start "Fashion AI Backend" cmd /k "cd backend && python -m uvicorn app.main:app --reload --port 8000"

REM Wait for backend to start
echo    Waiting for backend to initialize...
timeout /t 5 /nobreak >nul

REM Start Frontend in new window
echo.
echo 🚀 Starting Frontend (port 3000)...
start "Fashion AI Frontend" cmd /k "cd frontend && npm install && npm start"

echo.
echo ============================================================
echo ✅ SERVERS STARTING
echo ============================================================
echo.
echo    Frontend:  http://localhost:3000
echo    Backend:   http://localhost:8000
echo    API Docs:  http://localhost:8000/docs
echo.
echo    Close the server windows to stop
echo.
echo ============================================================
