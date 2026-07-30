@echo off
setlocal

cd /d "%~dp0..\apps\mobile-driver"

echo Starting TOMP Driver app with Expo tunnel...
echo.
echo Use this when Expo Go on iPhone cannot open the LAN URL.
echo Keep this window open while testing on your phone.
echo.

npx.cmd expo start --tunnel --clear

endlocal
