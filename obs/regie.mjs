// Régie du live (2026-10-08, demande du client : « une interface pour contrôler tout ça, si le périphérique change ») :
// l'état d'OBS et des commandes sûres, appelées par la page Live du cockpit, le Stream Deck ou une session.
//
//   node obs/regie.mjs etat                      OBS, live, enregistrement, image et son TikTok, micro
//   node obs/regie.mjs demarrer-live             live (Twitch, YouTube), puis enregistrement, puis image TikTok
//   node obs/regie.mjs terminer-live             arrête le live, l'enregistrement et l'image TikTok
//   node obs/regie.mjs enregistrer | arreter-enregistrement
//   node obs/regie.mjs tiktok-on | tiktok-off    image verticale vers TikTok LIVE Studio (caméra virtuelle d'Aitum)
//   node obs/regie.mjs micros                    micros que voit OBS
//   node obs/regie.mjs micro "<id>"              change le micro des trois séances (et le garde pour le générateur)
//   node obs/regie.mjs sorties                   où le son de Windows peut être joué (casque, écran…), sans le câble
//   node obs/regie.mjs sortie "<id>"             là où tu écoutes : la sortie de Windows (son, multimédia, communications)
//   node obs/regie.mjs son-tiktok                envoie la piste TikTok d'OBS au câble VB-CABLE (OBS fermé)
//   --json   une seule ligne { ok, message, etat, micros?, sorties? } : c'est ce que lit le cockpit
//
// Le câble VB-CABLE ne sert qu'au son d'OBS vers TikTok : jamais sortie de Windows (sinon Spotify, le navigateur…
// partiraient sur TikTok et le casque resterait muet). « demarrer-live » remet la sortie choisie s'il l'est devenu.
//
// L'ordre compte (constaté le 2026-10-08) : la caméra virtuelle d'Aitum Vertical 1.6.6 démarre celle d'OBS sans
// préparer ses sorties ; lancée avant le live ou l'enregistrement, OBS (mode Avancé) refuse ensuite de les démarrer.
// Quand rien ne tourne encore, la régie coupe donc l'image TikTok le temps de lancer, puis la relance.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { connecterObs } from './obs-websocket.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const OBS = path.join(process.env.APPDATA ?? '', 'obs-studio');
const conf = JSON.parse(fs.readFileSync(path.join(ICI, 'seances.json'), 'utf8'));
const PISTE = conf.vertical.piste_son;
const AITUM = 'aitum-vertical-canvas';
const PERIPHERIQUES = path.join(ICI, 'peripheriques.json');
const AUDIO_MONITOR = {
  config: path.join(OBS, 'plugin_config', 'audio-monitor', 'config.json'),
  modules: ['C:/Program Files/obs-studio/obs-plugins/64bit/audio-monitor.dll', 'C:/ProgramData/obs-studio/plugins/audio-monitor/bin/64bit/audio-monitor.dll'],
};
const CABLE = 'CABLE Input'; // entrée du câble VB-Audio Virtual Cable ; TikTok LIVE Studio écoute « CABLE Output »
const PISTES_OBS = 6;
const ATTENTE_SORTIE_MS = 10000;
// Fichiers des collections : mêmes noms que ceux qu'écrit obs/generer.mjs.
const fichierCollection = (seance) => path.join(OBS, 'basic', 'scenes', `Live_${seance.id[0].toUpperCase()}${seance.id.slice(1)}.json`);
const dossierProfil = (nom) => path.join(OBS, 'basic', 'profiles', nom.replaceAll(' ', '_'));
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

class Refus extends Error {}

// ---------- Périphériques ----------

/**
 * Audio de Windows (obs/audio-windows.ps1) : sorties et entrées actives, sorties par défaut ; `choisir` change la
 * sortie par défaut. Lu une fois par lancement de la régie.
 */
let audioLu;
function audioWindows(action = 'lister', id) {
  if (action === 'lister' && audioLu) return audioLu;
  const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(ICI, 'audio-windows.ps1'), '-Action', action, ...(id ? ['-Id', id] : [])];
  let sortie;
  try {
    sortie = execFileSync('powershell.exe', args, { encoding: 'utf8', timeout: 30000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (erreur) {
    if (action === 'choisir') throw new Refus(`Windows n'a pas changé de sortie : ${String(erreur.stderr || erreur.message).trim().split(/\r?\n/)[0]}`);
    return { sorties: [], entrees: [], defaut: {} };
  }
  const j = JSON.parse(sortie || '{}');
  audioLu = { sorties: [j.sorties ?? []].flat(), entrees: [j.entrees ?? []].flat(), defaut: j.defaut ?? {} };
  return audioLu;
}

const memeId = (a, b) => Boolean(a && b) && a.toLowerCase() === b.toLowerCase();
const estCable = (peripherique) => /VB-Audio Virtual Cable/i.test(peripherique?.nom ?? '');
const cableVirtuel = () => audioWindows().sorties.find((d) => d.nom?.startsWith(CABLE));

/** Où Windows joue le son (ce que tu entends) : sortie par défaut et sortie des communications (Discord, appels). */
function sortieWindows() {
  const { sorties, defaut } = audioWindows();
  const trouver = (id) => sorties.find((s) => memeId(s.id, id)) ?? (id ? { id, nom: id } : null);
  const son = trouver(defaut.sortie);
  const communication = trouver(defaut.communication);
  return { son, communication, surCable: estCable(son) || estCable(communication) };
}

/**
 * Le câble ne sert qu'à OBS → TikTok (demande du client, 2026-10-08) : s'il est devenu la sortie de Windows (son de
 * Spotify, du navigateur… envoyé dans TikTok, et plus rien dans le casque), on remet la sortie choisie dans la régie.
 */
function protegerSortie() {
  if (!sortieWindows().surCable) return null;
  const choisie = lireJson(PERIPHERIQUES, {}).sortie;
  const active = choisie && audioWindows().sorties.find((s) => memeId(s.id, choisie.id));
  if (!active) throw new Refus('Windows envoie ton son dans le câble VB-CABLE (Spotify et ton navigateur partiraient sur TikTok) : choisis où tu écoutes dans la régie, puis relance.');
  audioLu = audioWindows('choisir', active.id);
  return active;
}
const lireJson = (fichier, defaut) => { try { return JSON.parse(fs.readFileSync(fichier, 'utf8')); } catch { return defaut; } };
function ecrireJson(fichier, valeur, indentation = 2) {
  fs.mkdirSync(path.dirname(fichier), { recursive: true });
  fs.writeFileSync(`${fichier}.tmp`, JSON.stringify(valeur, null, indentation));
  JSON.parse(fs.readFileSync(`${fichier}.tmp`, 'utf8'));
  fs.renameSync(`${fichier}.tmp`, fichier);
}

/** Où le module Audio Monitor envoie la piste TikTok (réglage relu au démarrage d'OBS, réécrit à sa fermeture). */
function etatAudioMonitor(cable) {
  const installe = AUDIO_MONITOR.modules.some((f) => fs.existsSync(f));
  const sortie = lireJson(AUDIO_MONITOR.config, {}).outputs?.[PISTE - 1];
  const appareils = sortie?.enabled ? (sortie.devices ?? []) : [];
  return {
    installe,
    branche: Boolean(cable) && appareils.some((d) => d.id === cable.id && !d.muted),
    vers: appareils.map((d) => d.name || d.deviceName).filter(Boolean),
  };
}

const obsTourne = () => {
  try { return execFileSync('tasklist', ['/FI', 'IMAGENAME eq obs64.exe', '/NH'], { encoding: 'utf8', windowsHide: true }).includes('obs64.exe'); } catch { return false; }
};

// ---------- État ----------

const actif = async (obs, statut) => (await obs.req(statut)).responseData?.outputActive === true;
const imageTikTok = async (obs) => (await obs.vendeur(AITUM, 'status'))?.virtual_camera === true;

async function nomMicro(obs, id) {
  const r = await obs.req('GetInputPropertiesListPropertyItems', { inputName: 'Micro', propertyName: 'device_id' });
  return r.responseData?.propertyItems?.find((p) => p.itemValue === id)?.itemName;
}

async function lireEtat(obs) {
  const cable = cableVirtuel();
  const ecoute = sortieWindows();
  const son = {
    piste: PISTE, cable: cable?.nom ?? null, ...etatAudioMonitor(cable),
    // Ce que tu entends : la sortie de Windows. Elle ne doit jamais être le câble.
    sortie: ecoute.son, communication: ecoute.communication, surCable: ecoute.surCable,
  };
  const memorise = lireJson(PERIPHERIQUES, {}).micro ?? null;
  if (!obs) return { obs: { ouvert: false }, live: false, enregistrement: false, cameraObs: false, tiktok: { module: false, image: false, scene: null }, son, micro: memorise };
  const statut = await obs.vendeur(AITUM, 'status');
  const microId = (await obs.req('GetInputSettings', { inputName: 'Micro' })).responseData?.inputSettings?.device_id;
  return {
    obs: {
      ouvert: true,
      collection: (await obs.req('GetSceneCollectionList')).responseData?.currentSceneCollectionName ?? null,
      scene: (await obs.req('GetCurrentProgramScene')).responseData?.sceneName ?? null,
    },
    live: await actif(obs, 'GetStreamStatus'),
    enregistrement: await actif(obs, 'GetRecordStatus'),
    cameraObs: (await actif(obs, 'GetVirtualCamStatus')) && statut?.virtual_camera !== true,
    tiktok: { module: Boolean(statut), image: statut?.virtual_camera === true, scene: (await obs.vendeur(AITUM, 'current_scene'))?.scene ?? null },
    son,
    micro: microId ? { id: microId, nom: (await nomMicro(obs, microId)) ?? memorise?.nom ?? microId } : memorise,
  };
}

// ---------- Commandes ----------

async function attendreQue(test, delaiMs = ATTENTE_SORTIE_MS) {
  const fin = Date.now() + delaiMs;
  while (Date.now() < fin) {
    if (await test()) return true;
    await pause(300);
  }
  return false;
}

async function couperTikTok(obs) {
  if (!(await imageTikTok(obs))) return false;
  await obs.vendeur(AITUM, 'stop_virtual_camera');
  await attendreQue(async () => !(await imageTikTok(obs)) && !(await actif(obs, 'GetVirtualCamStatus')));
  return true;
}

async function lancerTikTok(obs) {
  if (!(await obs.vendeur(AITUM, 'status'))) throw new Refus("Le module Aitum Vertical ne répond pas : pas d'image TikTok dans cet OBS.");
  if (await imageTikTok(obs)) return;
  // Une seule caméra virtuelle : celle d'OBS (image horizontale) doit laisser la place.
  if (await actif(obs, 'GetVirtualCamStatus')) {
    await obs.req('StopVirtualCam');
    await attendreQue(async () => !(await actif(obs, 'GetVirtualCamStatus')));
  }
  await obs.vendeur(AITUM, 'start_virtual_camera');
  if (!(await attendreQue(() => imageTikTok(obs), 5000))) {
    throw new Refus("L'image TikTok n'a pas démarré. Si un ancien OBS traîne encore (Gestionnaire des tâches, onglet Détails : deux obs64.exe), ferme le plus ancien.");
  }
}

/** Démarre le live ou l'enregistrement sans tomber dans le défaut d'Aitum (voir l'en-tête). */
async function demarrerSortie(obs, demande, statut, nom) {
  if (await actif(obs, statut)) return false;
  const rienNeTourne = !(await actif(obs, 'GetStreamStatus')) && !(await actif(obs, 'GetRecordStatus'));
  const tiktokCoupe = rienNeTourne && (await couperTikTok(obs));
  await obs.req(demande);
  const parti = await attendreQue(() => actif(obs, statut));
  if (tiktokCoupe) await lancerTikTok(obs);
  if (!parti) throw new Refus(`${nom} n'a pas démarré : regarde le message d'OBS (clé de stream, disque plein…).`);
  return true;
}

async function arreterSortie(obs, demande, statut) {
  if (!(await actif(obs, statut))) return false;
  await obs.req(demande);
  await attendreQue(async () => !(await actif(obs, statut)));
  return true;
}

async function listeMicros(obs) {
  const r = await obs.req('GetInputPropertiesListPropertyItems', { inputName: 'Micro', propertyName: 'device_id' });
  return (r.responseData?.propertyItems ?? []).filter((p) => p.itemEnabled !== false && p.itemValue).map((p) => ({ id: p.itemValue, nom: p.itemName }));
}

/** Change le micro : tout de suite dans la collection ouverte, dans les fichiers des deux autres, et pour le générateur. */
async function changerMicro(obs, id) {
  const micros = obs ? await listeMicros(obs) : audioWindows().entrees;
  const choisi = micros.find((m) => m.id === id);
  if (!choisi) throw new Refus("Ce micro n'est pas branché (ou OBS ne le voit pas).");
  const ouverte = obs ? (await obs.req('GetSceneCollectionList')).responseData?.currentSceneCollectionName : undefined;
  if (obs) await obs.req('SetInputSettings', { inputName: 'Micro', inputSettings: { device_id: id } });
  for (const seance of conf.seances) {
    if (seance.nom === ouverte) continue;
    const fichier = fichierCollection(seance);
    const col = lireJson(fichier, null);
    const micro = col?.sources?.find((s) => s.name === 'Micro');
    if (!micro) continue;
    micro.settings = { ...micro.settings, device_id: id };
    ecrireJson(fichier, col, 4);
  }
  ecrireJson(PERIPHERIQUES, { ...lireJson(PERIPHERIQUES, {}), micro: choisi });
  return choisi;
}

/** Nomme la piste TikTok dans les profils (« TikTok » dans les réglages audio d'OBS et le module Audio Monitor). */
function nommerPiste() {
  for (const profil of new Set(conf.seances.map((s) => s.profil))) {
    const fichier = path.join(dossierProfil(profil), 'basic.ini');
    if (!fs.existsSync(fichier)) continue;
    const texte = fs.readFileSync(fichier, 'utf8');
    const ligne = `Track${PISTE}Name=TikTok`;
    const motif = new RegExp(`^Track${PISTE}Name=.*$`, 'm');
    const nouveau = motif.test(texte) ? texte.replace(motif, ligne) : texte.replace(/^\[AdvOut\]\r?$/m, (s) => `${s}\n${ligne}`);
    if (nouveau !== texte) fs.writeFileSync(fichier, nouveau);
  }
}

/** Piste TikTok d'OBS vers le câble VB-CABLE, par le module Audio Monitor. OBS doit être fermé (il réécrit ce réglage en quittant). */
function brancherSonTikTok() {
  if (obsTourne()) throw new Refus("Ferme OBS d'abord : il réécrit ce réglage en quittant. Puis relance « son TikTok » et rouvre OBS.");
  const cable = cableVirtuel();
  if (!cable) throw new Refus('Le câble VB-CABLE est introuvable : installe-le (vb-audio.com, « Cable »), redémarre le PC, puis recommence.');
  if (!AUDIO_MONITOR.modules.some((f) => fs.existsSync(f))) throw new Refus("Le module Audio Monitor n'est pas installé dans OBS (forum OBS, ressources d'Exeldro).");
  const config = lireJson(AUDIO_MONITOR.config, {});
  const sorties = Array.from({ length: PISTES_OBS }, (_, i) => config.outputs?.[i] ?? { enabled: false });
  sorties[PISTE - 1] = { enabled: true, devices: [{ id: cable.id, deviceName: cable.nom, name: cable.nom, volume: 100, muted: false, locked: false }] };
  ecrireJson(AUDIO_MONITOR.config, { ...config, showOutputMeter: true, outputs: sorties });
  nommerPiste();
  return cable;
}

/** Le service des soutiens du live (obs/soutiens.mjs) : OBS le lance (obs/soutiens.lua) ; sinon, la régie le démarre. */
async function assurerSoutiens() {
  try {
    const r = await fetch('http://127.0.0.1:21310/soutiens', { signal: AbortSignal.timeout(800) });
    if (r.ok) return;
  } catch { /* pas lancé */ }
  spawn(process.execPath, [path.join(ICI, 'soutiens.mjs')], { cwd: ICI, detached: true, stdio: 'ignore', windowsHide: true }).unref();
}

// ---------- Programme ----------

const COMMANDES = {
  async etat() { return { message: 'État lu.' }; },
  async 'demarrer-live'(obs) {
    const remise = protegerSortie();
    await assurerSoutiens();
    await demarrerSortie(obs, 'StartStream', 'GetStreamStatus', 'Le live');
    await demarrerSortie(obs, 'StartRecord', 'GetRecordStatus', "L'enregistrement");
    await lancerTikTok(obs);
    return { message: `Live, enregistrement et image TikTok lancés. Passe en direct dans TikTok LIVE Studio.${remise ? ` (Le son de Windows partait dans le câble : remis sur ${remise.nom}.)` : ''}` };
  },
  async 'terminer-live'(obs) {
    await arreterSortie(obs, 'StopStream', 'GetStreamStatus');
    await arreterSortie(obs, 'StopRecord', 'GetRecordStatus');
    await couperTikTok(obs);
    return { message: 'Live, enregistrement et image TikTok arrêtés. Pense à terminer le live dans TikTok LIVE Studio.' };
  },
  async enregistrer(obs) {
    const parti = await demarrerSortie(obs, 'StartRecord', 'GetRecordStatus', "L'enregistrement");
    return { message: parti ? 'Enregistrement lancé.' : "L'enregistrement tournait déjà." };
  },
  async 'arreter-enregistrement'(obs) {
    const arrete = await arreterSortie(obs, 'StopRecord', 'GetRecordStatus');
    return { message: arrete ? 'Enregistrement arrêté.' : 'Aucun enregistrement en cours.' };
  },
  async 'tiktok-on'(obs) {
    await lancerTikTok(obs);
    const seul = !(await actif(obs, 'GetStreamStatus')) && !(await actif(obs, 'GetRecordStatus'));
    return { message: seul ? "Image TikTok lancée. Démarre le live et l'enregistrement depuis la régie : depuis OBS, il refuserait." : 'Image TikTok lancée.' };
  },
  async 'tiktok-off'(obs) {
    return { message: (await couperTikTok(obs)) ? 'Image TikTok arrêtée.' : "L'image TikTok était déjà arrêtée." };
  },
  async micros(obs) {
    return { message: 'Micros lus.', micros: obs ? await listeMicros(obs) : audioWindows().entrees };
  },
  async sorties() {
    return { message: 'Sorties lues.', sorties: audioWindows().sorties.filter((s) => !estCable(s)) };
  },
  async sortie(obs, id) {
    if (!id) throw new Refus('Indique la sortie : node obs/regie.mjs sortie "<id>" (liste : node obs/regie.mjs sorties).');
    const choisie = audioWindows().sorties.find((s) => memeId(s.id, id));
    if (!choisie) throw new Refus("Cette sortie n'est pas branchée.");
    if (estCable(choisie)) throw new Refus('Le câble VB-CABLE ne sert qu’à OBS pour TikTok : choisis ton casque ou tes enceintes.');
    audioLu = audioWindows('choisir', choisie.id);
    ecrireJson(PERIPHERIQUES, { ...lireJson(PERIPHERIQUES, {}), sortie: choisie });
    return { message: `Tu écoutes maintenant sur ${choisie.nom} (son, multimédia et communications).` };
  },
  async micro(obs, id) {
    if (!id) throw new Refus('Indique le micro : node obs/regie.mjs micro "<id>" (liste : node obs/regie.mjs micros).');
    const choisi = await changerMicro(obs, id);
    return { message: `Micro : ${choisi.nom}.` };
  },
  async 'son-tiktok'() {
    const cable = brancherSonTikTok();
    return { message: `Son TikTok branché : piste ${PISTE} d'OBS vers ${cable.nom}. Rouvre OBS ; dans TikTok LIVE Studio, choisis « CABLE Output » comme micro.` };
  },
};
const SANS_OBS = new Set(['etat', 'micros', 'micro', 'sorties', 'sortie', 'son-tiktok']);

function resumer(etat) {
  const oui = (b) => (b ? 'oui' : 'non');
  const ecoute = `Tu entends sur : ${etat.son.sortie?.nom ?? '—'}${etat.son.surCable ? ' — ATTENTION : le câble est une sortie de Windows' : ''}`;
  if (!etat.obs.ouvert) return ['OBS : fermé', ecoute];
  return [
    ecoute,
    `OBS : ${etat.obs.collection}, scène ${etat.obs.scene}`,
    `Live : ${oui(etat.live)} · Enregistrement : ${oui(etat.enregistrement)}`,
    `Image TikTok : ${etat.tiktok.image ? `oui (${etat.tiktok.scene})` : 'non'}${etat.cameraObs ? " · la caméra virtuelle d'OBS (image horizontale) tourne" : ''}`,
    `Son TikTok : ${etat.son.branche ? `piste ${etat.son.piste} vers ${etat.son.cable}` : `à régler (câble : ${etat.son.cable ?? 'absent'}, Audio Monitor : ${etat.son.installe ? 'installé' : 'absent'})`}`,
    `Micro : ${etat.micro?.nom ?? '—'}`,
  ];
}

const [commande = 'etat', ...reste] = process.argv.slice(2);
const json = reste.includes('--json');
const argument = reste.find((a) => a !== '--json');
let resultat;
let obs;
try {
  if (!COMMANDES[commande]) throw new Refus(`Commande inconnue : ${commande}. Commandes : ${Object.keys(COMMANDES).join(', ')}.`);
  obs = commande === 'son-tiktok' ? undefined : await connecterObs(2500);
  if (!obs && !SANS_OBS.has(commande)) throw new Refus("OBS est fermé (ou obs-websocket ne répond pas) : ouvre OBS d'abord.");
  const fait = await COMMANDES[commande](obs, argument);
  resultat = { ok: true, ...fait, etat: await lireEtat(obs) };
} catch (erreur) {
  const message = erreur instanceof Refus ? erreur.message : `Erreur : ${erreur instanceof Error ? erreur.message : String(erreur)}`;
  let etat;
  try { etat = await lireEtat(obs); } catch { /* l'état n'est qu'un complément */ }
  resultat = { ok: false, message, ...(etat ? { etat } : {}) };
} finally {
  obs?.fermer();
}
if (json) console.log(JSON.stringify(resultat));
else {
  console.log(resultat.message);
  for (const m of [...(resultat.micros ?? []), ...(resultat.sorties ?? [])]) console.log(`  ${m.nom}  →  ${m.id}`);
  if (resultat.etat) console.log(resumer(resultat.etat).map((l) => `  ${l}`).join('\n'));
}
process.exitCode = resultat.ok ? 0 : 1;
