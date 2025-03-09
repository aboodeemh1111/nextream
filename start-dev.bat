@echo off
echo Nextream Development Startup
echo ============================
echo.

REM Start the backend
start cmd /k "cd onstream\api && npm run dev"

REM Wait a moment for the backend to start
timeout /t 5

REM Start the client
start cmd /k "cd nextream-client && npm run dev"

REM Start the admin
start cmd /k "cd nextream-admin && npm run dev"

echo All components started in development mode.
echo Close the command windows to stop the servers.
echo.

echo Backend: http://localhost:8800
echo Client: http://localhost:3000
echo Admin: http://localhost:3001
echo.

echo Happy coding! 