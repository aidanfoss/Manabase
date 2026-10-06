@echo off
set NODE_ENV=development
set ENABLE_DEV_LOGIN=true
echo Starting Backend...
start cmd /k "cd backend && npm.cmd run start"

timeout /t 2

echo Starting Frontend in development mode...
start cmd /k "cd frontend && npm.cmd run dev"

timeout /t 2

REM echo Seeding test data if not present...
REM start cmd /k "cd backend && node seed-10-users.js"

echo Both services started!