// Soutiens du live (demande du client, 2026-10-09) : qui a suivi, s'est abonné ou a fait un don pendant le live, sur
// Twitch, YouTube et TikTok, pour ses écrans (bandeau au-dessus de la caméra, bandeau vertical, écrans de fin).
//
//   node obs/soutiens.mjs            service local, lancé par OBS (obs/soutiens.lua) : http://127.0.0.1:21310
//   node obs/soutiens.mjs --essai    ajoute des soutiens d'exemple à la liste (pour voir les écrans)
//   node obs/soutiens.mjs --remise   remet la liste à zéro
//
// Sources : les widgets d'alertes StreamElements (Twitch, YouTube) envoient chaque événement en POST /soutien (et la
// session au chargement) ; TikTok arrive de TikFinity (ws://127.0.0.1:21213). La liste repart de zéro au démarrage du
// live (obs-websocket), ou si elle date de plus de 6 h (live TikTok seul). Elle est gardée dans
// obs/soutiens-session.json et donnée aux écrans par overlays/soutiens.js (relu toutes les 2 s, comme live.js) ; ces
// deux fichiers ne sont pas versionnés. Le service s'arrête de lui-même quand OBS est fermé depuis 2 minutes.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connecterObs } from './obs-websocket.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SESSION = path.join(ICI, 'soutiens-session.json');
const POUR_LES_ECRANS = path.join(ICI, '..', 'overlays', 'soutiens.js');
const PORT = 21310;
const TIKFINITY = 'ws://127.0.0.1:21213';
const PLATEFORMES = new Set(['twitch', 'youtube', 'tiktok']);
const GENRES = new Set(['follow', 'abonnement', 'don']);
const NOM_MAX = 32;
const LISTE_MAX = 300;
const SESSION_PERIMEE_MS = 6 * 3600_000;
const OBS_ABSENT_MAX_MS = 120_000;
const RECONNEXION_MS = 5000;
const ABONNEMENT_SORTIES = 64; // obs-websocket : catégorie « Outputs » (StreamStateChanged)

// ---------- Session ----------

const vide = () => ({ debut: new Date().toISOString(), liste: [] });
function lire() {
  try {
    const s = JSON.parse(fs.readFileSync(SESSION, 'utf8'));
    return Array.isArray(s.liste) && s.debut ? s : vide();
  } catch { return vide(); }
}
let session = lire();

function ecrireAtomique(fichier, texte) {
  fs.writeFileSync(`${fichier}.tmp`, texte);
  fs.renameSync(`${fichier}.tmp`, fichier);
}
function publier() {
  ecrireAtomique(SESSION, JSON.stringify(session, null, 2));
  ecrireAtomique(POUR_LES_ECRANS, `window.SOUTIENS = ${JSON.stringify({ debut: session.debut, liste: session.liste })};\n`);
}

function remettreAZero(raison) {
  session = vide();
  publier();
  console.log(`liste remise à zéro (${raison})`);
}

/** Un soutien propre, ou null : plateforme et genre connus, pseudo sans caractère de contrôle, 32 caractères au plus. */
function nettoyer(brut) {
  const s = brut && typeof brut === 'object' ? brut : {};
  const plateforme = String(s.plateforme ?? '').toLowerCase();
  const genre = String(s.genre ?? '').toLowerCase();
  const nom = String(s.nom ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, NOM_MAX);
  if (!PLATEFORMES.has(plateforme) || !GENRES.has(genre) || !nom) return null;
  const montant = Number(s.montant);
  const quand = Date.parse(s.quand) ? new Date(s.quand).toISOString() : new Date().toISOString();
  return {
    plateforme, genre, nom,
    ...(Number.isFinite(montant) && montant > 0 ? { montant: Math.round(montant * 100) / 100 } : {}),
    ...(typeof s.devise === 'string' && /^[A-Za-z]{1,10}$/.test(s.devise) ? { devise: s.devise.toUpperCase() } : {}),
    quand,
  };
}

/** Ajoute un soutien : une personne n'apparaît qu'une fois par plateforme et par genre (les dons s'additionnent). */
function ajouter(brut) {
  const s = nettoyer(brut);
  if (!s) return false;
  if (Date.parse(s.quand) < Date.parse(session.debut)) return false; // reprise d'une session plus ancienne
  const deja = session.liste.find((x) => x.plateforme === s.plateforme && x.genre === s.genre && x.nom.toLowerCase() === s.nom.toLowerCase());
  if (deja) {
    if (s.genre !== 'don' || !s.montant) return false;
    deja.montant = Math.round(((deja.montant ?? 0) + s.montant) * 100) / 100;
  } else {
    session.liste.push(s);
    session.liste.sort((a, b) => Date.parse(a.quand) - Date.parse(b.quand));
    if (session.liste.length > LISTE_MAX) session.liste.splice(0, session.liste.length - LISTE_MAX);
  }
  return true;
}

// ---------- Commandes ponctuelles ----------

const EXEMPLES = [
  { plateforme: 'twitch', genre: 'follow', nom: 'Kev_92' },
  { plateforme: 'tiktok', genre: 'follow', nom: 'marie.92' },
  { plateforme: 'youtube', genre: 'abonnement', nom: 'Lucas Martin' },
  { plateforme: 'twitch', genre: 'don', nom: 'Nina', montant: 5, devise: 'EUR' },
  { plateforme: 'tiktok', genre: 'don', nom: 'Tom', montant: 30, devise: 'DIAMANTS' },
  { plateforme: 'twitch', genre: 'abonnement', nom: 'PixelSam' },
  { plateforme: 'youtube', genre: 'follow', nom: 'Chloé' },
  { plateforme: 'tiktok', genre: 'follow', nom: 'gamer_du_93' },
];
if (process.argv.includes('--remise')) { remettreAZero('demande'); process.exit(0); }
if (process.argv.includes('--essai')) {
  const n = Number(process.argv[process.argv.indexOf('--essai') + 1]) || EXEMPLES.length;
  for (let i = 0; i < n; i++) {
    const modele = EXEMPLES[i % EXEMPLES.length];
    ajouter({ ...modele, nom: i < EXEMPLES.length ? modele.nom : `${modele.nom}_${i}` });
  }
  publier();
  console.log(`${session.liste.length} soutiens dans la liste (essai).`);
  process.exit(0);
}

// ---------- Service ----------

if (Date.now() - Date.parse(session.debut) > SESSION_PERIMEE_MS) remettreAZero('dernière session de plus de 6 h');
else publier();

function recevoir(message) {
  if (message?.type === 'soutien') return ajouter(message);
  if (message?.type === 'session' && Array.isArray(message.liste)) return message.liste.map((s) => ajouter(s)).some(Boolean);
  return false;
}

const serveur = http.createServer((req, res) => {
  // Les widgets StreamElements sont des pages https : réponse CORS et accès au réseau local autorisés.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  if (req.method === 'GET' && req.url === '/soutiens') { res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(session)); return; }
  if (req.method !== 'POST' || req.url !== '/soutien') { res.writeHead(404).end(); return; }
  let corps = '';
  req.on('data', (morceau) => { corps += morceau; if (corps.length > 64_000) req.destroy(); });
  req.on('end', () => {
    let change = false;
    try { change = recevoir(JSON.parse(corps)); } catch { /* corps illisible : ignoré */ }
    if (change) publier();
    res.writeHead(204).end();
  });
});
serveur.on('error', (erreur) => {
  if (erreur.code === 'EADDRINUSE') { console.log('déjà lancé'); process.exit(0); }
  throw erreur;
});
serveur.listen(PORT, '127.0.0.1', () => console.log(`soutiens du live : http://127.0.0.1:${PORT}`));

// TikTok, par TikFinity : follow, abonnement, cadeau (compté à la fin d'une rafale).
function soutienTikTok(evenement) {
  const d = evenement?.data ?? {};
  const u = d.user ?? {};
  const nom = d.nickname || u.nickname || d.uniqueId || u.uniqueId;
  switch (evenement?.event) {
    case 'follow': return { plateforme: 'tiktok', genre: 'follow', nom };
    case 'subscribe': return { plateforme: 'tiktok', genre: 'abonnement', nom };
    case 'gift': {
      const g = d.gift ?? {};
      if (Number(d.giftType ?? g.giftType) === 1 && !d.repeatEnd) return null;
      const diamants = (Number(d.diamondCount ?? g.diamondCount) || 0) * Math.max(1, Number(d.repeatCount) || 1);
      return { plateforme: 'tiktok', genre: 'don', nom, montant: diamants, devise: 'DIAMANTS' };
    }
    default: return null;
  }
}
function brancherTikFinity() {
  let ws;
  try { ws = new WebSocket(TIKFINITY); } catch { setTimeout(brancherTikFinity, RECONNEXION_MS); return; }
  ws.onmessage = (ev) => {
    let evenement;
    try { evenement = JSON.parse(ev.data); } catch { return; }
    const s = soutienTikTok(evenement);
    if (s && ajouter(s)) publier();
  };
  ws.onclose = () => setTimeout(brancherTikFinity, RECONNEXION_MS);
  ws.onerror = () => { /* TikFinity fermé : on réessaie à la fermeture */ };
}
brancherTikFinity();

// OBS : remise à zéro au démarrage du live ; arrêt du service quand OBS est fermé depuis 2 minutes.
let obsVuLe = Date.now();
async function suivreObs() {
  const obs = await connecterObs(3000, {
    evenements: ABONNEMENT_SORTIES,
    surEvenement: (type, donnees) => {
      if (type === 'StreamStateChanged' && donnees?.outputState === 'OBS_WEBSOCKET_OUTPUT_STARTED') remettreAZero('le live démarre');
    },
    surFermeture: () => setTimeout(suivreObs, RECONNEXION_MS),
  });
  if (obs) { obsVuLe = Date.now(); return; }
  if (Date.now() - obsVuLe > OBS_ABSENT_MAX_MS) { console.log('OBS est fermé : arrêt du service'); process.exit(0); }
  setTimeout(suivreObs, RECONNEXION_MS);
}
suivreObs();
