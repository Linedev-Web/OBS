# Audio de Windows pour la régie (obs/regie.mjs) : périphériques actifs, périphériques par défaut, choix de la sortie.
#
#   -Action lister             JSON { sorties: [{id, nom}], entrees: [{id, nom}], defaut: { sortie, communication } }
#   -Action choisir -Id <id>   fait de cette sortie celle de Windows (son, multimédia, communications), puis liste
#
# Les identifiants sont ceux qu'OBS donne aux périphériques : « {0.0.0.00000000}.{guid} » (sortie),
# « {0.0.1.00000000}.{guid} » (entrée). La partie compilée (obs/audio-windows.cs) est mise en cache une fois pour toutes.
param(
  [ValidateSet('lister', 'choisir')][string]$Action = 'lister',
  [string]$Id
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$source = Join-Path $PSScriptRoot 'audio-windows.cs'
$empreinte = (Get-FileHash $source -Algorithm SHA256).Hash.Substring(0, 12)
$dll = Join-Path $env:LOCALAPPDATA "stream-regie\RegieAudio-$empreinte.dll"
if (-not (Test-Path $dll)) {
  New-Item -ItemType Directory -Force (Split-Path $dll) | Out-Null
  Add-Type -Path $source -OutputAssembly $dll -OutputType Library
}
if (-not ('RegieAudio.Defaut' -as [type])) { Add-Type -Path $dll }

function Peripheriques([string]$sens, [string]$prefixe) {
  Get-ChildItem "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\$sens" | ForEach-Object {
    if ((Get-ItemProperty $_.PSPath).DeviceState -eq 1) {
      $p = Get-ItemProperty (Join-Path $_.PSPath 'Properties')
      $nom = $p.'{a45c254e-df1c-4efd-8020-67d146a850e0},2'
      $carte = $p.'{b3f8fa53-0004-438e-9003-51a46e139bfc},6'
      [pscustomobject]@{ id = "$prefixe$($_.PSChildName)"; nom = $(if ($carte) { "$nom ($carte)" } else { $nom }) }
    }
  }
}

if ($Action -eq 'choisir') {
  if (-not $Id) { throw 'Indique la sortie à choisir (-Id).' }
  $resultat = [RegieAudio.Defaut]::Choisir($Id)
  if ($resultat -ne 0) { throw "Windows a refusé ce périphérique (code $resultat)." }
}

[pscustomobject]@{
  sorties = @(Peripheriques 'Render' '{0.0.0.00000000}.')
  entrees = @(Peripheriques 'Capture' '{0.0.1.00000000}.')
  defaut  = [pscustomobject]@{ sortie = [RegieAudio.Defaut]::Lire(0, 0); communication = [RegieAudio.Defaut]::Lire(0, 2) }
} | ConvertTo-Json -Compress -Depth 4
