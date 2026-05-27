@echo off
cd /d "%~dp0..\apps\server"
call node_modules\.bin\tsx.cmd src\server.ts
