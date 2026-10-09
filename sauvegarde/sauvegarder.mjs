// Sauvegarde de la configuration des lives qui vit hors de D:\Stream (OBS et Stream Deck, dans AppData), pour tout
// retrouver sur un nouveau PC (demande du client, 2026-10-08 : « pour ne rien perdre si un jour je change de PC »).
//
//   node sauvegarde/sauvegarder.mjs      refait la copie dans sauvegarde/ ; à relancer après chaque changement dans OBS
//                                        ou le Stream Deck, puis commit et push
//
// Les secrets n'y entrent jamais : clé de stream, adresses des alertes StreamElements et du chat (elles contiennent une
// clé), mots de passe, jetons. Ils sont vidés, et inventaire.json dit lesquels reposer (marche à suivre : RESTAURER.md).
// Le script s'arrête sans rien laisser si un secret reconnaissable reste dans la copie.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const OBS = path.join(process.env.APPDATA, 'obs-studio');
const SD = path.join(process.env.APPDATA, 'Elgato', 'StreamDeck');
const OBS_PROGRAMME = 'C:\\Program Files\\obs-studio';
const PROFILS = ['Live_Latshow', 'Live_linedev'];
const COLLECTIONS = ['Live_Gaming.json', 'Live_Montage.json', 'Live_Dev.json', 'Plateau.json'];
// Modules livrés avec OBS : tout le reste a été ajouté et doit être réinstallé sur un nouveau PC.
const MODULES_OBS = new Set(['aja-output-ui', 'aja', 'chrome_elf', 'coreaudio-encoder', 'decklink-captions', 'decklink-output-ui', 'decklink',
  'frontend-tools', 'image-source', 'libEGL', 'libGLESv2', 'libcef', 'nv-filters', 'obs-browser', 'obs-ffmpeg', 'obs-filters', 'obs-nvenc',
  'obs-outputs', 'obs-qsv11', 'obs-text', 'obs-transitions', 'obs-vst', 'obs-webrtc', 'obs-websocket', 'obs-x264', 'rtmp-services',
  'text-freetype2', 'vlc-video', 'win-capture', 'win-dshow', 'win-wasapi', 'sentry-wer']);
const CHAMP_SECRET = /password|token|secret/i;
const LIGNE_SECRETE = /key=|token|password|secret/i;
// Ce qui ne doit jamais sortir de ce PC : vérifié sur toute la copie avant de la garder.
const SECRETS = [
  { quoi: 'clé de stream Twitch', motif: /live_\d{6,}_[A-Za-z0-9]{10,}/ },
  { quoi: 'adresse d’un overlay StreamElements', motif: /streamelements\.com\/overlay\/[0-9a-f]{24}\/[A-Za-z0-9_-]{8,}/ },
  { quoi: 'session Social Stream Ninja', motif: /socialstream\.ninja\/[^"\s]*\?[^"\s]{20,}/ },
  { quoi: 'mot de passe obs-websocket', motif: /"server_password"\s*:\s*"[^"]+"/ },
];

const lireJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
const ecrire = (relatif, contenu) => {
  const chemin = path.join(ICI, relatif);
  fs.mkdirSync(path.dirname(chemin), { recursive: true });
  fs.writeFileSync(chemin, typeof contenu === 'string' ? contenu : `${JSON.stringify(contenu, null, 2)}\n`);
};
const aReposer = [];

/** Vide les adresses web non locales des sources navigateur et tout champ secret, en notant quoi reposer. */
function nettoyerCollection(collection, nomFichier) {
  const nettoyer = (valeur) => {
    if (Array.isArray(valeur)) return valeur.map(nettoyer);
    if (!valeur || typeof valeur !== 'object') return valeur;
    return Object.fromEntries(Object.entries(valeur).map(([cle, v]) => [cle, CHAMP_SECRET.test(cle) && typeof v === 'string' && v ? '' : nettoyer(v)]));
  };
  const sources = collection.sources.map((source) => {
    const url = source.settings?.url;
    if (typeof url !== 'string' || !/^https?:/i.test(url)) return source;
    const hote = new URL(url).hostname;
    if (hote === 'localhost' || hote === '127.0.0.1') return source;
    aReposer.push({ ou: `OBS, collection ${nomFichier}, source « ${source.name} »`, quoi: `adresse ${hote}` });
    return { ...source, settings: { ...source.settings, url: '' } };
  });
  return nettoyer({ ...collection, sources });
}

function copierObs() {
  for (const fichier of COLLECTIONS) {
    ecrire(path.join('obs', 'scenes', fichier), nettoyerCollection(lireJson(path.join(OBS, 'basic', 'scenes', fichier)), fichier));
  }
  // La référence des périphériques (caméra, micro, jeu, Discord, chat) lue par obs/generer.mjs.
  const reference = path.join('_archives_live', 'Plateau_reference.json');
  ecrire(path.join('obs', 'scenes', reference), nettoyerCollection(lireJson(path.join(OBS, 'basic', 'scenes', reference)), 'Plateau_reference.json'));

  for (const profil of PROFILS) {
    const dossier = path.join(OBS, 'basic', 'profiles', profil);
    for (const fichier of ['basic.ini', 'streamEncoder.json', 'recordEncoder.json']) {
      if (fs.existsSync(path.join(dossier, fichier))) ecrire(path.join('obs', 'profiles', profil, fichier), fs.readFileSync(path.join(dossier, fichier), 'utf8'));
    }
    const service = lireJson(path.join(dossier, 'service.json'));
    if (service.settings?.key) aReposer.push({ ou: `OBS, profil ${profil}, Paramètres → Stream`, quoi: 'clé de stream' });
    ecrire(path.join('obs', 'profiles', profil, 'service.json'), { ...service, settings: { ...service.settings, key: '' } });
  }

  for (const fichier of ['global.ini', 'user.ini']) {
    const lignes = fs.readFileSync(path.join(OBS, fichier), 'utf8').split(/\r?\n/).map((ligne) => {
      const egal = ligne.indexOf('=');
      if (egal < 0 || !LIGNE_SECRETE.test(ligne.slice(egal + 1))) return ligne;
      aReposer.push({ ou: `OBS, ${fichier}`, quoi: `réglage ${ligne.slice(0, egal)}` });
      return ligne.slice(0, egal + 1);
    });
    ecrire(path.join('obs', fichier), lignes.join('\n'));
  }
}

// Réglages des modules ajoutés (image verticale, multistream, son TikTok) : leurs clés de stream sont vidées.
const MODULES_REGLES = ['vertical-canvas', 'aitum-multistream', 'audio-monitor'];
const CHAMP_CLE = /(?:^|_)key$|password|token|secret/i;
function copierModules() {
  for (const module of MODULES_REGLES) {
    const fichier = path.join(OBS, 'plugin_config', module, 'config.json');
    if (!fs.existsSync(fichier)) continue;
    const vider = (valeur) => {
      if (Array.isArray(valeur)) return valeur.map(vider);
      if (!valeur || typeof valeur !== 'object') return valeur;
      return Object.fromEntries(Object.entries(valeur).map(([cle, v]) => {
        if (!CHAMP_CLE.test(cle) || typeof v !== 'string' || !v) return [cle, vider(v)];
        aReposer.push({ ou: `OBS, module ${module}`, quoi: `réglage ${cle}` });
        return [cle, ''];
      }));
    };
    ecrire(path.join('obs', 'plugin_config', module, 'config.json'), vider(lireJson(fichier)));
  }
}

function copierStreamDeck() {
  const destination = path.join(ICI, 'streamdeck', 'ProfilesV3');
  fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(path.join(SD, 'ProfilesV3'), destination, { recursive: true });
}

function modulesStreamDeck() {
  const dossier = path.join(SD, 'Plugins');
  if (!fs.existsSync(dossier)) return [];
  return fs.readdirSync(dossier).filter((d) => d.endsWith('.sdPlugin')).map((d) => {
    try {
      const m = lireJson(path.join(dossier, d, 'manifest.json'));
      return { dossier: d, nom: m.Name, version: m.Version, auteur: m.Author };
    } catch {
      return { dossier: d };
    }
  });
}

function versionDe(exe) {
  try {
    return execFileSync('powershell', ['-NoProfile', '-Command', `(Get-Item '${exe}').VersionInfo.ProductVersion`], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function verifierSecrets(dossier) {
  const trouves = [];
  const parcourir = (d) => {
    for (const entree of fs.readdirSync(d, { withFileTypes: true })) {
      const chemin = path.join(d, entree.name);
      if (entree.isDirectory()) parcourir(chemin);
      else if (/\.(json|ini|md|txt)$/i.test(entree.name)) {
        const texte = fs.readFileSync(chemin, 'utf8');
        for (const { quoi, motif } of SECRETS) if (motif.test(texte)) trouves.push(`${path.relative(ICI, chemin)} : ${quoi}`);
      }
    }
  };
  parcourir(dossier);
  return trouves;
}

copierObs();
copierModules();
copierStreamDeck();
const modules = fs.readdirSync(path.join(OBS_PROGRAMME, 'obs-plugins', '64bit')).filter((f) => f.endsWith('.dll')).map((f) => f.slice(0, -4));
const modulesUtilisateur = fs.existsSync(path.join(OBS, 'plugins')) ? fs.readdirSync(path.join(OBS, 'plugins')) : [];
ecrire('inventaire.json', {
  sauvegarde_le: new Date().toISOString(),
  obs: {
    version: versionDe(path.join(OBS_PROGRAMME, 'bin', '64bit', 'obs64.exe')),
    modules_ajoutes: modules.filter((m) => !MODULES_OBS.has(m)),
    modules_utilisateur: modulesUtilisateur,
    profils: PROFILS,
    collections: COLLECTIONS,
  },
  streamdeck: { version: versionDe('C:\\Program Files\\Elgato\\StreamDeck\\StreamDeck.exe'), modules: modulesStreamDeck() },
  a_reposer: aReposer,
});

const fuites = verifierSecrets(ICI);
if (fuites.length) {
  for (const sous of ['obs', 'streamdeck', 'inventaire.json']) fs.rmSync(path.join(ICI, sous), { recursive: true, force: true });
  console.error(`Secret retrouvé dans la copie, sauvegarde effacée :\n  ${fuites.join('\n  ')}`);
  process.exit(1);
}
console.log(`Sauvegarde faite dans ${ICI} : ${COLLECTIONS.length} collections, ${PROFILS.length} profils, Stream Deck, inventaire.`);
console.log(`À reposer à la main sur un nouveau PC (vidés de la copie) : ${aReposer.length}`);
for (const { ou, quoi } of aReposer) console.log(`  - ${ou} : ${quoi}`);
