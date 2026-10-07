// Pages Stream Deck des lives : une touche « Live » sur la page d'accueil, qui ouvre Gaming, Montage et Dev.
//
//   node streamdeck/generer.mjs            rend les icônes (streamdeck/icones/) et affiche les pages, n'écrit rien dans le Stream Deck
//   node streamdeck/generer.mjs --ecrire   ferme le logiciel Stream Deck, sauvegarde le profil, écrit nos pages, relance le logiciel
//
// Lit obs/seances.json (mêmes scènes, mêmes noms que les collections OBS). Les touches OBS passent par le module officiel
// d'Elgato (com.elgato.obsstudio), déjà relié à OBS par obs-websocket : la scène affichée s'allume, le micro coupé aussi.
// Seuls nos dossiers (identifiants fixes ci-dessous) sont réécrits ; les pages du client (météo, TikTok, Voicemod…) restent.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const ECRIRE = process.argv.includes('--ecrire');
const SD = path.join(process.env.APPDATA, 'Elgato', 'StreamDeck');
const LOGICIEL = 'C:\\Program Files\\Elgato\\StreamDeck\\StreamDeck.exe';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ICONES = path.join(ICI, 'icones');
const conf = JSON.parse(fs.readFileSync(path.join(RACINE, 'obs', 'seances.json'), 'utf8'));

// Identifiants stables : régénérer remplace nos pages au lieu d'en ajouter.
const uuidDe = (nom) => { const h = crypto.createHash('md5').update('live-streamdeck:' + nom).digest('hex'); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`.toUpperCase(); };
const imageDe = (nom) => crypto.createHash('md5').update('img:' + nom).digest('hex').toUpperCase().slice(0, 26) + 'Z.png';

// ---------- Icônes ----------
const aRendre = new Map();
function icone(id, params) { aRendre.set(id, params); return id; }
function rendreIcones() {
  fs.mkdirSync(ICONES, { recursive: true });
  for (const [id, p] of aRendre) {
    const sortie = path.join(ICONES, id + '.png');
    const url = pathToFileURL(path.join(ICI, 'icone.html')).href + '?' + new URLSearchParams(p).toString();
    execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', '--force-device-scale-factor=1',
      '--virtual-time-budget=1500', '--window-size=144,144', `--screenshot=${sortie}`, url], { stdio: 'ignore' });
    const png = fs.readFileSync(sortie);
    const [l, h] = [png.readUInt32BE(16), png.readUInt32BE(20)];
    if (l !== 144 || h !== 144) { execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', sortie, '-vf', 'crop=144:144:0:0', sortie + '.tmp.png']); fs.renameSync(sortie + '.tmp.png', sortie); }
  }
  console.log(aRendre.size, 'icônes rendues dans', ICONES);
}

// ---------- Actions ----------
const OBS = { Name: 'OBS Studio', UUID: 'com.elgato.obsstudio', Version: '3.0.3.31' };
const modeles = {}; // modules intégrés au Stream Deck, repris des pages existantes (nom et version exacts)
function action(uuid, nom, plugin, settings, images, etat = 0) {
  // Les actions intégrées au Stream Deck (dossier, retour, site) n'ont pas de champ Plugin : on reprend le modèle tel quel.
  if (!plugin && !modeles[uuid]) throw new Error(`Pas de modèle pour l'action ${uuid}`);
  const p = plugin ?? modeles[uuid].Plugin;
  return { ActionID: crypto.randomUUID(), LinkedTitle: true, Name: nom ?? modeles[uuid]?.Name ?? uuid, Plugin: p, Resources: null, Settings: settings, State: etat,
    States: images.map((img) => ({ Image: 'Images/' + imageDe(img), ShowTitle: false, Title: '' })), UUID: uuid, _images: images };
}
const retour = (m) => action('com.elgato.streamdeck.profile.backtoparent', null, null, {}, [icone(`retour-${m}`, { m, t: 'Retour', f: 'rond' })]);
const dossier = (m, id, texte, cible, p = '') => action('com.elgato.streamdeck.profile.openchild', null, null, { ProfileUUID: cible.toLowerCase() }, [icone(id, { m, t: texte, f: 'triangle', p })]);
const site = (m, id, texte, url) => action('com.elgato.streamdeck.system.website', null, null, { openInBrowser: true, path: url }, [icone(id, { m, t: texte, f: 'carre' })]);
const scene = (m, sc) => action('com.elgato.obsstudio.scene', 'Scene', OBS, { scene: sc.nom, target: 'program' },
  [icone(`scene-${m}-${sc.id}-${sc.nom}-on`, { m, t: sc.nom, e: 'actif', p: sc.touche.replace('Ctrl+Alt+', '') }), icone(`scene-${m}-${sc.id}-${sc.nom}`, { m, t: sc.nom, p: sc.touche.replace('Ctrl+Alt+', '') })], 1);
const muet = (m, id, source, texte, coupe) => action('com.elgato.obsstudio.mixeraudio', 'Mixer Audio', OBS, { source, type: 'mute', mode: 'toggle', isInMultiAction: false },
  [icone(`${id}-${m}`, { m, t: texte, f: 'rond' }), icone(`${id}-${m}-coupe`, { m, t: coupe, e: 'actif', f: 'rond' })]);
function charger(m, seance) {
  const routine = action('com.elgato.streamdeck.multiactions.routine', null, null, {}, [icone(`charger-${seance.id}`, { m, t: 'Charger\nla séance', f: 'losange', p: seance.id === 'dev' ? 'linedev' : 'Latshow' })]);
  const pas = (a) => { const { _images, ...propre } = a; propre.States = [{}, {}]; return { Actions: [propre] }; };
  routine.Actions = [
    pas(action('com.elgato.obsstudio.profile', 'Profile', OBS, { profile: seance.profil }, [], 1)),
    pas(action('com.elgato.obsstudio.scenecollection', 'Scene Collection', OBS, { collection: seance.nom }, [], 1)),
  ];
  return routine;
}

function pageSeance(seance) {
  const m = seance.marque;
  const sc = Object.fromEntries(seance.scenes.map((s) => [s.id, s]));
  const son = seance.id === 'gaming' ? ['Capture du jeu', 'Son du\njeu', 'Jeu\ncoupé'] : ['Son du PC', 'Son du\nPC', 'Son PC\ncoupé'];
  return {
    '0,0': retour(m), '1,0': scene(m, sc.demarrage), '2,0': scene(m, sc.principal), '3,0': scene(m, sc.secondaire), '4,0': scene(m, sc.discussion),
    '0,1': charger(m, seance), '1,1': scene(m, sc.pause), '2,1': scene(m, sc['pause-bebe']), '3,1': scene(m, sc.souci), '4,1': scene(m, sc.fin),
    '0,2': muet(m, 'micro', 'Micro', 'Micro', 'Micro\ncoupé'), '1,2': muet(m, 'son', son[0], son[1], son[2]),
    '2,2': action('com.elgato.obsstudio.replaybuffer.save', 'Replay Buffer Save', OBS, { isInMultiAction: false }, [icone(`garder-${m}`, { m, t: 'Garder\n60 s', f: 'losange', p: 'moment fort' })]),
    '3,2': action('com.elgato.obsstudio.record', 'Record', OBS, { isInMultiAction: false }, [icone(`enreg-${m}-on`, { m, t: 'Enreg.\nen cours', e: 'actif', f: 'rond' }), icone(`enreg-${m}`, { m, t: 'Enregis-\ntrer', f: 'rond' })], 1),
    '4,2': action('com.elgato.obsstudio.stream', 'Stream', OBS, { isInMultiAction: false, longpress: true }, [icone(`live-${m}-on`, { m, t: 'En\ndirect', e: 'actif', f: 'triangle', p: 'appui long' }), icone(`live-${m}`, { m, t: 'Live', f: 'triangle', p: 'appui long' })], 1),
  };
}

const PAGES = { racine: uuidDe('racine'), gaming: uuidDe('gaming'), montage: uuidDe('montage'), dev: uuidDe('dev') };
function construire() {
  const pages = { [PAGES.racine]: {
    '0,0': retour('latshow'),
    '1,0': dossier('latshow', 'dossier-gaming', 'Gaming', PAGES.gaming, 'Twitch + YT'),
    '2,0': dossier('latshow', 'dossier-montage', 'Montage', PAGES.montage, 'Twitch + YT'),
    '3,0': dossier('linedev', 'dossier-dev', 'Dev', PAGES.dev, 'YouTube'),
    '4,0': site('latshow', 'site-cockpit', 'Cockpit\nLive', 'http://localhost:3000/live'),
    '1,1': site('latshow', 'site-twitch', 'Twitch\ntableau', 'https://dashboard.twitch.tv/u/latshow/stream-manager'),
    '2,1': site('latshow', 'site-yt-latshow', 'YouTube\nLatshow', 'https://studio.youtube.com/channel/UCDMQOxCe9IdkQlsuuSQwXhg/livestreaming'),
    '3,1': site('linedev', 'site-yt-linedev', 'YouTube\nlinedev', 'https://studio.youtube.com/channel/UCxzv_XUVN-bGx9FCZNIxetA/livestreaming'),
    '4,1': site('latshow', 'site-se', 'Stream\nElements', 'https://streamelements.com/dashboard'),
  } };
  for (const s of conf.seances) pages[PAGES[s.id]] = pageSeance(s);
  return pages;
}

function trouverProfil() {
  const base = path.join(SD, 'ProfilesV3');
  const profils = fs.readdirSync(base).filter((d) => d.endsWith('.sdProfile'));
  if (profils.length !== 1) throw new Error(`${profils.length} profils Stream Deck : je ne sais pas lequel compléter`);
  const dir = path.join(base, profils[0]);
  const man = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  return { dir, accueil: man.Pages.Pages[0].toUpperCase() };
}

function chargerModeles(dir) {
  for (const p of fs.readdirSync(path.join(dir, 'Profiles'))) {
    const f = path.join(dir, 'Profiles', p, 'manifest.json');
    if (!fs.existsSync(f)) continue;
    for (const a of Object.values(JSON.parse(fs.readFileSync(f, 'utf8')).Controllers?.[0]?.Actions || {})) if (!modeles[a.UUID]) modeles[a.UUID] = { Plugin: a.Plugin, Name: a.Name };
  }
}

const enCours = () => { try { return execFileSync('tasklist', ['/FI', 'IMAGENAME eq StreamDeck.exe'], { encoding: 'utf8' }).includes('StreamDeck.exe'); } catch { return false; } };
const pause = (ms) => execFileSync('powershell', ['-NoProfile', '-Command', `Start-Sleep -Milliseconds ${ms}`]);
function poserImages(pdir, a) {
  fs.mkdirSync(path.join(pdir, 'Images'), { recursive: true });
  for (const img of a._images) fs.copyFileSync(path.join(ICONES, img + '.png'), path.join(pdir, 'Images', imageDe(img)));
  const { _images, ...propre } = a;
  return propre;
}

// ---------- Programme ----------
const { dir, accueil } = trouverProfil();
chargerModeles(dir);
const pages = construire();
const entree = dossier('latshow', 'entree-live', 'Live', PAGES.racine, 'Gaming · Dev');
rendreIcones();
for (const [uuid, touches] of Object.entries(pages)) console.log(uuid.slice(0, 8), Object.keys(touches).length, 'touches :', Object.values(touches).map((a) => a._images[a._images.length - 1]).join(', '));
if (!ECRIRE) { console.log('[simulation] rien n’est écrit dans le Stream Deck (ajoute --ecrire)'); process.exit(0); }

const accueilMan = path.join(dir, 'Profiles', accueil, 'manifest.json');
const am = JSON.parse(fs.readFileSync(accueilMan, 'utf8'));
const case00 = am.Controllers[0].Actions['0,0'];
if (case00 && case00.Settings?.ProfileUUID !== PAGES.racine.toLowerCase()) throw new Error('La case en haut à gauche de la page d’accueil est prise : je ne l’écrase pas');

// Le logiciel se réduit près de l'horloge au lieu de quitter : arrêt forcé (il enregistre chaque modification au fil de l'eau).
if (enCours()) { execFileSync('taskkill', ['/F', '/IM', 'StreamDeck.exe'], { stdio: 'ignore' }); for (let i = 0; i < 20 && enCours(); i++) pause(500); pause(3000); }
if (enCours()) throw new Error('Le logiciel Stream Deck ne se ferme pas : rien n’est écrit');

const sauvegarde = path.join(SD, '_sauvegarde_live', new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-'));
fs.mkdirSync(sauvegarde, { recursive: true });
fs.cpSync(dir, path.join(sauvegarde, path.basename(dir)), { recursive: true });
console.log('profil sauvegardé dans', sauvegarde);

for (const [uuid, touches] of Object.entries(pages)) {
  const pdir = path.join(dir, 'Profiles', uuid);
  fs.rmSync(pdir, { recursive: true, force: true });
  const actions = {};
  for (const [pos, a] of Object.entries(touches)) actions[pos] = poserImages(pdir, a);
  fs.writeFileSync(path.join(pdir, 'manifest.json'), JSON.stringify({ Controllers: [{ Actions: actions, Type: 'Keypad' }], Icon: '', Name: '' }));
}
am.Controllers[0].Actions['0,0'] = poserImages(path.join(dir, 'Profiles', accueil), entree);
fs.writeFileSync(accueilMan, JSON.stringify(am));
console.log('pages écrites ; touche Live posée en haut à gauche de la page d’accueil');
spawn(LOGICIEL, [], { detached: true, stdio: 'ignore' }).unref();
console.log('logiciel Stream Deck relancé');
