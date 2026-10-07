# D:\Stream\OBS — habillage et réglages des lives

Dépôt `git@github.com:Linedev-Web/OBS.git` (branche `main`). Tout ce qui s’affiche ou se joue pendant un live du client :
overlays des scènes OBS, alertes StreamElements, musique des écrans d’attente, collections et profils OBS, bannières et
textes des chaînes. Refonte complète le 2026-10-07 (demande du client : « comme les grands streamers, propre, épuré, que
ça ne se voie pas que c’est fait par une IA »).

## Où est quoi

| Dossier | Contenu |
|---|---|
| `obs\seances.json` | **Source unique** : les trois séances (Live — Gaming, Live — Montage, Live — Dev), leurs scènes, touches, rôles, et la position de chaque caméra, capture et chat (`cadres`). Lu aussi par la page Live du cockpit. |
| `obs\generer.mjs` | Écrit les collections OBS `Live_Gaming.json`, `Live_Montage.json`, `Live_Dev.json` dans `%APPDATA%\obs-studio\basic\scenes\` (`node obs/generer.mjs` simule, `--ecrire` écrit). Reprend caméra, micro, jeu, fenêtre, Discord et chat d’une copie de l’ancienne collection Plateau (`scenes\_archives_live\Plateau_reference.json`), retirée d’OBS le 2026-10-07 : ne pas l’effacer. Ne réécrit jamais la collection ouverte dans OBS (demandée à OBS par obs-websocket, `obs\obs-websocket.mjs` ; `user.ini` seulement si OBS est fermé, car il n’est réécrit qu’à la fermeture) ; garde l’adresse des alertes déjà posée. |
| `overlays\latshow\`, `overlays\linedev\` | Habillages HTML (maquette 1920×1080, sources OBS en 2560×1440). `overlays\commun\scene.js` : mise à l’échelle, textes du jour, compte à rebours. |
| `overlays\live.js` | Textes du jour (jeu, sujet du cours, étape, prochain live), écrit par la page Live du cockpit, relu toutes les 2 s. |
| `alertes\streamelements\` | Widgets d’alertes v2 (2026-10-07, façon After Effects : titre qui claque, sticker, bulle drôle, gerbe de losanges, jingle par type). En ligne sur trois overlays : Latshow Twitch, Latshow YouTube, linedev YouTube. `widget.js` identique dans les deux dossiers ; `node test-widget.mjs` ; `apercu.html`. Mise en ligne par l’API StreamElements depuis le tableau de bord (session du client), jamais par copier-coller. Le son des sources « Alertes » d’OBS passe par OBS (sinon les spectateurs ne l’entendent pas). Les sources « Alertes » font **1920×1080** (la taille de la page StreamElements) et sont **étirées** sur le canevas 2560×1440 : en 2560×1440, la page restait collée en haut à gauche et l’alerte paraissait petite et décentrée. |
| `alertes\sons\` | 14 jingles maison (ACE-Step + whoosh/impact Pixabay, -14 LUFS) : `composer_jingles.py`, `catalogue.json`, `urls-streamelements.json` (adresses publiques du CDN StreamElements où ils sont déposés). |
| `transitions\` | Transition de scène **« Tuiles 3D »** (stinger, demande du client, 2026-10-07 : « une animation en mode élément en 3D ») : un mur de tuiles en 3D se retourne de gauche à droite, le nom de la chaîne arrive en relief, OBS change de scène à 620 ms quand tout est couvert. `index.html` (HyperFrames, variable `marque` : losanges nuit et vague cyan pour Latshow, carrés papier et vague vermillon pour linedev) ; `node transitions/rendre.mjs [latshow\|linedev]` → `transition_<marque>.webm` (VP9 transparent, son whoosh, 1,5 s à 60 i/s) ; déclarée par `obs\generer.mjs` comme transition par défaut des trois séances. OBS tient le fichier de la collection ouverte : changer de collection avant de refaire un rendu. |
| `musique\` | 16 morceaux maison ACE-Step (`composer.py`, `catalogue.json` : graines, régénérables). Joués en boucle par les sources VLC des écrans Démarrage, Pause, Pause bébé, Fin. |
| `chaines\` | Bannières, panneaux et textes Twitch / YouTube **à valider** : `chaines\A_VALIDER.md`. Rien n’est publié sans le oui du client. |
| `docs\CHARTE_LIVE.md` | Règles de style (à lire avant de toucher un visuel). |
| `_archives/ancien-pack/` | Ancien pack (Gaming, GamingV2, Job, Matt, banner_generator.html, ancien README), archivé au ménage du 2026-10-07. Plus rien ne s’en sert dans OBS depuis le retrait de la collection Plateau (2026-10-07). |

## Règles

- **Charte** : `docs\CHARTE_LIVE.md`. Aucun trait décoratif à côté ou sous un texte (« ça fait IA ») : un point ou une petite forme géométrique. Tout en français, tutoiement.
- Une modification de scène passe par `obs\seances.json` puis `node obs/generer.mjs --ecrire`, **OBS fermé ou sur une autre collection** ; jamais à la main dans le JSON d’OBS.
- OBS tourne en **administrateur** : une session ne peut ni le fermer ni lui envoyer de touches. On le pilote par obs-websocket (port 4455, mot de passe lu dans `%APPDATA%\obs-studio\plugin_config\obs-websocket\config.json`, jamais affiché). Ne jamais relancer OBS pendant qu’il tourne : une seconde instance s’ouvre en mode sans échec et réécrit la collection sans ses modules (incident du 2026-10-07, Plateau restauré depuis sa copie).
- Ne jamais afficher ni versionner : clé de stream, adresse d’un overlay StreamElements (elle contient une clé), `.env`, `Sans_nom\`.
- Twitch : la chaîne est **twitch.tv/latshow** (plus `latshow_` depuis 2026-10-07). TikTok gaming reste `@latshow_`.
- **Dons** : page StreamElements de la chaîne Twitch, `https://streamelements.com/latshow_/tip` (StreamElements a gardé l’ancien nom Twitch comme alias), PayPal relié par le client le 2026-10-07 ; en euros, montants rapides 2, 5, 10, 20 €, messages grossiers masqués (l’alerte passe quand même). Lien du panneau « Soutenir » de Twitch. Si l’alias change un jour, mettre à jour ce panneau.
- Médias (sons, images, polices) non versionnés : ils vivent sur le disque et sont sauvegardés par le NAS.
