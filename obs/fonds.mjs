// Photos de fond des écrans d'attente (habillage « papa », demande du client du 2026-11-08) : démarrage, pause, pause
// enfant et fin tirent une photo au hasard à chaque affichage (overlays/commun/papa.js). Une page locale ne peut pas lire
// un dossier : ce script en écrit la liste dans overlays/fonds.js.
//
//   node obs/fonds.mjs      à relancer après avoir ajouté ou retiré une photo dans fonds\<univers>\<écran>\
//
// Univers : gaming (lives gaming et montage), dev, roblox. Écrans : demarrage, pause, pause-enfant, fin (le souci
// technique reprend les photos de la pause). Photos : 2560 × 1440 de préférence, crédits dans fonds\credits.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..', 'fonds');
const SORTIE = path.join(ICI, '..', 'overlays', 'fonds.js');
export const UNIVERS = ['gaming', 'dev', 'roblox'];
export const ECRANS = ['demarrage', 'pause', 'pause-enfant', 'fin'];
const IMAGE = /\.(jpe?g|png|webp)$/i;

/** Les photos de chaque univers et de chaque écran, en chemins relatifs à une page de overlays\<marque>\. */
export function lister(racine = RACINE) {
  const liste = {};
  for (const univers of UNIVERS) {
    liste[univers] = {};
    for (const ecran of ECRANS) {
      let fichiers = [];
      try {
        fichiers = fs.readdirSync(path.join(racine, univers, ecran)).filter((nom) => IMAGE.test(nom)).sort();
      } catch {
        // dossier absent : pas de photo, l'écran garde la couleur de son ambiance
      }
      liste[univers][ecran] = fichiers.map((nom) => `../../fonds/${univers}/${ecran}/${encodeURIComponent(nom)}`);
    }
  }
  return liste;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const liste = lister();
  fs.writeFileSync(SORTIE, `// Écrit par obs/fonds.mjs : ne pas modifier à la main.\nwindow.FONDS = ${JSON.stringify(liste)};\n`);
  for (const univers of UNIVERS) console.log(`${univers.padEnd(7)} ${ECRANS.map((e) => `${e} ${liste[univers][e].length}`).join(' · ')}`);
  console.log(`Écrit : ${path.relative(path.join(ICI, '..'), SORTIE)}`);
}
