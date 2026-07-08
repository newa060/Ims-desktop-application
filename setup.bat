@echo off
echo ================================================
echo   Inventory Management System - Setup Script
echo ================================================
echo.

echo [1/5] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo ✓ Dependencies installed
echo.

echo [2/5] Setting up environment...
if not exist .env (
    copy .env.example .env
    echo ✓ Environment file created
) else (
    echo ✓ Environment file already exists
)
echo.

echo [3/5] Generating Prisma client...
call npm run prisma:generate
if %errorlevel% neq 0 (
    echo ERROR: Failed to generate Prisma client
    pause
    exit /b 1
)
echo ✓ Prisma client generated
echo.

echo [4/5] Running database migrations...
echo Note: When prompted for migration name, type: init
call npm run prisma:migrate
if %errorlevel% neq 0 (
    echo ERROR: Failed to run migrations
    pause
    exit /b 1
)
echo ✓ Database migrated
echo.

echo [5/5] Seeding database...
call npx ts-node src/database/seed.ts
if %errorlevel% neq 0 (
    echo ERROR: Failed to seed database
    pause
    exit /b 1
)
echo ✓ Database seeded
echo.

echo ================================================
echo   Setup completed successfully!
echo ================================================
echo.
echo Default login credentials:
echo   Admin: admin@system.com / admin123
echo   Manager: manager@system.com / manager123
echo   Cashier: cashier@system.com / cashier123
echo.
echo To start the application, run: npm run dev
echo.
pause
