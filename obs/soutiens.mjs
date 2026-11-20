// Soutiens du live (demande du client, 2026-10-09) : qui a suivi, s'est abonné ou a fait un don pendant le live, sur
// Twitch, YouTube et TikTok, pour ses écrans (bandeau au-dessus de la caméra, bandeau vertical, écrans de fin).
//
//   node obs/soutiens.mjs            service local, lancé par OBS (obs/soutiens.lua) : http://127.0.0.1:21310
//   node obs/soutiens.mjs --essai    ajoute des soutiens d'exemple à la liste (pour voir les écrans)
//   node obs/soutiens.mjs --remise   remet la liste à zéro
//   node obs/soutiens.mjs --verifier [jours]   avant un live : chaque chaîne StreamElements répond-elle, TikFinity
//                                    est-il ouvert, et les soutiens des derniers jours (7 par défaut) tels que les
//                                    bandeaux les auraient reçus
//
// Sources : Twitch et YouTube viennent directement de StreamElements (obs/streamelements.mjs, depuis le 2026-11-20 :
// OBS 33 refuse aux widgets d'alertes d'appeler 127.0.0.1), pour chaque overlay d'alertes de la collection ouverte,
// en rattrapage depuis le début du live (chaque minute) et en direct ; TikTok arrive de TikFinity (ws://127.0.0.1:21213).
// Le relais des widgets (POST /soutien) ne sert plus que si aucune chaîne StreamElements n'est suivie. La liste repart de
// zéro au démarrage du live (obs-websocket), sauf s'il reprend : relancé moins de 30 min après son arrêt ou après la
// perte d'OBS (plantage, fermeture en plein live). Elle repart aussi de zéro si elle date de plus de 6 h (live TikTok
// seul). Elle est gardée dans
// obs/soutiens-session.json et donnée aux écrans par overlays/soutiens.js (relu toutes les 2 s, comme live.js) ; ces
// deux fichiers ne sont pas versionnés. GET /etat dit ce que le service suit. Chaque soutien reçu et chaque changement
// d'état est noté dans obs/soutiens.log. Le service s'arrête de lui-même quand OBS est fermé depuis 2 minutes.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connecterObs } from './obs-websocket.mjs';
import { activitesDepuis, chaineDe, clesDansObs, clesDesCollections, essayerDirect, rechargerOverlays, soutienDeActivite, suivreStreamElements } from './streamelements.mjs';

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
const ABONNEMENT_CONFIG = 2; // obs-websocket : catégorie « Config » (CurrentSceneCollectionChanged)
const ABONNEMENT_SORTIES = 64; // obs-websocket : catégorie « Outputs » (StreamStateChanged)
const VUS_MAX = 2000;
const REPRISE_MS = 30 * 60_000;
const RELECTURE_ALERTES_MS = 60_000;
const VERIFIER_JOURS = 7;

// ---------- Session ----------

// `vus` : identifiants des activités StreamElements déjà comptées (le direct et le rattrapage voient les mêmes ; un
// don ne doit pas s'additionner deux fois).
const vide = () => ({ debut: new Date().toISOString(), liste: [], vus: [] });
function lire() {
  try {
    const s = JSON.parse(fs.readFileSync(SESSION, 'utf8'));
    return Array.isArray(s.liste) && s.debut ? { ...s, vus: Array.isArray(s.vus) ? s.vus : [] } : vide();
  } catch { return vide(); }
}
let session = lire();

// Journal du service (obs/soutiens.log, non versionné) et écriture qui ne le fait jamais tomber : sous Windows, le
// remplacement échoue parfois pendant qu'OBS relit le fichier (même défaut que le service du jeu, tombé en live le
// 2026-11-09).
const JOURNAL = path.join(ICI, 'soutiens.log');
const JOURNAL_MAX = 200_000;
function journal(message) {
  try {
    if (fs.existsSync(JOURNAL) && fs.statSync(JOURNAL).size > JOURNAL_MAX) fs.renameSync(JOURNAL, `${JOURNAL}.ancien`);
    fs.appendFileSync(JOURNAL, `${new Date().toISOString()} ${message}\n`);
  } catch { /* journal indisponible : on continue */ }
}
process.on('uncaughtException', (erreur) => journal(`erreur : ${erreur.stack ?? erreur}`));
process.on('unhandledRejection', (erreur) => journal(`erreur : ${erreur?.stack ?? erreur}`));
const attendre = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function ecrireAtomique(fichier, texte) {
  try {
    fs.writeFileSync(`${fichier}.tmp`, texte);
    for (let essai = 1; essai <= 5; essai++) {
      try { fs.renameSync(`${fichier}.tmp`, fichier); return; } catch { attendre(25); }
    }
    fs.writeFileSync(fichier, texte);
    fs.rmSync(`${fichier}.tmp`, { force: true });
  } catch (erreur) { journal(`écriture de ${path.basename(fichier)} impossible : ${erreur.message}`); }
}
function publier() {
  ecrireAtomique(SESSION, JSON.stringify(session, null, 2));
  ecrireAtomique(POUR_LES_ECRANS, `window.SOUTIENS = ${JSON.stringify({ debut: session.debut, liste: session.liste })};\n`);
}

function remettreAZero(raison) {
  session = vide();
  publier();
  console.log(`liste remise à zéro (${raison})`);
  journal(`liste remise à zéro (${raison})`);
}

// Un live relancé moins de 30 min après son arrêt (ou après la perte d'OBS, notée comme un arrêt) garde sa liste, comme
// un live encore marqué en cours (service arrêté sans voir la fin).
function liveDemarre() {
  const coupe = session.enLive === true;
  const arretRecent = Boolean(session.fin) && Date.now() - Date.parse(session.fin) < REPRISE_MS;
  const recente = Date.now() - Date.parse(session.debut) < SESSION_PERIMEE_MS;
  if ((coupe || arretRecent) && recente) journal(`le live reprend : liste de ${session.liste.length} soutien(s) gardée`);
  else remettreAZero('le live démarre');
  session.enLive = true;
  delete session.fin;
  publier();
}
function liveArrete(raison) {
  if (session.enLive !== true) return; // un démarrage raté ne vaut pas la fin d'un live
  session.enLive = false;
  session.fin = new Date().toISOString();
  publier();
  journal(`live arrêté (${raison})`);
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
if (process.argv.includes('--verifier')) {
  const jours = Number(process.argv[process.argv.indexOf('--verifier') + 1]) || VERIFIER_JOURS;
  await verifier(jours);
  process.exit(0);
}

/** Contrôle avant un live, sans rien écrire : clés des overlays sur le disque, service, TikFinity. */
async function verifier(jours) {
  const depuis = new Date(Date.now() - jours * 86400_000).toISOString();
  const cles = clesDesCollections();
  if (!cles.size) console.log("StreamElements : aucune source d'alertes dans les collections Live_*.json");
  for (const [cle, ou] of cles) {
    try {
      const chaine = await chaineDe(cle);
      const soutiens = (await activitesDepuis(cle, chaine.salon, depuis)).map((a) => soutienDeActivite(a, chaine.plateforme)).filter(Boolean);
      const direct = await essayerDirect(cle).then(() => 'direct joignable', (erreur) => `DIRECT EN ÉCHEC (${erreur.message}), le rattrapage chaque minute suffit`);
      console.log(`OK  ${ou} (${chaine.plateforme ?? '?'} ${chaine.nom ?? ''}) : rattrapage joignable, ${direct}, ${soutiens.length} soutien(s) en ${jours} j`);
      for (const s of soutiens) console.log(`      ${new Date(s.quand).toLocaleString('fr-FR')}  ${s.plateforme} ${s.genre} ${s.nom}${s.montant ? ` ${s.montant} ${s.devise ?? ''}` : ''}`);
    } catch (erreur) { console.log(`ÉCHEC ${ou} : ${erreur.message}`); }
  }
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/etat`, { signal: AbortSignal.timeout(800) });
    const etat = await r.json();
    console.log(`Service des soutiens : lancé, ${etat.soutiens} soutien(s) depuis ${new Date(etat.debut).toLocaleString('fr-FR')}, TikFinity ${etat.tiktok ? 'branché' : 'non branché'}`);
    for (const c of etat.streamelements ?? []) console.log(`      ${c.source} : ${c.plateforme ?? '?'} ${c.nom ?? ''}, direct ${c.direct ? 'oui' : 'non'}, rattrapage ${c.rattrapage ? 'oui' : 'non'}${c.erreur ? ` (${c.erreur})` : ''}`);
  } catch { console.log('Service des soutiens : pas lancé (OBS le lance avec une collection des lives).'); }
  const tikfinity = await new Promise((ok) => {
    const ws = new WebSocket(TIKFINITY);
    ws.onopen = () => { ws.close(); ok(true); };
    ws.onerror = () => ok(false);
  });
  console.log(`TikFinity : ${tikfinity ? 'ouvert' : 'fermé (« Ouvrir les applis » du Stream Deck le lance)'}`);
}

// ---------- Service ----------

function noterSoutien(s, origine) {
  journal(`+ ${s.plateforme} ${s.genre} ${s.nom}${s.montant ? ` ${s.montant} ${s.devise ?? ''}` : ''} (${origine})`);
}

// Twitch et YouTube, directement de StreamElements (direct et rattrapage voient les mêmes activités).
const streamElements = suivreStreamElements({
  depuis: () => session.debut,
  journal,
  surSoutien(soutien, ids, origine) {
    if (ids.some((id) => session.vus.includes(id))) return;
    const ajoute = ajouter(soutien);
    const duLive = !soutien.quand || Date.parse(soutien.quand) >= Date.parse(session.debut);
    const vu = ids.length > 0 && duLive;
    if (vu) {
      session.vus.push(...ids);
      if (session.vus.length > VUS_MAX) session.vus.splice(0, session.vus.length - VUS_MAX);
    }
    if (ajoute) noterSoutien(soutien, `StreamElements, ${origine}`);
    if (ajoute || vu) publier();
  },
});
const suitStreamElements = () => streamElements.etat().some((c) => c.direct || c.rattrapage);

// Relais des widgets (bloqué par OBS 33) : seulement si aucune chaîne StreamElements n'est suivie directement.
function recevoir(message) {
  if (suitStreamElements()) return false;
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
  if (req.method === 'GET' && req.url === '/soutiens') { res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ debut: session.debut, liste: session.liste })); return; }
  if (req.method === 'GET' && req.url === '/etat') {
    const etat = { debut: session.debut, soutiens: session.liste.length, streamelements: streamElements.etat(), tiktok: tikfinityBranche };
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(etat));
    return;
  }
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
// OBS relance ce script à chaque chargement de collection : seule la copie qui obtient le port travaille, les autres
// s'arrêtent sans toucher à la liste.
serveur.listen(PORT, '127.0.0.1', () => {
  console.log(`soutiens du live : http://127.0.0.1:${PORT}`);
  journal('service démarré');
  if (Date.now() - Date.parse(session.debut) > SESSION_PERIMEE_MS) remettreAZero('dernière session de plus de 6 h');
  else publier();
  brancherTikFinity();
  suivreObs();
  setInterval(() => { if (obsBranche) lireAlertes(obsBranche); }, RELECTURE_ALERTES_MS);
});

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
let tikfinityBranche = false;
function brancherTikFinity() {
  let ws;
  try { ws = new WebSocket(TIKFINITY); } catch { setTimeout(brancherTikFinity, RECONNEXION_MS); return; }
  ws.onopen = () => { if (!tikfinityBranche) journal('TikFinity branché'); tikfinityBranche = true; };
  ws.onmessage = (ev) => {
    let evenement;
    try { evenement = JSON.parse(ev.data); } catch { return; }
    const s = soutienTikTok(evenement);
    if (s && ajouter(s)) { noterSoutien(s, 'TikFinity'); publier(); }
  };
  ws.onclose = () => {
    if (tikfinityBranche) journal('TikFinity débranché');
    tikfinityBranche = false;
    setTimeout(brancherTikFinity, RECONNEXION_MS);
  };
  ws.onerror = () => { /* TikFinity fermé : on réessaie à la fermeture */ };
}

// Overlays d'alertes de la collection ouverte : leurs chaînes StreamElements sont celles du live. Relus au branchement,
// à chaque changement de collection et chaque minute (un changement manqué pendant le chargement d'OBS se rattrape) ;
// seule la lecture la plus récente compte, et une lecture ratée ne change rien à ce qui est suivi.
let lecture = 0;
let erreurAlertes = null;
async function lireAlertes(obs) {
  const numero = ++lecture;
  try {
    const cles = await clesDansObs(obs);
    if (numero !== lecture) return;
    erreurAlertes = null;
    streamElements.suivre(cles);
  } catch (erreur) {
    if (numero !== lecture || erreurAlertes === erreur.message) return;
    erreurAlertes = erreur.message;
    journal(`sources d'alertes illisibles : ${erreur.message}`);
  }
}

// Début du live : chaque source d'alertes est rechargée (défaut d'OBS, son sans image : voir rechargerOverlays).
async function rechargerAlertes(obs) {
  try {
    const { rechargees, echecs } = await rechargerOverlays(obs);
    if (rechargees.length) journal(`alertes rechargées : ${rechargees.join(', ')}`);
    for (const { source, erreur } of echecs) journal(`alertes : ${source} non rechargée (${erreur})`);
  } catch (erreur) {
    journal(`alertes non rechargées : ${erreur.message}`);
  }
}

// État du live au branchement : un live déjà en cours (service relancé) garde sa liste ; un live marqué en cours alors
// qu'OBS ne diffuse plus (OBS planté ou fermé en plein live) est arrêté à cette heure-ci, pour la reprise.
async function accorderLive(obs) {
  try {
    const { outputActive } = (await obs.req('GetStreamStatus')).responseData ?? {};
    if (outputActive === true && session.enLive !== true) {
      session.enLive = true;
      delete session.fin;
      publier();
      journal(`live déjà en cours : liste de ${session.liste.length} soutien(s) gardée`);
    } else if (outputActive === false && session.enLive === true) liveArrete('OBS ne diffuse plus');
  } catch { /* état illisible : les événements suivront */ }
}

// OBS : remise à zéro au démarrage du live ; chaînes suivies selon la collection ; arrêt du service quand OBS est fermé
// depuis 2 minutes.
let obsVuLe = Date.now();
let obsBranche = null;
async function suivreObs() {
  const obs = await connecterObs(3000, {
    evenements: ABONNEMENT_SORTIES | ABONNEMENT_CONFIG,
    surEvenement: (type, donnees) => {
      if (type === 'StreamStateChanged' && donnees?.outputState === 'OBS_WEBSOCKET_OUTPUT_STARTED') {
        liveDemarre();
        if (obsBranche) rechargerAlertes(obsBranche);
      }
      if (type === 'StreamStateChanged' && donnees?.outputState === 'OBS_WEBSOCKET_OUTPUT_STOPPED') liveArrete('fin du live');
      if (type === 'CurrentSceneCollectionChanged' && obsBranche) lireAlertes(obsBranche);
    },
    // Les 2 minutes partent de la perte de la connexion, pas de la première connexion (corrigé le 2026-11-09).
    surFermeture: () => {
      obsBranche = null;
      obsVuLe = Date.now();
      journal('connexion à OBS perdue');
      if (session.enLive === true) liveArrete('OBS perdu en plein live');
      setTimeout(suivreObs, RECONNEXION_MS);
    },
  });
  if (obs) { obsBranche = obs; obsVuLe = Date.now(); journal('OBS branché'); accorderLive(obs); lireAlertes(obs); return; }
  if (Date.now() - obsVuLe > OBS_ABSENT_MAX_MS) { journal('OBS fermé depuis 2 minutes : arrêt du service'); process.exit(0); }
  setTimeout(suivreObs, RECONNEXION_MS);
}
