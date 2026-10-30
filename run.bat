@echo off
rem Starts a local server for Office Live and opens it in the browser.
cd /d "%~dp0"
start "" http://localhost:8080
python tools\serve.py 8080
