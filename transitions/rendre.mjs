// Refait les vidéos des transitions de scène des lives.
//
//   node transitions/rendre.mjs [latshow|linedev]        « Tuiles 3D » (index.html), une par marque
//   node transitions/rendre.mjs gaming|dev|roblox|papa   « Coup de moustache » (moustache.html), une par univers ;
//                                                        `papa` rend les trois
//
// Sans argument : les deux « Tuiles 3D », comme avant.
//
// OBS garde ouvert le fichier de la collection chargée : il ne peut pas être remplacé tant qu'elle est ouverte
// (EPERM). OBS fermé, ou sur une collection de l'autre marque choisie par le client. Ne pas changer de collection par
// obs-websocket : le 2026-10-16, OBS s'est figé en déchargeant Live — Gaming. Pour remplacer le fichier pendant que sa
// collection est ouverte, voir la ligne `transitions\` de CLAUDE.md (passer par un fichier provisoire).
//
// Sorties (VP9 avec transparence, son Opus, 60 i/s, 1,5 s), lues par la transition Stinger d'OBS (obs/generer.mjs) :
// - transition_latshow.webm et transition_linedev.webm (Tuiles 3D) ;
// - transition_gaming_papa.webm, transition_dev_papa.webm et transition_roblox_papa.webm (Coup de moustache, refonte
//   « papa » du 2026-11-08).
// Polices et bruitages : transitions/medias/ (copiés de overlays/commun/polices et de D:\Stream\Dev\Assets\Sons, licence
// Pixabay ; frisottis.mp3 fait maison, commande dans l'en-tête de moustache.html ; seules les polices sont versionnées).
// Après un nouveau rendu, OBS relit le fichier au prochain changement de collection (ou au redémarrage).
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const HYPERFRAMES = 'hyperframes@0.8.121'; // même version que le cockpit

const MARQUES = ['latshow', 'linedev'];
const UNIVERS = ['gaming', 'dev', 'roblox'];
const tuiles = (marque) => ({ sortie: `transition_${marque}.webm`, options: [], variables: { marque } });
const moustache = (univers) => ({ sortie: `transition_${univers}_papa.webm`, options: ['-c', 'moustache.html', '--strict-variables'],
  variables: { univers } });

const demande = process.argv[2];
let rendus;
if (!demande) rendus = MARQUES.map(tuiles);
else if (MARQUES.includes(demande)) rendus = [tuiles(demande)];
else if (UNIVERS.includes(demande)) rendus = [moustache(demande)];
else if (demande === 'papa') rendus = UNIVERS.map(moustache);
else { console.error(`inconnu : ${demande} (latshow, linedev, gaming, dev, roblox ou papa)`); process.exit(1); }

let echecs = 0;
for (const { sortie, options, variables } of rendus) {
  console.log(`rendu ${sortie}…`);
  try {
    // shell: true pour trouver npx sous Windows ; d'où les guillemets échappés autour du JSON
    execFileSync('npx', ['--yes', HYPERFRAMES, 'render', '.', ...options, '--format', 'webm', '--fps', '60', '--quality', 'delivery',
      '--variables', `"${JSON.stringify(variables).replaceAll('"', '\\"')}"`, '-o', sortie, '--quiet'], { cwd: ICI, stdio: 'inherit', shell: true });
  } catch {
    echecs++;
    console.error(`ÉCHEC ${sortie} : si le message parle d'EPERM, OBS tient le fichier (voir l'en-tête de ce script).`);
  }
}
console.log(echecs ? `${echecs} rendu(s) en échec` : 'fini : changer de collection dans OBS pour qu’il relise les fichiers');
process.exit(echecs ? 1 : 0);
