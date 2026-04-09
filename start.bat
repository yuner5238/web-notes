@echo off
chcp 65001 > nul
title WebNotes

echo.
echo  =======================================
echo   WebNotes 启动中...
echo  =======================================
echo.

echo  [服务器] 启动 Express + 前端 (port 3001)...
start "WebNotes-Server" cmd /k "cd /d %~dp0\server && node index.js"

echo.
echo  服务启动中...
echo.
echo  请在浏览器中打开 http://localhost:3001
start http://localhost:3001
pause
