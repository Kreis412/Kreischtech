@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -File "%~dp0SETUP_API_KEY.ps1"
if errorlevel 1 pause
