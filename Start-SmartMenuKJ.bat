@echo off
title SmartMenuKJ
echo ===============================================
echo    SmartMenuKJ - starting your website...
echo ===============================================
echo.
echo  Website : http://localhost:5173
echo  Admin   : http://localhost:5173/admin.html
echo.
echo  Keep this window open while using the site.
echo  Close this window to stop the server.
echo.
start "" http://localhost:5173
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
