@echo off
echo Nextream Local Development Setup
echo ================================
echo.

REM Step 1: Install dependencies for backend
echo Step 1: Installing backend dependencies...
cd onstream\api
call npm install
echo Backend dependencies installed.
echo.

REM Step 2: Set up images for backend
echo Step 2: Setting up images for backend...
call npm run setup-images
echo Images set up for backend.
echo.

REM Step 3: Install dependencies for client
echo Step 3: Installing client dependencies...
cd ..\..\nextream-client
call npm install
echo Client dependencies installed.
echo.

REM Step 4: Install dependencies for admin
echo Step 4: Installing admin dependencies...
cd ..\nextream-admin
call npm install
echo Admin dependencies installed.
echo.

REM Step 5: Copy environment files if they don't exist
echo Step 5: Setting up environment files...

REM Backend
if not exist "..\onstream\api\.env" (
  copy ..\onstream\api\.env.development ..\onstream\api\.env
  echo Created .env file for backend.
)

REM Client
if not exist "..\nextream-client\.env.local" (
  copy ..\nextream-client\.env.development ..\nextream-client\.env.local
  echo Created .env.local file for client.
)

REM Admin
if not exist "..\nextream-admin\.env.local" (
  copy ..\nextream-admin\.env.development ..\nextream-admin\.env.local
  echo Created .env.local file for admin.
)

echo Environment files set up.
echo.

echo Setup complete! You can now start the applications:
echo 1. Backend: cd onstream\api ^&^& npm run dev
echo 2. Client: cd nextream-client ^&^& npm run dev
echo 3. Admin: cd nextream-admin ^&^& npm run dev
echo.
echo Happy coding!

pause 