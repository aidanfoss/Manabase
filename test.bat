@echo off
echo Starting Backend...
start cmd /k "cd backend && npm run start"

echo Starting Frontend in development mode...
start cmd /k "cd frontend && npm run dev"

echo Seeding test data if not present...
start cmd /k "cd backend && node seed-10-users.js"

echo Both services started!
