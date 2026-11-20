// Soutiens lus directement chez StreamElements (2026-11-20), pour le service des soutiens (obs/soutiens.mjs).
//
// Depuis OBS 33 (navigateur CEF 150), une page en ligne n'a plus le droit d'appeler 127.0.0.1 (« Local Network
// Access », obs-browser n° 545) : chaque envoi des widgets d'alertes vers le service était refusé (« Permission was denied
// for this request to access the `loopback` address space », journal d'OBS), et plus aucun follow Twitch ni abonné
// YouTube n'arrivait dans les bandeaux depuis le 2026-11-09. Le service lit donc lui-même le fil d'activité de chaque
// chaîne dont OBS affiche les alertes, avec la clé de l'overlay : dernier segment de l'adresse de la source « Alertes »,
// déjà sur le disque, jamais affichée ni versionnée. Toutes les requêtes passent l'en-tête « Authorization: apikey … ».
//   - Chaîne : GET /kappa/v2/channels/me (identifiant, plateforme, nom).
//   - Rattrapage : GET /kappa/v2/activities/<chaîne> depuis le début du live, au branchement puis chaque minute ; il ne
//     dépend pas du direct, et rien ne se perd si OBS, le service ou la connexion redémarre en plein live.
//   - Direct : Astro (wss://astro.streamelements.com, sujet channel.activities, clé de type « apikey »), pour que le
//     bandeau suive l'alerte sans attendre la minute.
import fs from 'node:fs';
import path from 'node:path';

const ASTRO = 'wss://astro.streamelements.com';
const API = 'https://api.streamelements.com/kappa/v2';
const TYPES = ['follow', 'subscriber', 'communityGiftPurchase', 'sponsor', 'tip', 'superchat', 'cheer'];
const PLATEFORMES = new Set(['twitch', 'youtube']);
const RATTRAPAGE_MS = 60_000;
const REESSAI_DIRECT_MS = 30_000;
const CONNEXION_MS = 15_000;
const RECONNEXION_MAX_MS = 30_000;
const DELAI_API_MS = 10_000;
const ACTIVITES_MAX = 100;
const COLLECTIONS = path.join(process.env.APPDATA ?? '', 'obs-studio', 'basic', 'scenes');

/** Clé d'un overlay StreamElements (dernier segment de son adresse), ou null pour toute autre page. */
export function cleDOverlay(url) {
  const m = typeof url === 'string' ? url.match(/^https:\/\/streamelements\.com\/overlay\/[^/?#]+\/([^/?#]+)/) : null;
  return m ? m[1] : null;
}

/**
 * Une activité StreamElements en soutien du live, ou null. Mêmes règles que le relais des widgets
 * (alertes/streamelements/*\/widget.js, soutienDe) : l'abonné YouTube vaut un follow, un abonnement offert compte pour
 * celui qui l'offre. `plateformeDeLaChaine` sert quand l'activité n'en donne pas (dons StreamElements).
 */
export function soutienDeActivite(activite, plateformeDeLaChaine) {
  if (!activite || typeof activite !== 'object') return null;
  const d = activite.data && typeof activite.data === 'object' ? activite.data : {};
  const plateforme = PLATEFORMES.has(activite.provider) ? activite.provider : plateformeDeLaChaine;
  if (!PLATEFORMES.has(plateforme)) return null;
  const nom = d.displayName || d.username;
  const offert = (d.gifted || d.bulkGifted) && d.sender ? d.sender : nom;
  let soutien;
  switch (activite.type) {
    case 'follow': soutien = { genre: 'follow', nom }; break;
    case 'subscriber': soutien = plateforme === 'youtube' ? { genre: 'follow', nom } : { genre: 'abonnement', nom: offert }; break;
    case 'communityGiftPurchase': soutien = { genre: 'abonnement', nom: d.sender || nom }; break;
    case 'sponsor': soutien = { genre: 'abonnement', nom: offert }; break;
    case 'tip':
    case 'superchat': soutien = { genre: 'don', nom, montant: Number(d.amount), devise: d.currency }; break;
    case 'cheer': soutien = { genre: 'don', nom, montant: Number(d.amount), devise: 'BITS' }; break;
    default: return null;
  }
  if (typeof soutien.nom !== 'string' || !soutien.nom.trim()) return null;
  const { montant, devise, ...reste } = soutien;
  return {
    plateforme, ...reste,
    ...(Number.isFinite(montant) && montant > 0 ? { montant } : {}),
    ...(typeof devise === 'string' && devise ? { devise } : {}),
    ...(typeof activite.createdAt === 'string' ? { quand: activite.createdAt } : {}),
  };
}

/**
 * Identifiants sous lesquels une activité est reconnue d'une lecture à l'autre (direct et rattrapage) : les siens, et
 * une empreinte (type, personne, montant, date) au cas où le direct n'aurait pas le même — un don ne doit jamais
 * s'additionner deux fois. Sans date, pas d'empreinte : deux dons pareils seraient confondus.
 */
export function idsDeActivite(activite, soutien) {
  const ids = [activite?._id, activite?.activityId].filter((id) => typeof id === 'string' && id);
  if (soutien && typeof activite?.createdAt === 'string') ids.push(`${activite.type}|${soutien.plateforme}|${soutien.nom}|${soutien.montant ?? ''}|${activite.createdAt}`);
  return [...new Set(ids)];
}

/** Clés des overlays d'alertes posées dans les collections des lives sur le disque : Map clé → « collection › source ». */
export function clesDesCollections() {
  const cles = new Map();
  for (const fichier of fs.readdirSync(COLLECTIONS).filter((n) => /^Live_.*\.json$/.test(n))) {
    let collection;
    try { collection = JSON.parse(fs.readFileSync(path.join(COLLECTIONS, fichier), 'utf8')); } catch { continue; }
    for (const source of collection.sources ?? []) {
      const cle = cleDOverlay(source.settings?.url);
      if (cle && !cles.has(cle)) cles.set(cle, `${collection.name ?? fichier} › ${source.name}`);
    }
  }
  return cles;
}

/** Une requête obs-websocket qui aboutit, ou une erreur (échec, ou pas de réponse dans le délai). */
async function demander(obs, type, donnees, delaiMs = 5000) {
  let minuterie;
  const delai = new Promise((_, ko) => { minuterie = setTimeout(() => ko(new Error(`OBS ne répond pas à ${type}`)), delaiMs); });
  try {
    const r = await Promise.race([obs.req(type, donnees), delai]);
    if (!r.requestStatus?.result) throw new Error(`OBS refuse ${type} : ${r.requestStatus?.comment ?? 'sans raison'}`);
    return r.responseData ?? {};
  } finally { clearTimeout(minuterie); }
}

/** Sources navigateur de la collection ouverte dans OBS qui affichent un overlay StreamElements : [{ source, cle }]. Lève une erreur si OBS ne répond pas. */
export async function overlaysDansObs(obs) {
  const overlays = [];
  const { inputs = [] } = await demander(obs, 'GetInputList', { inputKind: 'browser_source' });
  for (const { inputName } of inputs) {
    const { inputSettings } = await demander(obs, 'GetInputSettings', { inputName });
    const cle = cleDOverlay(inputSettings?.url);
    if (cle) overlays.push({ source: inputName, cle });
  }
  return overlays;
}

/** Clés des overlays d'alertes de la collection ouverte dans OBS (obs-websocket) : Map clé → nom de la source. Lève une erreur si OBS ne répond pas. */
export async function clesDansObs(obs) {
  const cles = new Map();
  for (const { source, cle } of await overlaysDansObs(obs)) if (!cles.has(cle)) cles.set(cle, source);
  return cles;
}

// Défaut d'OBS (obs-studio n° 6111), vu en live le 2026-11-20 : la source « Alertes », chargée à l'ouverture d'OBS, a
// joué le son d'un follow sans en afficher l'image ; rechargée, elle a de nouveau tout affiché. Le service recharge donc
// chaque overlay au début du live (bouton « Actualiser le cache de la page » de la source : transparente entre deux
// alertes, rien ne se voit à l'écran).
/** Recharge chaque source d'overlay StreamElements : { rechargees: [source], echecs: [{ source, erreur }] }. Lève une erreur si OBS ne liste pas ses sources. */
export async function rechargerOverlays(obs) {
  const rechargees = [];
  const echecs = [];
  for (const { source } of await overlaysDansObs(obs)) {
    try {
      await demander(obs, 'PressInputPropertiesButton', { inputName: source, propertyName: 'refreshnocache' });
      rechargees.push(source);
    } catch (erreur) {
      echecs.push({ source, erreur: erreur.message });
    }
  }
  return { rechargees, echecs };
}

async function api(cle, chemin) {
  const r = await fetch(`${API}/${chemin}`, { headers: { Authorization: `apikey ${cle}`, Accept: 'application/json' }, signal: AbortSignal.timeout(DELAI_API_MS) });
  if (!r.ok) throw new Error(`API StreamElements : HTTP ${r.status}`);
  return r.json();
}

/** La chaîne d'une clé : { salon (identifiant StreamElements), plateforme, nom }. Lève une erreur si l'API refuse. */
export async function chaineDe(cle) {
  const c = await api(cle, 'channels/me');
  if (!c?._id) throw new Error('API StreamElements : chaîne inconnue');
  return { salon: c._id, plateforme: PLATEFORMES.has(c.provider) ? c.provider : undefined, nom: c.displayName || c.username };
}

/** Activités d'une chaîne depuis `depuis` (ISO), de la plus ancienne à la plus récente. Lève une erreur si l'API refuse. */
export async function activitesDepuis(cle, salon, depuis) {
  const parametres = new URLSearchParams({ after: depuis, before: new Date().toISOString(), limit: String(ACTIVITES_MAX), origin: 'feed', mincheer: '0', minhost: '0', minsub: '0', mintip: '0' });
  for (const type of TYPES) parametres.append('types', type);
  const liste = await api(cle, `activities/${salon}?${parametres}`);
  return (Array.isArray(liste) ? liste : []).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

function abonnement(cle, nonce) {
  return { type: 'subscribe', nonce, data: { topic: 'channel.activities', token: cle, token_type: 'apikey' } };
}

/** Le direct accepte-t-il cette clé ? Un abonnement Astro d'essai, refermé aussitôt. Lève une erreur sinon. */
export function essayerDirect(cle, delaiMs = DELAI_API_MS) {
  return new Promise((ok, ko) => {
    const ws = new WebSocket(ASTRO);
    const fin = setTimeout(() => { ws.close(); ko(new Error('Astro ne répond pas')); }, delaiMs);
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.type === 'welcome') ws.send(JSON.stringify(abonnement(cle, 'essai')));
      if (m.type !== 'response') return;
      clearTimeout(fin);
      ws.close();
      if (m.error) ko(new Error(`abonnement refusé (${m.error})`)); else ok();
    };
    ws.onerror = () => { clearTimeout(fin); ko(new Error('Astro injoignable')); };
  });
}

/**
 * Suit le fil d'activité des chaînes StreamElements. `surSoutien(soutien, ids, origine)` reçoit chaque soutien avec
 * ses identifiants (idsDeActivite) et son origine (« direct » ou « rattrapage ») ; `depuis()` donne le début du live
 * (ISO) ; `journal(texte)` note les changements d'état. Renvoie `suivre(sources)` (Map clé → nom de la source OBS ; la
 * même liste ne relance rien) et `etat()`.
 */
export function suivreStreamElements({ surSoutien, depuis, journal }) {
  let sources = new Map();
  const chaines = new Map(); // clé → { salon, plateforme, nom, direct, refus, erreur }
  let ws = null;
  let tentatives = 0;
  let relance = null;

  // Une réponse tardive pour une source retirée entre-temps ne recrée rien.
  const maj = (cle, champs) => { if (sources.has(cle)) chaines.set(cle, { ...chaines.get(cle), ...champs }); };
  const libelle = (cle) => {
    const c = chaines.get(cle);
    return c?.nom ? `${c.plateforme ?? '?'} ${c.nom}` : `« ${sources.get(cle)} »`;
  };
  function noterErreur(cle, erreur) {
    if ((chaines.get(cle)?.erreur ?? null) !== erreur) journal(erreur ? `StreamElements ${libelle(cle)} : ${erreur}` : `StreamElements ${libelle(cle)} : rattrapage de nouveau joignable`);
    maj(cle, { erreur });
  }

  function recu(activite, origine, cle) {
    if (!sources.has(cle)) return;
    const soutien = soutienDeActivite(activite, chaines.get(cle)?.plateforme);
    if (soutien) surSoutien(soutien, idsDeActivite(activite, soutien), origine);
  }

  async function rattraper(cle) {
    try {
      if (!chaines.get(cle)?.salon) {
        maj(cle, await chaineDe(cle));
        if (sources.has(cle)) journal(`StreamElements ${libelle(cle)} : rattrapage suivi (${sources.get(cle)})`);
      }
      const salon = chaines.get(cle)?.salon;
      if (!salon) return;
      for (const activite of await activitesDepuis(cle, salon, depuis())) recu(activite, 'rattrapage', cle);
      noterErreur(cle, null);
    } catch (erreur) { noterErreur(cle, erreur.message); }
  }

  function abonner(socket, cles, i) {
    if (ws === socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(abonnement(cles[i], String(i))));
  }
  function repondu(socket, cles, m) {
    const i = Number(m.nonce);
    const cle = cles[i];
    if (!cle || ws !== socket || !sources.has(cle)) return;
    if (m.error) {
      if (chaines.get(cle)?.refus !== m.error) journal(`StreamElements ${libelle(cle)} : direct refusé (${m.error} : ${m.data?.message ?? ''}), nouvel essai toutes les 30 s`);
      maj(cle, { direct: false, refus: m.error });
      setTimeout(() => abonner(socket, cles, i), REESSAI_DIRECT_MS);
      return;
    }
    if (!chaines.get(cle)?.direct) journal(`StreamElements ${libelle(cle)} : direct suivi (${sources.get(cle)})`);
    maj(cle, { direct: true, refus: null, ...(chaines.get(cle)?.salon ? {} : { salon: m.data?.room }) });
  }

  function brancher() {
    clearTimeout(relance);
    if (!sources.size) return;
    const cles = [...sources.keys()];
    const socket = new WebSocket(ASTRO);
    ws = socket;
    const sansBienvenue = setTimeout(() => socket.close(), CONNEXION_MS);
    socket.onmessage = (ev) => {
      if (ws !== socket) return;
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.type === 'welcome') {
        clearTimeout(sansBienvenue);
        tentatives = 0;
        cles.forEach((_, i) => abonner(socket, cles, i));
      } else if (m.type === 'response') {
        repondu(socket, cles, m);
      } else if (m.type === 'message' && m.topic === 'channel.activities') {
        const salon = m.room ?? m.data?.channel;
        const cle = cles.find((k) => chaines.get(k)?.salon === salon) ?? (cles.length === 1 ? cles[0] : null);
        if (cle) recu(m.data, 'direct', cle);
      } else if (m.type === 'reconnect') {
        socket.close(); // le rattrapage couvre la coupure
      }
    };
    socket.onerror = () => { /* la fermeture suit */ };
    socket.onclose = () => {
      clearTimeout(sansBienvenue);
      if (ws !== socket) return; // remplacé par une autre liste de sources
      ws = null;
      for (const cle of cles) {
        if (!chaines.get(cle)?.direct) continue;
        maj(cle, { direct: false });
        journal(`StreamElements ${libelle(cle)} : direct coupé, reconnexion (le rattrapage continue)`);
      }
      relance = setTimeout(brancher, Math.min(1000 * 2 ** tentatives++, RECONNEXION_MAX_MS));
    };
  }

  setInterval(() => { for (const cle of sources.keys()) rattraper(cle); }, RATTRAPAGE_MS);

  return {
    suivre(nouvelles) {
      const memes = nouvelles.size === sources.size && [...nouvelles.keys()].every((cle) => sources.has(cle));
      sources = new Map(nouvelles);
      if (memes) return;
      for (const cle of [...chaines.keys()]) if (!sources.has(cle)) chaines.delete(cle);
      const ancien = ws;
      ws = null;
      try { ancien?.close(); } catch { /* déjà fermé */ }
      journal(sources.size ? `StreamElements : alertes de ${[...sources.values()].join(', ')}` : "StreamElements : aucune source d'alertes dans cette collection");
      brancher();
      for (const cle of sources.keys()) rattraper(cle);
    },
    etat() {
      return [...sources].map(([cle, source]) => {
        const { plateforme, nom, salon, direct = false, erreur = null } = chaines.get(cle) ?? {};
        return { source, plateforme, nom, direct, rattrapage: Boolean(salon) && !erreur, erreur };
      });
    },
  };
}
