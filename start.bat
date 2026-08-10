@echo off
setlocal
cd /d "%~dp0"

echo.
echo  ============================================
echo   BoxManage - inventura krabic s QR kody
echo  ============================================
echo.

if not exist "boxmanage\server\node_modules" (
    echo [1/3] Instaluji server (npm install)...
    cd boxmanage\server
    call npm install
    if errorlevel 1 goto err
    cd ..\..
)

if not exist "boxmanage\web\node_modules" (
    echo [2/3] Instaluji web (npm install)...
    cd boxmanage\web
    call npm install
    if errorlevel 1 goto err
    cd ..\..
)

if not exist "boxmanage\web\dist\index.html" (
    echo [3/3] Sestavuji web (npm run build)...
    cd boxmanage\web
    call npm run build
    if errorlevel 1 goto err
    cd ..\..
)

echo.
echo  Spoustim aplikaci na http://localhost:8090
echo  Prihlaseni: admin / admin  (zmen v Nastaveni)
echo  Pro ukonceni zavri toto okno (Ctrl+C).
echo.
start "" "http://localhost:8090"

cd boxmanage\server
node src\index.js
goto end

:err
echo.
echo  Chyba! Zavreni aplikace.
pause
:end
endlocal
