@echo off
title Uploading App to GitHub...
color 0b
echo ===========================================
echo       Uploading LVME Code to GitHub
echo ===========================================
echo.
cd /d "C:\Users\janma\OneDrive\Desktop\LVME"

git remote remove origin 2>nul
git remote add origin https://github.com/kritinsingh/LVME.git

echo Sending files...
echo (A GitHub Sign In popup may appear. Please log in if asked!)
git push -u origin main

echo.
echo ===========================================
echo Upload Finished! You can close this window.
echo Go back to your browser and refresh the GitHub page!
echo ===========================================
pause
