@echo off
echo Starting Backend...
start cmd /k "cd backend && npm run start"

echo Starting Frontend...
start cmd /k "cd frontend && npm run dev"

echo Both services started!
