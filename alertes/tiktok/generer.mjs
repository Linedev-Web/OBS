// Fabrique les pages d'alertes TikTok (latshow.html, linedev.html) à partir du widget StreamElements : même balisage,
// même style (widget.css), même moteur (widget.js), plus le branchement TikFinity (tiktok.js). Une page par marque,
// en 1080 × 1920, à poser comme source navigateur dans le canevas vertical d'OBS.
//
//   node alertes/tiktok/generer.mjs
//
// Essai sans TikFinity : ouvrir la page avec ?essai=1.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SE = path.join(ICI, '..', 'streamelements');
// Où l'alerte arrive dans l'image verticale, réduite pour tenir dans 1080 px. Latshow : sous la caméra et son bandeau,
// en haut du jeu. linedev : sur la caméra, pour ne jamais cacher le code (essai du 2026-10-08 : sur le code, la plaque
// sombre se confondait avec l'éditeur).
const VERTICAL = { latshow: { haut: 600, echelle: 0.84 }, linedev: { haut: 110, echelle: 0.84 } };
// Jingles maison (alertes/sons) par type d'alerte du moteur.
const SONS = {
  latshow: { follow: 'follow', sub: 'sub', resub: 'resub', tip: 'tip', raid: 'raid' },
  linedev: { follow: 'linedev-abonne', sub: 'linedev-membre', resub: 'linedev-membre', tip: 'linedev-tip', raid: 'linedev-superchat' },
};

for (const marque of ['latshow', 'linedev']) {
  const champs = JSON.parse(fs.readFileSync(path.join(SE, marque, 'fields.json'), 'utf8'));
  const reglages = Object.fromEntries(Object.entries(champs).filter(([cle, c]) => c.value !== undefined && !cle.startsWith('son')).map(([cle, c]) => [cle, c.value]));
  Object.assign(reglages, { haut: VERTICAL[marque].haut, filtrer: false });
  for (const [cle, fichier] of Object.entries(SONS[marque])) reglages[`son_${cle}`] = `../sons/${fichier}.mp3`;

  const balisage = fs.readFileSync(path.join(SE, marque, 'widget.html'), 'utf8').trim();
  const page = `<!doctype html>
<!-- Généré par alertes/tiktok/generer.mjs : ne pas modifier à la main. Alertes TikTok ${marque}, 1080 × 1920. -->
<html lang="fr"><head><meta charset="utf-8"><title>Alertes TikTok — ${marque}</title>
<link rel="stylesheet" href="../streamelements/${marque}/widget.css">
<style>
  html, body { width: 1080px; height: 1920px; }
  .alerte { scale: ${VERTICAL[marque].echelle}; }
</style>
</head><body>
${balisage}
<script>window.REGLAGES_TIKTOK = ${JSON.stringify(reglages)};</script>
<script src="../streamelements/latshow/widget.js"></script>
<script src="tiktok.js"></script>
</body></html>
`;
  fs.writeFileSync(path.join(ICI, `${marque}.html`), page);
  console.log(`écrit alertes/tiktok/${marque}.html`);
}
