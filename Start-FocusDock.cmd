@echo off
cd /d "%~dp0"
rem Use Windows PowerShell 5.1 explicitly. PowerShell 7.6.x can crash at startup
rem in ShowUpdateNotification when the console width is narrow/redirected.
set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS%" set "PS=powershell.exe"
"%PS%" -NoProfile -NonInteractive -File "%~dp0scripts\Start-FocusDock.ps1"
if errorlevel 1 pause
