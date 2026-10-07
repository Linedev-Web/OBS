// Demande à OBS, par obs-websocket, le nom de la collection de scènes ouverte. Lecture seule.
// Le mot de passe est lu dans la configuration locale d'OBS et n'est jamais affiché.
// Renvoie undefined si OBS est fermé ou ne répond pas : l'appelant se rabat alors sur user.ini.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const CONFIG = path.join(process.env.APPDATA ?? '', 'obs-studio', 'plugin_config', 'obs-websocket', 'config.json');

export function collectionOuverte(delaiMs = 1500) {
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch { return Promise.resolve(undefined); }
  return new Promise((resolve) => {
    let ws;
    let fini = false;
    const finir = (valeur) => {
      if (fini) return;
      fini = true;
      clearTimeout(minuterie);
      try { ws?.close(); } catch { /* déjà fermé */ }
      resolve(valeur);
    };
    const minuterie = setTimeout(() => finir(undefined), delaiMs);
    try { ws = new WebSocket(`ws://127.0.0.1:${cfg.server_port}`); } catch { finir(undefined); return; }
    ws.onerror = () => finir(undefined);
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.op === 0) {
        const d = { rpcVersion: 1, eventSubscriptions: 0 };
        if (m.d.authentication) {
          const { challenge, salt } = m.d.authentication;
          const secret = crypto.createHash('sha256').update(cfg.server_password + salt).digest('base64');
          d.authentication = crypto.createHash('sha256').update(secret + challenge).digest('base64');
        }
        ws.send(JSON.stringify({ op: 1, d }));
      } else if (m.op === 2) {
        ws.send(JSON.stringify({ op: 6, d: { requestType: 'GetSceneCollectionList', requestId: 'collection' } }));
      } else if (m.op === 7 && m.d.requestId === 'collection') {
        finir(m.d.responseData?.currentSceneCollectionName);
      }
    };
  });
}
