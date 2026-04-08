@echo off
chcp 65001 > nul
title WebNotes

echo.
echo  =======================================
echo   WebNotes 启动中...
echo  =======================================
echo.
echo  [后端] 启动 Express 服务器 (port 3001)...
start "WebNotes-Server" cmd /k "cd /d %~dp0 && node server\index.js"

echo.
echo  [前端] 启动 Vite 开发服务器 (port 5173)...
start "WebNotes-Frontend" cmd /k "cd /d %~dp0\frontend && npm run dev"

echo.
echo  服务启动中...
echo.
echo  欢迎使用 WebNotes!
echo.
echo  请在浏览器中打开 http://localhost:5173
start http://localhost:5173
pause
