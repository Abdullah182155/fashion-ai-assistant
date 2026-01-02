#!/bin/bash

# Fashion AI Chatbot - Run Script
# Starts both backend and frontend servers

echo "============================================================"
echo "🎨 FASHION AI CHATBOT - STARTING SERVERS"
echo "============================================================"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Check if we're in the right directory
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Start Backend
echo ""
echo "🚀 Starting Backend (port 8000)..."
cd backend
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: backend/.env not found. Copying from .env.example"
    cp .env.example .env
    echo "   Please edit backend/.env and add your GEMINI_API_KEY"
fi

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

python -m uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# Wait for backend to initialize
echo "   Waiting for backend to start..."
sleep 5

# Start Frontend
echo ""
echo "🚀 Starting Frontend (port 3000)..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "   Installing dependencies..."
    npm install
fi

if [ ! -f ".env" ]; then
    cp .env.example .env
fi

npm start &
FRONTEND_PID=$!
cd ..

echo ""
echo "============================================================"
echo "✅ SERVERS RUNNING"
echo "============================================================"
echo ""
echo "   Frontend:  http://localhost:3000"
echo "   Backend:   http://localhost:8000"
echo "   API Docs:  http://localhost:8000/docs"
echo ""
echo "   Press Ctrl+C to stop both servers"
echo ""
echo "============================================================"

# Wait for processes
wait $BACKEND_PID $FRONTEND_PID
