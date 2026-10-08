# Tout retrouver sur un nouveau PC — OBS et Stream Deck des lives

Écrit le 2026-10-08, à la demande du client (« pour ne rien perdre si un jour je change de PC »). Une session Claude
ouverte dans `D:\Stream\OBS` peut faire presque tout ; ce qui demande tes comptes (clés, connexions) est marqué **toi**.

## Ce qui est sauvegardé, et où

| Quoi | Où c'est gardé |
|---|---|
| Code, habillages HTML, widgets d'alertes, réglages des séances, générateurs | ce dépôt git (`git@github.com:Linedev-Web/OBS.git`) |
| Collections OBS, profils, réglages généraux, profil Stream Deck (pages et images des touches) | ce dépôt, dossier `sauvegarde\` (copie faite par `node sauvegarde/sauvegarder.mjs`) |
| Polices des habillages et des transitions | ce dépôt (le filtre du NAS exclut les polices) |
| Musique des écrans d'attente, jingles d'alertes, vidéos de transition, images des chaînes | **uniquement sur ce PC** tant que `D:\Stream\OBS` n'a pas sa tâche de sauvegarde NAS (voir plus bas) ; sinon, on les refait (voir « Refaire les médias ») |
| Overlays d'alertes StreamElements | en ligne chez StreamElements (et leur code dans `alertes\streamelements\`) |
| Clé de stream, adresses des alertes et du chat, mot de passe websocket, connexions StreamElements | **jamais copiés** (ce sont des secrets) : à reposer, liste dans `inventaire.json` → `a_reposer` |

## Sur le nouveau PC

1. **Outils** : Git, Node 24, Chrome ; Python seulement pour refaire la musique ou les jingles.
2. **Le dépôt** : `git clone git@github.com:Linedev-Web/OBS.git D:\Stream\OBS`. Les médias : depuis le NAS
   (`home/Backup/<ancien PC>/D/Stream/OBS/`) une fois la tâche en place, sinon « Refaire les médias ».
3. **OBS** : installer la version de `inventaire.json` (`obs.version`, 32.2.2 au 2026-10-08), puis les modules de
   `obs.modules_ajoutes` : Move Transition et Source Record (Exeldro, forum OBS), Background Removal (royshil),
   Advanced Masks, StreamElements SE.Live (site StreamElements), le module Logitech (installé par Logi Options+ / G HUB),
   celui de Streamlabs si tu t'en sers encore. **VLC 64 bits** pour la musique des écrans d'attente. Le module
   Stream Deck s'installe avec le logiciel Stream Deck.
4. Ouvrir OBS une fois, le **fermer**, puis copier :
   - `sauvegarde\obs\profiles\*` → `%APPDATA%\obs-studio\basic\profiles\`
   - `sauvegarde\obs\scenes\*` (avec `_archives_live\`) → `%APPDATA%\obs-studio\basic\scenes\`
   - facultatif : `sauvegarde\obs\user.ini` et `global.ini` → `%APPDATA%\obs-studio\` (disposition des fenêtres).
5. Rouvrir OBS **en administrateur** (comme avant : capture des jeux protégés). Dans chaque collection, rouvrir les
   propriétés de **Caméra**, **Micro**, **Discord** et de la capture : les identifiants des appareils changent d'un PC à
   l'autre, il suffit de les choisir dans la liste. Puis, OBS sur une autre collection, `node obs/generer.mjs --ecrire`
   (le générateur reprend tes appareils dans `_archives_live\Plateau_reference.json`).
6. **Toi** — reposer les secrets (`inventaire.json` → `a_reposer`) :
   - **Clé de stream** : profil Live — Latshow → Paramètres → Stream (clé du tableau de bord Twitch), ou reconnexion de
     StreamElements SE.Live (multistream Twitch + YouTube Latshow) ;
   - **Alertes** : StreamElements → Mes overlays → « Copier l'URL » de chacun des trois overlays (Latshow — Alertes
     Twitch, Latshow — Alertes YouTube, linedev — Alertes YouTube), à coller dans les sources « Alertes » et « Alertes
     YouTube » (Gaming et Montage), « Alertes » (Dev). Une session Claude sait le faire sans afficher l'adresse ;
   - **Chat** : Social Stream Ninja → ta session → l'adresse de l'overlay, dans la source « Chat » ;
   - **obs-websocket** : Outils → Paramètres du serveur WebSocket → activer, mot de passe (le Stream Deck et Claude s'en
     servent) ;
   - **StreamElements SE.Live** : te reconnecter (Twitch, YouTube).
7. **Stream Deck** : installer le logiciel (`streamdeck.version`), le **fermer**, copier
   `sauvegarde\streamdeck\ProfilesV3\*` → `%APPDATA%\Elgato\StreamDeck\ProfilesV3\`, le relancer, puis installer depuis
   la boutique Elgato les modules de `streamdeck.modules` (OBS Studio, Twitchat, Voicemod, TikTok LIVE Studio,
   StreamElements SE.Live, météo…). Pour ne refaire que les pages Live : `node streamdeck/generer.mjs --ecrire`.
8. **Vérifier** : chaque collection s'ouvre, la musique joue sur Démarrage, une alerte d'essai s'affiche centrée avec son
   jingle, la transition Tuiles 3D passe entre deux scènes, les touches du Stream Deck changent de scène.

## Refaire les médias (s'ils sont perdus)

- Transitions : `node transitions/rendre.mjs` (bruitages repris de `D:\Stream\Dev\Assets\Sons`, sauvegardé sur le NAS).
- Images des chaînes : `python chaines/rendre.py`. Icônes du Stream Deck : `node streamdeck/generer.mjs`.
- Musique : `musique/composer.py` (graines dans `musique/catalogue.json`, ComfyUI + ACE-Step 1.5).
- Jingles : `alertes/sons/composer_jingles.py` ; ils sont aussi en ligne sur le CDN de StreamElements
  (`alertes/sons/urls-streamelements.json`).

## Garder la sauvegarde à jour

Après tout changement dans OBS ou le Stream Deck : `node sauvegarde/sauvegarder.mjs`, puis commit et push. Le script
s'arrête et efface sa copie si un secret reconnaissable y reste.

## À faire une fois (toi) : mettre `D:\Stream\OBS` sur le NAS

Le NAS sauvegarde `Pilotage`, `Rush`, `Montage` et `Dev`, pas `OBS`. Dans Synology Drive Client, ajouter une tâche de
sauvegarde `D:\Stream\OBS` → `home/Backup/<PC>/D/Stream/OBS/`, avec le **modèle de filtre** (sinon le filtre est perdu :
`D:\Stream\Pilotage\stockage\NAS.md`, « Les règles décidées »).
