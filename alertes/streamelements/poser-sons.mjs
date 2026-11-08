// Pose les sons « papa » dans les widgets StreamElements (fields.json : valeur par défaut, data.json : valeur réglée), une
// fois les fichiers déposés sur le CDN de StreamElements et leurs adresses notées dans ../sons/sons-papa.json (« cdn » :
// { "<son>": "https://cdn.streamelements.com/uploads/<id>.mp3" }). Table type d'alerte → son : bloc « streamelements ».
//
//   node alertes/streamelements/poser-sons.mjs            simulation : ce qui changerait, ce qui manque encore
//   node alertes/streamelements/poser-sons.mjs --ecrire   écrit fields.json et data.json des deux marques (tout ou rien)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const TABLE = JSON.parse(fs.readFileSync(path.join(ICI, '..', 'sons', 'sons-papa.json'), 'utf8'));
const ECRIRE = process.argv.includes('--ecrire');
const ADRESSE_CDN = /^https:\/\/cdn\.streamelements\.com\/uploads\/[\w-]+\.mp3$/;

const lire = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const manquants = new Set();
const changements = [];
const fichiers = [];

for (const [marque, table] of Object.entries(TABLE.streamelements)) {
  const cheminChamps = path.join(ICI, marque, 'fields.json');
  const cheminDonnees = path.join(ICI, marque, 'data.json');
  const champs = lire(cheminChamps);
  const donnees = lire(cheminDonnees);
  for (const [type, son] of Object.entries(table)) {
    const cle = `son_${type}`;
    if (!champs[cle]) throw new Error(`${marque}/fields.json : pas de champ ${cle}`);
    const adresse = son ? TABLE.cdn[son] : '';
    if (son && !ADRESSE_CDN.test(adresse || '')) { manquants.add(`${son}.mp3`); continue; }
    if (champs[cle].value !== adresse || donnees[cle] !== adresse) changements.push(`${marque} ${cle} ← ${son || '(aucun son)'}`);
    champs[cle].value = adresse;
    donnees[cle] = adresse;
  }
  fichiers.push([cheminChamps, champs], [cheminDonnees, donnees]);
}

if (changements.length) console.log(changements.join('\n'));
else if (!manquants.size) console.log('Rien à changer.');
if (manquants.size) {
  console.log(`\nAdresse CDN manquante (sons-papa.json, « cdn ») pour : ${[...manquants].join(', ')}`);
  console.log('Rien n\'est écrit tant qu\'il en manque une.');
  process.exit(ECRIRE ? 1 : 0);
}
if (!ECRIRE) {
  console.log('\nSimulation : relancer avec --ecrire pour écrire fields.json et data.json.');
} else {
  for (const [chemin, contenu] of fichiers) fs.writeFileSync(chemin, JSON.stringify(contenu, null, 2));
  console.log('\nÉcrit : latshow/ et linedev/ (fields.json, data.json).');
}
