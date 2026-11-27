@echo off
chcp 65001 >nul
rem Rebranche le son TikTok (piste 6 d'OBS vers le câble VB-CABLE) sans avoir besoin de Claude.
rem À lancer OBS fermé, puis rouvrir OBS. Voir CLAUDE.md, « Image verticale (TikTok) ».
cd /d "%~dp0"
echo Son TikTok : verification...
echo.
node obs\regie.mjs son-tiktok
echo.
node obs\regie.mjs etat
echo.
echo Dans TikTok LIVE Studio, le micro doit etre « CABLE Output » (et rien d'autre).
pause
