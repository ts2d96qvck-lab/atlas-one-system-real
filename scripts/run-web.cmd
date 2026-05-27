@echo off
cd /d "%~dp0..\apps\web"
call node_modules\.bin\next.cmd dev -H 0.0.0.0 -p 3001
