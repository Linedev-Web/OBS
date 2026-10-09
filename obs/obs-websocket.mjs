// Petit client obs-websocket v5 pour les outils du dépôt (générateur, régie).
// Le mot de passe est lu dans la configuration locale d'OBS et n'est jamais affiché.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const CONFIG = path.join(process.env.APPDATA ?? '', 'obs-studio', 'plugin_config', 'obs-websocket', 'config.json');

/**
 * Se connecte à OBS. Renvoie undefined si OBS est fermé ou ne répond pas dans le délai.
 * Le client : req(type, données) → réponse obs-websocket ({ requestStatus, responseData }) ;
 * vendeur(module, type, données) → réponse du module (CallVendorRequest), ou undefined s'il n'existe pas ; fermer().
 * Options : `evenements` (masque des catégories d'événements d'obs-websocket, 0 par défaut), `surEvenement(type,
 * données)`, et `surFermeture()` quand OBS coupe la connexion après qu'elle a été établie.
 */
export function connecterObs(delaiMs = 1500, { evenements = 0, surEvenement, surFermeture } = {}) {
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch { return Promise.resolve(undefined); }
  return new Promise((resolve) => {
    let ws;
    let n = 0;
    const attente = new Map();
    let pret = false;
    const minuterie = setTimeout(() => { if (!pret) { try { ws?.close(); } catch { /* déjà fermé */ } resolve(undefined); } }, delaiMs);
    const client = {
      req(requestType, requestData = {}) {
        const requestId = `r${++n}`;
        return new Promise((ok) => { attente.set(requestId, ok); ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } })); });
      },
      async vendeur(vendorName, requestType, requestData = {}) {
        const r = await client.req('CallVendorRequest', { vendorName, requestType, requestData });
        return r.requestStatus?.result ? (r.responseData?.responseData ?? {}) : undefined;
      },
      fermer() { try { ws.close(); } catch { /* déjà fermé */ } },
    };
    try { ws = new WebSocket(`ws://127.0.0.1:${cfg.server_port}`); } catch { clearTimeout(minuterie); resolve(undefined); return; }
    ws.onerror = () => { if (!pret) { clearTimeout(minuterie); resolve(undefined); } };
    ws.onclose = () => {
      for (const ok of attente.values()) ok({ requestStatus: { result: false, comment: 'OBS a fermé la connexion' } });
      attente.clear();
      if (pret) surFermeture?.();
    };
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.op === 0) {
        const d = { rpcVersion: 1, eventSubscriptions: evenements };
        if (m.d.authentication) {
          const { challenge, salt } = m.d.authentication;
          const secret = crypto.createHash('sha256').update(cfg.server_password + salt).digest('base64');
          d.authentication = crypto.createHash('sha256').update(secret + challenge).digest('base64');
        }
        ws.send(JSON.stringify({ op: 1, d }));
      } else if (m.op === 2) {
        pret = true;
        clearTimeout(minuterie);
        resolve(client);
      } else if (m.op === 7) {
        const ok = attente.get(m.d.requestId);
        if (ok) { attente.delete(m.d.requestId); ok(m.d); }
      } else if (m.op === 5) {
        surEvenement?.(m.d.eventType, m.d.eventData);
      }
    };
  });
}

/** Nom de la collection de scènes ouverte dans OBS, ou undefined si OBS est fermé (l'appelant lit alors user.ini). */
export async function collectionOuverte(delaiMs = 1500) {
  const obs = await connecterObs(delaiMs);
  if (!obs) return undefined;
  try { return (await obs.req('GetSceneCollectionList')).responseData?.currentSceneCollectionName; } finally { obs.fermer(); }
}
