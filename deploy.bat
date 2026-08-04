@echo off
setlocal

call check.bat
if errorlevel 1 (
    echo.
    echo Deploy cancelled. Fix the list above first.
    pause
    exit /b 1
)

echo.
echo == Pulling from GitHub ==
git pull --no-edit origin main
if errorlevel 1 (
    echo.
    echo Merge failed. Sort it out manually, then run again.
    pause
    exit /b 1
)

echo.
set /p msg="Commit message: "
if "%msg%"=="" (
    echo Empty message, aborting.
    pause
    exit /b 1
)

git add -A
git commit -m "%msg%"

echo.
echo == Pushing ==
git push origin main
if errorlevel 1 (
    echo.
    echo ================================================
    echo  PUSH FAILED. See the error above.
    echo ================================================
    pause
    exit /b 1
)

echo.
echo Done. Site updates in 1-2 min.
echo If changelog.js changed, Telegram post goes out automatically.
pause
