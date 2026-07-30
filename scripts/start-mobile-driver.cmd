@echo off
setlocal

cd /d "%~dp0..\apps\mobile-driver"

echo Starting TOMP Driver app with Expo...
echo.
echo If Windows Firewall asks for permission, allow access on Private networks.
echo Keep this window open while testing on your phone.
echo.

npx.cmd expo start --lan --clear

endlocal
