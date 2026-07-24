@echo off
echo Starting Backend...
start cmd /k "cd backend && npm run start"

timeout /t 20000

echo Starting Frontend in development mode...
start cmd /k "cd frontend && npm run dev"

timeout /t 20

REM echo Seeding test data if not present...
REM start cmd /k "cd backend && node seed-10-users.js"

echo Both services started!
