// Refait les vidéos de la transition « Tuiles 3D » (une par marque) à partir de index.html.
//
//   node transitions/rendre.mjs [latshow|linedev]
//
// OBS garde ouvert le fichier de la collection chargée : il ne peut pas être remplacé tant qu'elle est ouverte
// (EPERM). Pour latshow, passer OBS sur « Live — Dev » ; pour linedev, sur « Live — Gaming » ; ou fermer OBS.
//
// Sortie : transitions/transition_latshow.webm et transition_linedev.webm (VP9 avec transparence, son Opus, 60 i/s),
// lues par la transition Stinger d'OBS (obs/generer.mjs). Polices et bruitages : transitions/medias/ (non versionnés,
// copiés de overlays/commun/polices et de D:\Stream\Dev\Assets\Sons, licence Pixabay).
// Après un nouveau rendu, OBS relit le fichier au prochain changement de collection (ou au redémarrage).
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const HYPERFRAMES = 'hyperframes@0.8.121'; // même version que le cockpit

const MARQUES = ['latshow', 'linedev'];
const demandees = process.argv[2] ? [process.argv[2]] : MARQUES;
if (demandees.some((m) => !MARQUES.includes(m))) { console.error(`marque inconnue : ${process.argv[2]} (latshow ou linedev)`); process.exit(1); }

let echecs = 0;
for (const marque of demandees) {
  const sortie = `transition_${marque}.webm`;
  console.log(`rendu ${sortie}…`);
  try {
    // shell: true pour trouver npx sous Windows ; d'où les guillemets échappés autour du JSON
    execFileSync('npx', ['--yes', HYPERFRAMES, 'render', '.', '--format', 'webm', '--fps', '60', '--quality', 'delivery',
      '--variables', `"${JSON.stringify({ marque }).replaceAll('"', '\\"')}"`, '-o', sortie, '--quiet'], { cwd: ICI, stdio: 'inherit', shell: true });
  } catch {
    echecs++;
    console.error(`ÉCHEC ${sortie} : si le message parle d'EPERM, OBS tient le fichier (voir l'en-tête de ce script).`);
  }
}
console.log(echecs ? `${echecs} rendu(s) en échec` : 'fini : changer de collection dans OBS pour qu’il relise les fichiers');
process.exit(echecs ? 1 : 0);
