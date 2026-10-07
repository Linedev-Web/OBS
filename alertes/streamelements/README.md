# Alertes StreamElements — Latshow et linedev

Deux « Custom widgets » StreamElements, un par marque, selon `docs\CHARTE_LIVE.md` : un bandeau sobre en haut au centre
de l'écran (loin de la caméra en bas à droite et du centre du jeu), une alerte à la fois, dans l'ordre d'arrivée, aucune
perdue, tout en français.

| Dossier | Comptes StreamElements | Style |
|---|---|---|
| `latshow\` | Twitch latshow, YouTube Latshow | nuit `#0F0E1A`, pseudo en Russo One capitales, trait cyan |
| `linedev\` | YouTube linedev | carte papier, gouttière de numéros de ligne, pseudo en Archivo Black souligné vermillon |

`widget.js` est **le même fichier** dans les deux dossiers (vérifier avec `cmp latshow\widget.js linedev\widget.js`) : une
correction se fait dans l'un puis se recopie dans l'autre.

## Poser un widget dans StreamElements

À faire une fois par compte (StreamElements a un compte par chaîne : Twitch latshow, YouTube Latshow, YouTube linedev).

1. streamelements.com → se connecter avec la chaîne → **Streaming tools → Overlays → New overlay**, résolution **1920 × 1080**.
2. **+ (Add widget) → Static / Custom → Custom widget**.
3. Le widget sélectionné : **Settings → Open editor**. Coller, onglet par onglet, le contenu de :
   `widget.html` → HTML, `widget.css` → CSS, `widget.js` → JS, `fields.json` → FIELDS, `data.json` → DATA. **Done**.
4. Panneau de gauche, **Position, size & style** : position 0 × 0, taille 1920 × 1080 (le widget gère lui-même sa place).
5. Panneau de gauche, réglages du widget :
   - **Plateforme de ce compte** : `Twitch` dans l'overlay du compte Twitch latshow, `YouTube` dans celui du compte YouTube
     Latshow (linedev est déjà sur YouTube). « Automatique » lit `channel.provider` s'il est fourni, sinon suppose Twitch.
   - durée d'une alerte, pause entre deux alertes, distance au bord haut, longueur maximale des messages, minimums
     (dons, bits, raids), son facultatif (vide par défaut), volume, devise (vide = celle du compte).
6. Bouton **« Tester toutes les alertes »** (en haut des réglages) : joue un exemple de chaque alerte de la plateforme. Le
   menu **Emulate** de l'éditeur marche aussi.
7. **Save**. Retirer de l'overlay toute autre « AlertBox » StreamElements, sinon chaque événement s'affiche deux fois.
8. Lien de l'overlay (icône lien / « Copy URL » dans la liste des overlays) → source Navigateur « Alertes » d'OBS, en
   1920 × 1080. Ce lien contient une clé : il ne se partage pas et ne se versionne pas.

Durée : `widgetDuration` (FIELDS, 9 s) est le temps maximal pendant lequel StreamElements retient sa propre file pour ce
widget ; le widget la relâche lui-même à la fin de chaque alerte (`SE_API.resumeQueue`). Si tu passes la durée d'une
alerte au-delà de 8 s, monte aussi `widgetDuration` dans l'onglet FIELDS (champ caché).

## Événements

Gérés :

| Écouteur | Twitch | YouTube |
|---|---|---|
| `follower-latest` | « Pseudo te suit » | — |
| `subscriber-latest` | « Pseudo s'abonne · 3 mois · niveau 2 » + message ; cadeau groupé « Pseudo offre 5 abonnements » (une seule alerte, les cadeaux individuels `isCommunityGift` sont ignorés) ; cadeau simple « Pseudo offre un abonnement à X » | « Pseudo s'abonne à la chaîne » |
| `tip-latest` | « Pseudo : 5,00 € » + message (dons StreamElements) | idem |
| `cheer-latest` | « Pseudo : 500 bits » + message (Cheer500… retirés) | — |
| `raid-latest` | « Pseudo arrive avec 42 personnes » | — |
| `sponsor-latest` | — | « Pseudo devient membre · 2 mois » ; adhésions offertes (groupées ou à une personne) |
| `superchat-latest` | — | « Pseudo : 10,00 € » + message |
| `event:skip` | « Passer » depuis le fil d'activité StreamElements : l'alerte en cours se ferme, la suivante arrive | idem |
| `alertService:toggleSound` | coupe / rétablit le son des alertes | idem |
| `widget-button` / `event:test` | bouton « Tester toutes les alertes » | idem |

Ignorés volontairement : `host-latest` (les hosts n'existent plus sur Twitch), `kicks-latest`, Facebook, messages du chat,
points de chaîne, sondages, hype train, objectifs. Non vérifié faute de compte : le montant exact transmis par
StreamElements pour un Super Chat dans une autre devise que celle du compte, et la présence de `channel.provider`
(d'où le réglage explicite de la plateforme à l'étape 5).

## Sécurité des messages

Tout texte venu des spectateurs (pseudo, message de don, Super Chat, bits) est écrit avec `textContent`, jamais
`innerHTML` : un message contenant du HTML ou un `<script>` s'affiche tel quel, rien ne s'exécute (vérifié dans l'aperçu
et par le test). Caractères de contrôle retirés, espaces resserrées, message coupé sur un mot entier (« … »), pseudo coupé
à 25 caractères. Option « Filtrer les grossièretés » : passe le message au filtre de StreamElements (`SE_API.sanitize`),
abandonné au bout de 0,8 s pour ne jamais bloquer la file.

## Polices

Un widget StreamElements ne voit pas les fichiers du PC : les polices viennent de Google Fonts (`@import` en tête de
`widget.css` : Russo One et Inter ; Archivo Black et JetBrains Mono). C'est la seule exception à la règle « tout en local »
de la charte ; si Google Fonts ne répond pas, le texte s'affiche dans la police système, l'alerte part quand même.

## Vérifier sans StreamElements

- Mécanique (file, ordre, aucune perte, « passer », cadeaux groupés, textes, devise, bouton Tester) :
  `node test-widget.mjs` (Node 24, sans dépendance) → « widget.js : 5 scénarios OK ».
- Rendu : depuis ce dossier, `python -m http.server 8765`, puis `http://localhost:8765/apercu.html` (boutons pour
  déclencher chaque alerte, comme en live) ou `apercu.html?planche=latshow` / `?planche=linedev` (toutes les alertes
  figées sur une planche, fond de jeu ou d'éditeur). La page charge les fichiers du widget tels quels et simule
  `onWidgetLoad` puis `onEventReceived` ; elle contient des messages piégés (`<script>`, `<img onerror>`).
- Captures de contrôle du 2026-10-07 : `_captures\latshow-planche.jpg`, `_captures\linedev-planche.jpg`,
  `_captures\latshow-don-taille-reelle.jpg`.

## Documentation lue (2026-10-07)

- https://docs.streamelements.com/overlays/custom-widget-events — structure de `onEventReceived` (`listener`, `event`),
  liste des écouteurs, champs `gifted`, `sender`, `bulkGifted`, `isCommunityGift`, `playedAsCommunityGift`, `onWidgetLoad`.
- https://docs.streamelements.com/overlays/custom-widget — format de FIELDS (types `text`, `number`, `slider`, `checkbox`,
  `dropdown`, `sound-input`, `button`, `hidden`…), `widgetName` / `widgetAuthor` / `widgetDuration`, `SE_API.sanitize`,
  `SE_API.resumeQueue`.
- https://docs.streamelements.com/overlays/events — écouteurs par plateforme : YouTube `subscriber-latest`,
  `sponsor-latest` (membres), `superchat-latest`.
- https://github.com/StreamElements/widgets/blob/master/docs/CustomWidgetEvents.md — `amount` = nombre de mois d'un
  abonnement, sémantique des cadeaux groupés, bouton `widget-button`.
