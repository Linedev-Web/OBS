# Touche « Ouvrir les applis » de la page Live du Stream Deck : ouvre ce dont un live a besoin, sans rien lancer en double.
#
#   powershell -NoProfile -File streamdeck/lancer-applis.ps1 -Simulation   dit ce qu'il ouvrirait, ne lance rien
#
# Le Stream Deck le lance sans fenêtre (conhost --headless, voir streamdeck/generer.mjs). Une application déjà ouverte
# est reconnue par le nom de son processus, visible même quand elle tourne en administrateur comme OBS. OBS ne doit
# jamais être lancé une seconde fois : la seconde instance s'ouvre en mode sans échec et réécrit la collection sans ses
# modules (incident du 2026-10-07). D'où aussi le verrou : deux appuis rapprochés pendant que Windows demande l'accord
# pour OBS (exécution en administrateur) ne lancent qu'un OBS. Accord refusé : les autres applications s'ouvrent quand même.
# Compte rendu du dernier appui : %TEMP%\lancer-applis.log.
param([switch]$Simulation)

$applis = @(
  @{ Nom = 'OBS Studio'; Processus = @('obs64'); Chemin = 'C:\Program Files\obs-studio\bin\64bit\obs64.exe' }
  # Le lanceur ouvre « TikTok LIVE Studio.exe » rangé dans un dossier à son numéro de version (1.37.4…) : on passe par lui.
  @{ Nom = 'TikTok LIVE Studio'; Processus = @('TikTok LIVE Studio', 'TikTok LIVE Studio Launcher'); Chemin = 'C:\Program Files\TikTok LIVE Studio\TikTok LIVE Studio Launcher.exe' }
  @{ Nom = 'TikFinity'; Processus = @('TikFinity'); Chemin = "$env:LOCALAPPDATA\Programs\tikfinity\TikFinity.exe" }
  @{ Nom = 'Social Stream Ninja'; Processus = @('socialstream'); Chemin = "$env:LOCALAPPDATA\Programs\socialstream\socialstream.exe" }
)

function Ouvrir($appli) {
  if (Get-Process -Name $appli.Processus -ErrorAction SilentlyContinue) { return "$($appli.Nom) : déjà ouvert" }
  if (-not (Test-Path $appli.Chemin)) { return "$($appli.Nom) : introuvable ($($appli.Chemin))" }
  if ($Simulation) { return "$($appli.Nom) : serait ouvert" }
  try {
    # Dossier de travail = celui du programme : lancé d'ailleurs, OBS ne trouve pas ses fichiers de langue.
    Start-Process -FilePath $appli.Chemin -WorkingDirectory (Split-Path $appli.Chemin)
    return "$($appli.Nom) : ouvert"
  } catch {
    return "$($appli.Nom) : échec ($($_.Exception.Message))"
  }
}

$verrou = New-Object System.Threading.Mutex($false, 'Local\StreamDeck-OuvrirLesApplis')
if (-not $verrou.WaitOne(0)) { 'Un appui précédent est encore en cours : rien de plus.'; exit }
try {
  $journal = @("Appui du $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')") + ($applis | ForEach-Object { Ouvrir $_ })
  $journal | Set-Content -Path (Join-Path $env:TEMP 'lancer-applis.log') -Encoding UTF8
  $journal
} finally {
  $verrou.ReleaseMutex()
}
