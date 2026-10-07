# D:\Stream\OBS — habillage et réglages des lives

Dépôt `git@github.com:Linedev-Web/OBS.git` (branche `main`). Tout ce qui s’affiche ou se joue pendant un live du client :
overlays des scènes OBS, alertes StreamElements, musique des écrans d’attente, collections et profils OBS, bannières et
textes des chaînes. Refonte complète le 2026-10-07 (demande du client : « comme les grands streamers, propre, épuré, que
ça ne se voie pas que c’est fait par une IA »).

## Où est quoi

| Dossier | Contenu |
|---|---|
| `obs\seances.json` | **Source unique** : les trois séances (Live — Gaming, Live — Montage, Live — Dev), leurs scènes, touches, rôles, et la position de chaque caméra, capture et chat (`cadres`). Lu aussi par la page Live du cockpit. |
| `obs\generer.mjs` | Écrit les collections OBS `Live_Gaming.json`, `Live_Montage.json`, `Live_Dev.json` dans `%APPDATA%\obs-studio\basic\scenes\` (`node obs/generer.mjs` simule, `--ecrire` écrit). Reprend caméra, micro, jeu, fenêtre, Discord et chat de la collection Plateau. Ne réécrit jamais la collection ouverte dans OBS ; garde l’adresse des alertes déjà posée. |
| `overlays\latshow\`, `overlays\linedev\` | Habillages HTML (maquette 1920×1080, sources OBS en 2560×1440). `overlays\commun\scene.js` : mise à l’échelle, textes du jour, compte à rebours. |
| `overlays\live.js` | Textes du jour (jeu, sujet du cours, étape, prochain live), écrit par la page Live du cockpit, relu toutes les 2 s. |
| `alertes\streamelements\` | Widgets d’alertes sur mesure (Latshow, linedev) + `README.md` (pose dans StreamElements) + `apercu.html`. |
| `musique\` | 16 morceaux maison ACE-Step (`composer.py`, `catalogue.json` : graines, régénérables). Joués en boucle par les sources VLC des écrans Démarrage, Pause, Pause bébé, Fin. |
| `chaines\` | Bannières, panneaux et textes Twitch / YouTube **à valider** : `chaines\A_VALIDER.md`. Rien n’est publié sans le oui du client. |
| `docs\CHARTE_LIVE.md` | Règles de style (à lire avant de toucher un visuel). |
| `Gaming\`, `GamingV2\`, `Job\`, `Matt\`, `banner_generator.html` | Ancien pack, à archiver au ménage (le client l’a demandé, après validation du nouveau). |

## Règles

- **Charte** : `docs\CHARTE_LIVE.md`. Aucun trait décoratif à côté ou sous un texte (« ça fait IA ») : un point ou une petite forme géométrique. Tout en français, tutoiement.
- Une modification de scène passe par `obs\seances.json` puis `node obs/generer.mjs --ecrire`, **OBS fermé ou sur une autre collection** ; jamais à la main dans le JSON d’OBS.
- OBS tourne en **administrateur** : une session ne peut ni le fermer ni lui envoyer de touches. On le pilote par obs-websocket (port 4455, mot de passe lu dans `%APPDATA%\obs-studio\plugin_config\obs-websocket\config.json`, jamais affiché). Ne jamais relancer OBS pendant qu’il tourne : une seconde instance s’ouvre en mode sans échec et réécrit la collection sans ses modules (incident du 2026-10-07, Plateau restauré depuis sa copie).
- Ne jamais afficher ni versionner : clé de stream, adresse d’un overlay StreamElements (elle contient une clé), `.env`, `Sans_nom\`.
- Twitch : la chaîne est **twitch.tv/latshow** (plus `latshow_` depuis 2026-10-07). TikTok gaming reste `@latshow_`.
- Médias (sons, images, polices) non versionnés : ils vivent sur le disque et sont sauvegardés par le NAS.
