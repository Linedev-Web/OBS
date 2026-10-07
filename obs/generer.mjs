// Génère les collections de scènes OBS des lives à partir de obs/seances.json.
//
//   node obs/generer.mjs            simulation : ce qui serait écrit
//   node obs/generer.mjs --ecrire   écrit Live_Gaming.json, Live_Montage.json, Live_Dev.json
//                                   dans %APPDATA%\obs-studio\basic\scenes\ (ancienne version sauvegardée à côté)
//
// Les réglages des périphériques (caméra MX Brio et sa correction couleur, micro FIFINE, jeu, fenêtre, Discord, chat)
// sont repris de la collection de référence (Plateau, celle où la caméra a été réglée) : on ne les réinvente pas.
// Un fichier de collection actuellement ouvert dans OBS n'est jamais réécrit (OBS l'écraserait en quittant).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const SCENES_OBS = path.join(process.env.APPDATA, 'obs-studio', 'basic', 'scenes');
const REFERENCE = path.join(SCENES_OBS, 'Plateau.json');
const ECRIRE = process.argv.includes('--ecrire');

const conf = JSON.parse(fs.readFileSync(path.join(ICI, 'seances.json'), 'utf8'));
const ref = JSON.parse(fs.readFileSync(REFERENCE, 'utf8'));
const [W, H] = conf.canevas.obs;
const K = W / conf.canevas.maquette[0]; // 4/3
const CANEVAS = '6c69626f-6273-4c00-9d88-c5136d61696e'; // canevas principal d'OBS
const VERSION = ref.sources[0]?.prev_ver ?? 537001986;
const OVERLAYS = path.join(RACINE, 'overlays').replaceAll('\\', '/');
const MUSIQUE = path.join(RACINE, 'musique').replaceAll('\\', '/');

const refSource = (nom) => {
  const s = ref.sources.find((x) => x.name === nom);
  if (!s) throw new Error(`Source « ${nom} » absente de la collection de référence ${REFERENCE}`);
  return structuredClone(s);
};

// « Ctrl+Alt+F1 » -> combinaison OBS
function touche(texte) {
  const morceaux = texte.split('+');
  const k = morceaux.pop();
  return { control: morceaux.includes('Ctrl'), alt: morceaux.includes('Alt'), shift: morceaux.includes('Maj') || morceaux.includes('Shift'), command: false, key: `OBS_KEY_${k.toUpperCase()}` };
}

const vide = () => ({ 'libobs.mute': [], 'libobs.unmute': [], 'libobs.push-to-mute': [], 'libobs.push-to-talk': [] });
function source(nom, id, settings, extra = {}) {
  return {
    prev_ver: VERSION, name: nom, uuid: crypto.randomUUID(), id, versioned_id: extra.versioned_id ?? id, settings,
    mixers: extra.mixers ?? 255, sync: extra.sync ?? 0, flags: extra.flags ?? 0, volume: extra.volume ?? 1, balance: 0.5,
    enabled: true, muted: false, 'push-to-mute': false, 'push-to-mute-delay': 0, 'push-to-talk': false, 'push-to-talk-delay': 0,
    hotkeys: extra.hotkeys ?? vide(), deinterlace_mode: 0, deinterlace_field_order: 0, monitoring_type: 0, private_settings: {},
    ...(extra.filters ? { filters: extra.filters } : {}),
  };
}
function filtre(nom, id, versioned, settings, enabled = true) {
  return { prev_ver: VERSION, name: nom, uuid: crypto.randomUUID(), id, versioned_id: versioned, settings, mixers: 0, sync: 0, flags: 0, volume: 1, balance: 0.5, enabled, muted: false, 'push-to-mute': false, 'push-to-mute-delay': 0, 'push-to-talk': false, 'push-to-talk-delay': 0, hotkeys: {}, deinterlace_mode: 0, deinterlace_field_order: 0, monitoring_type: 0, private_settings: {} };
}
// Baisse un son (jeu, son du PC) quand le micro parle : compresseur déclenché par le micro.
const attenuation = () => filtre('Baisse quand tu parles', 'compressor_filter', 'compressor_filter', { ratio: 4, threshold: -32, attack_time: 10, release_time: 400, output_gain: 0, sidechain_source: 'Micro' });
const CSS_BASE = 'body{background-color:rgba(0,0,0,0);margin:0;overflow:hidden}';

// ---------- Sources partagées d'une collection ----------
function sourcesCommunes(seance) {
  const camRef = refSource('Périphérique de capture vidéo');
  const couleur = (camRef.filters || []).find((f) => f.id === 'color_filter');
  const enreg = (camRef.filters || []).find((f) => f.id === 'source_record_filter');
  const camera = source('Caméra', 'dshow_input', camRef.settings, {
    mixers: camRef.mixers, versioned_id: camRef.versioned_id,
    filters: [
      ...(couleur ? [filtre('Couleurs', couleur.id, couleur.versioned_id, couleur.settings)] : []),
      // Enregistrement séparé de la webcam pendant le live (module Source Record, réglages de Plateau) : voulu par le client.
      ...(enreg ? [filtre('Enregistrement caméra', enreg.id, enreg.versioned_id, enreg.settings, true)] : []),
    ],
    hotkeys: {},
  });

  const micRef = refSource('Capture audio (entrée)');
  const micro = source('Micro', 'wasapi_input_capture', micRef.settings, {
    mixers: 255, sync: micRef.sync, flags: micRef.flags,
    filters: [
      // Chaîne voix : bruit de fond retiré, silences adoucis (clavier), un peu moins de grave et plus de clarté,
      // niveau égalisé, plafond de sécurité. Le micro FIFINE K658 est dynamique : pas besoin d'une porte dure.
      filtre('Réduction du bruit', 'noise_suppress_filter', 'noise_suppress_filter_v2', { method: 'rnnoise' }),
      filtre('Expandeur', 'expander_filter', 'expander_filter', { presets: 'expander', ratio: 3, threshold: -42, attack_time: 10, release_time: 120, output_gain: 0, detector: 'RMS' }),
      filtre('Égaliseur', 'basic_eq_filter', 'basic_eq_filter', { low: -2, mid: 0, high: 1.5 }),
      filtre('Compresseur', 'compressor_filter', 'compressor_filter', { ratio: 3, threshold: -20, attack_time: 5, release_time: 80, output_gain: 4 }),
      filtre('Limiteur', 'limiter_filter', 'limiter_filter', { threshold: -1.5, release_time: 60 }),
    ],
    hotkeys: { 'libobs.mute': [touche(conf.raccourcis_communs.micro_couper)], 'libobs.unmute': [touche(conf.raccourcis_communs.micro_retablir)], 'libobs.push-to-mute': [], 'libobs.push-to-talk': [] },
  });

  const s = { camera, micro };
  if (seance.id === 'gaming') {
    const jeuRef = refSource('Capture de jeu');
    s.capture = source('Capture du jeu', 'game_capture', { ...jeuRef.settings, capture_audio: true }, { volume: 0.32, mixers: 255, hotkeys: { ...vide(), hotkey_start: [], hotkey_stop: [] },
      filters: [attenuation(), filtre('Limiteur', 'limiter_filter', 'limiter_filter', { threshold: -6, release_time: 60 })] });
    const disco = refSource('Discord');
    // Discord : les voix des amis ramenées au même niveau, sans les faire baisser quand tu parles.
    s.discord = source('Discord', 'wasapi_process_output_capture', disco.settings, { volume: 0.85, filters: [
      filtre('Compresseur', 'compressor_filter', 'compressor_filter', { ratio: 3, threshold: -24, attack_time: 6, release_time: 80, output_gain: 2 }),
      filtre('Limiteur', 'limiter_filter', 'limiter_filter', { threshold: -3, release_time: 60 })] });
  } else {
    const fen = refSource('Fenettre');
    s.capture = source('Fenêtre', 'window_capture', { ...fen.settings, method: 2, cursor: true, client_area: true }, { mixers: 0, hotkeys: {} });
    const pc = refSource('Capture audio (sortie)');
    s.sonpc = source('Son du PC', 'wasapi_output_capture', pc.settings, { volume: 0.5, filters: [attenuation(), filtre('Limiteur', 'limiter_filter', 'limiter_filter', { threshold: -6, release_time: 60 })] });
  }
  const chatRef = refSource('Social chatting');
  s.chat = source('Chat', 'browser_source', { url: chatRef.settings.url, width: 440, height: 840, css: CSS_BASE, fps_custom: true, fps: 30 }, { mixers: 0, hotkeys: { ...vide(), 'ObsBrowser.Refresh': [] } });
  s.alertes = source('Alertes', 'browser_source', { url: '', width: 1920, height: 1080, css: CSS_BASE }, { hotkeys: { ...vide(), 'ObsBrowser.Refresh': [] } });
  // Latshow diffuse aussi sur YouTube (multistream StreamElements) : la chaîne YouTube a son propre overlay d'alertes.
  if (seance.marque === 'latshow') s.alertesYoutube = source('Alertes YouTube', 'browser_source', { url: '', width: 1920, height: 1080, css: CSS_BASE }, { hotkeys: { ...vide(), 'ObsBrowser.Refresh': [] } });
  return s;
}

const RELANCE = new Set(['demarrage', 'pause', 'pause-bebe', 'souci']); // chronos qui repartent à chaque affichage
function overlay(seance, scene) {
  return source(`Habillage — ${scene.nom}`, 'browser_source', {
    is_local_file: true, local_file: `${OVERLAYS}/${scene.overlay}`, width: W, height: H, fps_custom: true, fps: 30,
    restart_when_active: RELANCE.has(scene.id), shutdown: false, reroute_audio: false,
    css: `${CSS_BASE} :root{--seance:${seance.id}}`,
  }, { mixers: 0, hotkeys: { ...vide(), 'ObsBrowser.Refresh': [] } });
}
function musique(cle) {
  const dossier = `${MUSIQUE}/${cle}`;
  return source(`Musique — ${cle.replace('/', ' ')}`, 'vlc_source', {
    playlist: [{ value: dossier, hidden: false, selected: false }], loop: true, shuffle: true, playback_behavior: 'stop_restart', network_caching: 400,
  }, { volume: 0.6, hotkeys: { ...vide(), 'VLC_PLAY_PAUSE': [], 'VLC_RESTART': [], 'VLC_STOP': [], 'VLC_PLAYLIST_NEXT': [], 'VLC_PLAYLIST_PREV': [] } });
}

// ---------- Éléments de scène ----------
function element(src, id, rect, ajustement = 'interieur') {
  const base = {
    name: src.name, source_uuid: src.uuid, visible: true, locked: true, rot: 0, align: 5,
    bounds_type: 0, bounds_align: 0, bounds_crop: false, crop_left: 0, crop_top: 0, crop_right: 0, crop_bottom: 0, id,
    group_item_backup: false, pos: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, bounds: { x: 0, y: 0 }, scale_filter: 'disable',
    blend_method: 'default', blend_type: 'normal', show_transition: { duration: 0 }, hide_transition: { duration: 0 }, private_settings: {},
  };
  if (!rect) return base; // source plein canevas à sa taille (overlays 2560x1440) ou purement audio
  const [x, y, w, h] = rect;
  return {
    ...base, pos: { x: x * K, y: y * K }, bounds: { x: w * K, y: h * K },
    // intérieur : tout est visible (capture) ; extérieur : remplit le cadre en rognant (caméra) ; étirer : taille exacte (navigateur)
    bounds_type: ajustement === 'exterieur' ? 3 : ajustement === 'etirer' ? 1 : 2, bounds_crop: ajustement === 'exterieur',
  };
}

function rectChat(cadres, scene) {
  if (scene.id === 'discussion') return cadres['chat.discussion'];
  if (scene.camera === 'colonne') return cadres['chat.colonne'];
  return cadres['chat.attente'];
}
function rectCapture(cadres, scene) {
  if (scene.camera === 'colonne') return cadres['capture.cadree'];
  if (scene.camera === 'cote') return cadres['capture.cote'];
  return [0, 0, 1920, 1080];
}

function construire(seance) {
  const cadres = conf.cadres[seance.marque];
  const com = sourcesCommunes(seance);
  const sources = Object.values(com);
  const musiques = new Map();
  const scenes = [];
  for (const sc of seance.scenes) {
    const items = [];
    let n = 0;
    const ajouter = (src, rect, aj) => items.push(element(src, ++n, rect, aj));
    const ov = sc.overlay ? overlay(seance, sc) : null;
    if (ov) sources.push(ov);
    const pleinEcran = sc.capture && (!sc.camera || sc.camera === 'coin');
    // Ordre de bas en haut : capture plein écran puis habillage par-dessus ; sinon habillage en fond puis la capture cadrée.
    if (pleinEcran) { ajouter(com.capture, rectCapture(cadres, sc), 'interieur'); if (ov) ajouter(ov); }
    else { if (ov) ajouter(ov); if (sc.capture) ajouter(com.capture, rectCapture(cadres, sc), 'interieur'); }
    if (sc.camera) ajouter(com.camera, cadres[`camera.${sc.camera}`], 'exterieur');
    if (sc.chat) ajouter(com.chat, rectChat(cadres, sc), 'etirer');
    // Son : le micro n'est présent que là où l'on parle (Pause, Pause bébé, Souci technique le coupent d'office).
    if (!sc.micro_coupe) ajouter(com.micro);
    if (sc.capture && com.sonpc) ajouter(com.sonpc);
    if (com.discord && (sc.capture || sc.id === 'discussion')) ajouter(com.discord);
    if (sc.musique) {
      if (!musiques.has(sc.musique)) { const m = musique(sc.musique); musiques.set(sc.musique, m); sources.push(m); }
      ajouter(musiques.get(sc.musique));
    }
    ajouter(com.alertes);
    if (com.alertesYoutube) ajouter(com.alertesYoutube);
    const hk = { 'OBSBasic.SelectScene': [touche(sc.touche)] };
    for (const it of items) { hk[`libobs.show_scene_item.${it.id}`] = []; hk[`libobs.hide_scene_item.${it.id}`] = []; }
    scenes.push({ ...source(sc.nom, 'scene', { id_counter: n, custom_size: false, items }, { mixers: 0, hotkeys: hk }), canvas_uuid: CANEVAS });
  }
  return {
    name: seance.nom,
    groups: [],
    scene_order: seance.scenes.map((s) => ({ name: s.nom })),
    current_scene: seance.scenes[0].nom,
    current_program_scene: seance.scenes[0].nom,
    current_transition: 'Fondu', transition_duration: 300, transitions: [], quick_transitions: [],
    saved_projectors: [], preview_locked: false, scaling_enabled: false, scaling_level: 0, scaling_off_x: 0, scaling_off_y: 0,
    modules: {}, resolution: { x: W, y: H }, version: ref.version ?? 2,
    sources: [...sources, ...scenes],
  };
}

const FICHIERS = { gaming: 'Live_Gaming.json', montage: 'Live_Montage.json', dev: 'Live_Dev.json' };
const ouverte = (() => { try { return /SceneCollectionFile=(.+)/.exec(fs.readFileSync(path.join(process.env.APPDATA, 'obs-studio', 'user.ini'), 'utf8'))?.[1]?.trim(); } catch { return undefined; } })();
const horodatage = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
for (const seance of conf.seances) {
  const col = construire(seance);
  const fichier = path.join(SCENES_OBS, FICHIERS[seance.id]);
  const resume = col.scene_order.map((s) => s.name).join(' | ');
  if (!ECRIRE) { console.log(`[simulation] ${FICHIERS[seance.id]} — ${seance.nom} : ${resume} (${col.sources.length} sources)`); continue; }
  if (ouverte === FICHIERS[seance.id]) { console.log(`IGNORÉ ${FICHIERS[seance.id]} : collection ouverte dans OBS, change de collection puis relance.`); continue; }
  if (fs.existsSync(fichier)) {
    // L'adresse des alertes StreamElements (avec sa clé) n'est posée que dans OBS : on la garde d'une génération à l'autre.
    const avant = JSON.parse(fs.readFileSync(fichier, 'utf8')).sources;
    for (const nom of ['Alertes', 'Alertes YouTube']) {
      const ancienne = avant.find((s) => s.name === nom)?.settings?.url;
      const neuve = col.sources.find((s) => s.name === nom);
      if (ancienne && neuve) neuve.settings.url = ancienne;
    }
    const archives = path.join(SCENES_OBS, '_archives_live');
    fs.mkdirSync(archives, { recursive: true });
    fs.copyFileSync(fichier, path.join(archives, `${horodatage}_${FICHIERS[seance.id]}`));
  }
  fs.writeFileSync(fichier + '.tmp', JSON.stringify(col, null, 4));
  JSON.parse(fs.readFileSync(fichier + '.tmp', 'utf8'));
  fs.renameSync(fichier + '.tmp', fichier);
  console.log(`écrit ${fichier} — ${resume}`);
}
