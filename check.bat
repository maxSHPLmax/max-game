@echo off
setlocal enabledelayedexpansion
set ERR=0

echo.
echo == Required files ==

for %%F in (
  index.html
  changelog.html
  changelog.js
  style.css
  favicon.svg
  og.png
  src\main.js
  src\site.js
  src\touch.js
  src\sprites.js
  src\levels.js
  src\save.js
  src\scenes\GameScene.js
  .github\workflows\telegram.yml
  .github\scripts\post-telegram.js
) do (
  if exist "%%F" (
    echo    ok       %%F
  ) else (
    echo    MISSING  %%F
    set ERR=1
  )
)

echo.
echo == Stray scripts in root ==

set STRAY=0
for %%F in (*.js) do (
  if /I not "%%~nxF"=="changelog.js" (
    echo    STRAY    %%F  - belongs in src
    set ERR=1
    set STRAY=1
  )
)
if "!STRAY!"=="0" echo    clean

echo.
set VER=
for /f "tokens=2 delims='" %%V in ('findstr /C:"version: '" changelog.js') do (
  if not defined VER set VER=%%V
)
echo == changelog version: !VER! ==

echo.
if "!ERR!"=="1" (
  echo    CHECK FAILED
  exit /b 1
)
echo    all good
exit /b 0
