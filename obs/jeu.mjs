// Jeu du live (demande du client, 2026-10-30) : la bannière du jeu dans l'image verticale, entre la caméra et le jeu,
// avec le score quand il y en a un.
//
// Le jeu vient du titre posé par la page Live du cockpit (overlays/live.js, séance gaming) ; le Stream Deck peut en
// choisir un autre en plein live (/jeu/choisir, /jeu/suivant) jusqu'au prochain changement de titre dans le cockpit.
// Score : automatique pour Valorant (présence du client Riot, lue sur 127.0.0.1, rien n'est lu dans le jeu) ; à la main
// pour tous les jeux par le Stream Deck (/jeu/score?cote=moi|adv&ajout=1|-1, /jeu/score/remise). Une correction à la
// main pendant une partie de Valorant fige le score automatique jusqu'à la partie suivante.
//
//   node obs/jeu.mjs               service local http://127.0.0.1:21311 (lancé par OBS, obs/soutiens.lua)
//   node obs/jeu.mjs --presence    la partie de Valorant lue dans le client Riot (--brut : la présence entière)
//
// Écrit overlays/jeu.js (relu par overlays/commun/jeu.js) et obs/jeu-session.json, non versionnés.
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connecterObs } from './obs-websocket.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SESSION = path.join(ICI, 'jeu-session.json');
const POUR_LES_ECRANS = path.join(ICI, '..', 'overlays', 'jeu.js');
const LIVE = path.join(ICI, '..', 'overlays', 'live.js');
const LOCKFILE = path.join(process.env.LOCALAPPDATA ?? '', 'Riot Games', 'Riot Client', 'Config', 'lockfile');
const VALORANT_MS = 2000;
const LIVE_MS = 2000;
const SCORE_MAX = 99;
const PORT = 21311;
const RECONNEXION_MS = 5000;
const OBS_ABSENT_MAX_MS = 120_000;

/** Les jeux préparés, dans l'ordre du bouton « jeu suivant ». `motif` reconnaît le titre écrit dans le cockpit. */
export const JEUX = [
  { id: 'valorant', nom: 'Valorant', motif: /valo/i },
  { id: 'roblox', nom: 'Roblox', motif: /roblox/i },
  { id: 'no-mans-sky', nom: "No Man's Sky", motif: /no\s*man|nms/i },
  { id: 'rocket-league', nom: 'Rocket League', motif: /rocket/i },
  { id: 'euro-truck', nom: 'Euro Truck Simulator 2', motif: /euro\s*truck|ets\s*2/i },
  { id: 'arc-raiders', nom: 'Arc Raiders', motif: /arc\s*raider/i },
];

/** Le jeu reconnu dans un titre du cockpit, ou null (bannière générique au nom du titre). */
export function jeuDuTitre(titre) {
  return JEUX.find((j) => j.motif.test(String(titre ?? '')))?.id ?? null;
}

// Noms de code des cartes et des files de Valorant (présence du client Riot), en français quand le jeu les traduit.
const CARTES = {
  ascent: 'Ascent', bonsai: 'Split', duality: 'Bind', port: 'Icebox', foxtrot: 'Breeze', canyon: 'Fracture',
  triad: 'Haven', pitt: 'Pearl', jam: 'Lotus', juliett: 'Sunset', infinity: 'Abyss', rook: 'Corrode',
  range: 'Champ de tir', poveglia: 'Champ de tir', hurm_alley: 'District', hurm_yard: 'Piazza', hurm_bowl: 'Kasbah',
  hurm_helix: 'Drift', hurm_hightide: 'Glitch',
};
const FILES = {
  competitive: 'Compétition', unrated: 'Non classé', swiftplay: 'Swiftplay', spikerush: 'Spike Rush',
  deathmatch: 'Combat à mort', hurm: 'Combat à mort par équipe', premier: 'Premier', ggteam: 'Escalade',
  onefa: 'Réplication', snowball: 'Bataille de boules de neige', '': 'Partie personnalisée',
};
const SANS_SCORE_EQUIPE = new Set(['deathmatch']);

// ---------- État ----------

const etatVide = () => ({ titre: '', choix: null, score: { moi: 0, adv: 0 }, scoreManuel: false, scoreVisible: false, valorant: null });
function lireEtat() {
  try { return { ...etatVide(), ...JSON.parse(fs.readFileSync(SESSION, 'utf8')) }; } catch { return etatVide(); }
}
let etat = lireEtat();

function ecrireAtomique(fichier, texte) {
  fs.writeFileSync(`${fichier}.tmp`, texte);
  fs.renameSync(`${fichier}.tmp`, fichier);
}

/** Ce que les écrans affichent : le jeu, son nom, le score s'il y en a un, et le détail (carte, mode). */
export function pourLesEcrans(e = etat) {
  const id = e.choix ?? jeuDuTitre(e.titre);
  const jeu = JEUX.find((j) => j.id === id);
  const v = id === 'valorant' ? e.valorant : null;
  const auto = Boolean(v?.enPartie && !e.scoreManuel && v.score);
  const score = auto ? v.score : (e.scoreManuel || e.scoreVisible ? e.score : null);
  return {
    jeu: id,
    nom: jeu?.nom ?? (e.titre || ''),
    score,
    source: score ? (auto ? 'auto' : 'manuel') : null,
    detail: v?.enPartie ? [v.carte, v.mode].filter(Boolean).join(' · ') : '',
  };
}

let dernierPublie = '';
function publier() {
  const texte = JSON.stringify(pourLesEcrans());
  ecrireAtomique(SESSION, JSON.stringify(etat, null, 2));
  if (texte === dernierPublie) return;
  dernierPublie = texte;
  ecrireAtomique(POUR_LES_ECRANS, `window.JEU = ${texte};\n`);
}

// ---------- Commandes (Stream Deck) ----------

const borne = (n) => Math.max(0, Math.min(SCORE_MAX, n));

/** Applique une commande ; renvoie l'état pour les écrans, ou null si la commande est inconnue. */
export function commander(chemin, params) {
  const affiche = pourLesEcrans();
  switch (chemin) {
    case '/jeu':
      return affiche;
    case '/jeu/score': {
      const cote = params.get('cote');
      const ajout = Math.trunc(Number(params.get('ajout') ?? 1));
      if (!['moi', 'adv'].includes(cote) || !Number.isFinite(ajout)) return null;
      // On part de ce qui est affiché (le score automatique compris), puis on le fige à la main.
      const depart = affiche.score ?? etat.score;
      etat = { ...etat, scoreManuel: true, scoreVisible: true, score: { ...depart, [cote]: borne(depart[cote] + ajout) } };
      break;
    }
    case '/jeu/score/remise':
      etat = { ...etat, score: { moi: 0, adv: 0 }, scoreManuel: false, scoreVisible: false };
      break;
    case '/jeu/score/zero':
      etat = { ...etat, score: { moi: 0, adv: 0 }, scoreManuel: true, scoreVisible: true };
      break;
    case '/jeu/choisir': {
      const id = params.get('jeu');
      if (!JEUX.some((j) => j.id === id)) return null;
      etat = { ...etat, choix: id, ...(id !== affiche.jeu ? { score: { moi: 0, adv: 0 }, scoreManuel: false, scoreVisible: false } : {}) };
      break;
    }
    case '/jeu/suivant': {
      const i = JEUX.findIndex((j) => j.id === affiche.jeu);
      etat = { ...etat, choix: JEUX[(i + 1) % JEUX.length].id, score: { moi: 0, adv: 0 }, scoreManuel: false, scoreVisible: false };
      break;
    }
    case '/jeu/cockpit':
      etat = { ...etat, choix: null };
      break;
    default:
      return null;
  }
  publier();
  return pourLesEcrans();
}

// ---------- Titre du cockpit ----------

function lireTitreDuCockpit() {
  try {
    const texte = fs.readFileSync(LIVE, 'utf8');
    const json = texte.slice(texte.indexOf('{'), texte.lastIndexOf('}') + 1);
    return String(JSON.parse(json)?.gaming?.titre ?? '');
  } catch { return null; }
}
function suivreLeCockpit() {
  const titre = lireTitreDuCockpit();
  if (titre === null || titre === etat.titre) return;
  // Nouveau jeu choisi dans le cockpit : il reprend la main sur le Stream Deck, le score repart à zéro.
  etat = { ...etat, titre, choix: null, score: { moi: 0, adv: 0 }, scoreManuel: false, scoreVisible: false };
  publier();
}

// ---------- Valorant (présence du client Riot) ----------

function lireLockfile() {
  try {
    const [, , port, motDePasse] = fs.readFileSync(LOCKFILE, 'utf8').split(':');
    return port && motDePasse ? { port, motDePasse } : null;
  } catch { return null; }
}

// Le client Riot répond en https sur 127.0.0.1 avec un certificat à lui : vérification limitée à cette adresse locale.
const agentLocal = new https.Agent({ rejectUnauthorized: false });
function demanderAuClient(acces, chemin) {
  return new Promise((ok) => {
    const req = https.get({
      host: '127.0.0.1', port: acces.port, path: chemin, agent: agentLocal, timeout: 1500,
      headers: { Authorization: `Basic ${Buffer.from(`riot:${acces.motDePasse}`).toString('base64')}` },
    }, (res) => {
      let corps = '';
      res.on('data', (m) => { corps += m; });
      res.on('end', () => { try { ok(res.statusCode === 200 ? JSON.parse(corps) : null); } catch { ok(null); } });
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => ok(null));
  });
}

/** Première valeur d'une clé qui répond au motif, à n'importe quelle profondeur (le format de la présence change selon les versions). */
export function chercher(objet, motif) {
  if (!objet || typeof objet !== 'object') return undefined;
  for (const [cle, valeur] of Object.entries(objet)) {
    if (motif.test(cle) && (valeur === null || typeof valeur !== 'object')) return valeur;
  }
  for (const valeur of Object.values(objet)) {
    const trouve = chercher(valeur, motif);
    if (trouve !== undefined) return trouve;
  }
  return undefined;
}

/** La partie lue dans la présence Valorant décodée : en partie ou non, carte, mode, score de ton équipe et de l'adverse. */
export function lirePartie(presence) {
  const boucle = String(chercher(presence, /^sessionLoopState$/) ?? '');
  const carteBrute = String(chercher(presence, /^matchMap$/) ?? '');
  const file = String(chercher(presence, /^queueId$/) ?? '').toLowerCase();
  const codeCarte = carteBrute.split('/').filter(Boolean).pop()?.toLowerCase() ?? '';
  const moi = Number(chercher(presence, /ScoreAllyTeam$/));
  const adv = Number(chercher(presence, /ScoreEnemyTeam$/));
  const avecScore = Number.isFinite(moi) && Number.isFinite(adv) && !SANS_SCORE_EQUIPE.has(file);
  return {
    enPartie: boucle === 'INGAME',
    carte: CARTES[codeCarte] ?? (codeCarte ? codeCarte[0].toUpperCase() + codeCarte.slice(1) : ''),
    mode: boucle === 'INGAME' ? (FILES[file] ?? file) : '',
    score: avecScore ? { moi: borne(moi), adv: borne(adv) } : null,
  };
}

let puuid = null;
async function suivreValorant() {
  const acces = lireLockfile();
  let partie = null;
  if (acces) {
    puuid ??= (await demanderAuClient(acces, '/chat/v1/session'))?.puuid ?? null;
    const presences = puuid ? (await demanderAuClient(acces, '/chat/v4/presences'))?.presences : null;
    const mienne = presences?.find((p) => p.puuid === puuid && p.product === 'valorant');
    if (mienne?.private) {
      try { partie = lirePartie(JSON.parse(Buffer.from(mienne.private, 'base64').toString('utf8'))); } catch { /* présence illisible */ }
    }
  } else puuid = null;
  const avant = etat.valorant;
  // Nouvelle partie (on entre en jeu, ou le score repart de 0-0) : la correction à la main ne vaut plus.
  const nouvelle = partie?.enPartie && (!avant?.enPartie || (partie.score && partie.score.moi + partie.score.adv === 0 && (avant.score?.moi ?? 0) + (avant.score?.adv ?? 0) > 0));
  etat = { ...etat, valorant: partie, ...(nouvelle ? { scoreManuel: false } : {}) };
  publier();
}

/** Démarre le suivi (cockpit et Valorant). */
export function demarrerJeu() {
  dernierPublie = '';
  suivreLeCockpit();
  publier();
  setInterval(suivreLeCockpit, LIVE_MS);
  const boucle = async () => { try { await suivreValorant(); } finally { setTimeout(boucle, VALORANT_MS); } };
  boucle();
}

// ---------- Service ----------

/** Service local http://127.0.0.1:21311 : le Stream Deck appelle les adresses /jeu… en GET (action « Site web », en arrière-plan). */
function lancerLeService() {
  const serveur = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const adresse = new URL(req.url, 'http://127.0.0.1');
    const reponse = req.method === 'GET' ? commander(adresse.pathname.replace(/\/$/, ''), adresse.searchParams) : null;
    res.writeHead(reponse ? 200 : 404, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(reponse));
  });
  serveur.on('error', (erreur) => {
    if (erreur.code === 'EADDRINUSE') { console.log('déjà lancé'); process.exit(0); }
    throw erreur;
  });
  serveur.listen(PORT, '127.0.0.1', () => { console.log(`jeu du live : http://127.0.0.1:${PORT}/jeu`); demarrerJeu(); });
  // Arrêt quand OBS est fermé depuis 2 minutes (comme le service des soutiens).
  let obsVuLe = Date.now();
  const suivreObs = async () => {
    const obs = await connecterObs(3000, { surFermeture: () => setTimeout(suivreObs, RECONNEXION_MS) });
    if (obs) { obsVuLe = Date.now(); return; }
    if (Date.now() - obsVuLe > OBS_ABSENT_MAX_MS) { console.log('OBS est fermé : arrêt du service'); process.exit(0); }
    setTimeout(suivreObs, RECONNEXION_MS);
  };
  suivreObs();
}

const lanceDirectement = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (lanceDirectement && !process.argv.includes('--presence')) lancerLeService();

// node obs/jeu.mjs --presence : affiche la partie lue dans le client Riot (vérification pendant une partie).
if (lanceDirectement && process.argv.includes('--presence')) {
  const acces = lireLockfile();
  if (!acces) { console.log('client Riot fermé'); process.exit(0); }
  const id = (await demanderAuClient(acces, '/chat/v1/session'))?.puuid;
  const mienne = (await demanderAuClient(acces, '/chat/v4/presences'))?.presences?.find((p) => p.puuid === id && p.product === 'valorant');
  if (!mienne?.private) { console.log('Valorant pas lancé'); process.exit(0); }
  const brut = JSON.parse(Buffer.from(mienne.private, 'base64').toString('utf8'));
  console.log(JSON.stringify(lirePartie(brut)));
  if (process.argv.includes('--brut')) console.log(JSON.stringify(brut, null, 1));
}
