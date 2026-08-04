@echo off
setlocal
set /p msg="Commit message: "
if "%msg%"=="" (
    echo Message is empty, aborting.
    pause
    exit /b 1
)
git add .
git commit -m "%msg%"
git push origin main
echo.
echo Pushed. GitHub Pages updates in 1-2 min.
pause