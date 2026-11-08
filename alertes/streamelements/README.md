# Alertes StreamElements — Latshow et linedev

Deux « Custom widgets » StreamElements, un par marque, selon `docs\CHARTE_LIVE.md` : en haut au centre de l'écran (loin
de la caméra en bas à droite et du centre du jeu), une alerte à la fois, dans l'ordre d'arrivée, aucune perdue, tout en
français.

**v3 « papa » (2026-11-08)**, après la refonte des écrans validée par le client (« un papa qui joue quand il peut et qui
aime partager », sa moustache guidon pour signature) : une plaque arrondie (titre en Bricolage Grotesque 800, pseudo en
couleur d'accent, ce qui se passe, message) sur laquelle la **moustache** atterrit comme un autocollant. Elle saute,
s'écrase en atterrissant (légère secousse), **frise d'un coup** (pointes qui s'enroulent, forme animée par la propriété CSS
`d`), puis rebondit doucement ; une bulle de BD en Kalam parle dans la voix du client (« Merci Mika, la moustache te
salue ! », le pseudo seulement s'il fait 14 caractères au plus). Un geste de plus selon l'alerte : elle frise deux fois
(abonnements), tourne comme une pièce (dons, Super Chat), se fait chatouiller (bits, likes TikTok), refait un saut sur le
« dong » (raid). Les grands moments (cadeau, Super Chat, raid) inversent la plaque. Le son part à 0,35 s : sa note forte
tombe quand la moustache frise. Ni néon, ni halo, ni particule, ni forme décorative à côté d'un texte.

| Dossier | Comptes StreamElements | Style |
|---|---|---|
| `latshow\` | Twitch latshow, YouTube Latshow | plaque `#1F1712`, titre crème `#FFF3E3`, pseudo et moustache ambre `#F4A33A`, bulle crème ; grands moments : plaque ambre, moustache brune |
| `linedev\` | YouTube linedev | plaque papier `#F6F0E4`, encre `#1E1B16`, pseudo et moustache vermillon `#D9431D`, bulle papier clair ; grands moments : plaque vermillon, moustache encre |

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
`widget.css` : Bricolage Grotesque 400/500/700/800 et Kalam 400/700, les deux marques). C'est la seule exception à la
règle « tout en local » de la charte ; `widget.js` les charge dès l'ouverture du widget (sinon la première alerte
attendrait Google Fonts, texte invisible) ; s'il ne répond pas, le texte s'affiche dans la police système, l'alerte part
quand même. Les pages TikTok, elles, déclarent les polices locales (`overlays\commun\polices\`), qui passent avant.

## Sons (v3 « papa »)

Sons courts et doux, faits maison en synthèse (kalimba, ukulélé, pièce dans la tirelire, sonnette, clochettes…, -16 LUFS,
rien sous 150 Hz) : `alertes\sons\composer_sons_papa.py`, fichiers dans `alertes\sons\_propositions_papa\` (non
versionnés, réglages dans son `catalogue.json`). Table type d'alerte → son : `alertes\sons\sons-papa.json` (bloc
`streamelements` pour les widgets, `tiktok` pour les pages TikTok, `remplace` : quel nouveau son prend la place de chacun
des 14 anciens jingles). Les anciens jingles (`alertes\sons\*.mp3`) restent en place tant que les nouveaux ne sont pas en
ligne. Une fois les sons déposés sur le CDN de StreamElements, leurs adresses vont dans `sons-papa.json` (« cdn »), puis
`node alertes/streamelements/poser-sons.mjs --ecrire` les pose dans `fields.json` et `data.json` des deux marques (sans
`--ecrire` : simulation ; rien n'est écrit tant qu'une adresse manque).

## Mettre la v3 en ligne

Par l'API StreamElements depuis le tableau de bord, dans la session du client (jamais par copier-coller), pour chacun des
trois overlays (Latshow — Alertes sur Twitch latshow et sur YouTube Latshow, linedev — Alertes sur YouTube linedev) :

1. déposer les 14 sons de `sons-papa.json` (blocs `streamelements`) dans la médiathèque StreamElements, noter leurs
   adresses `https://cdn.streamelements.com/uploads/….mp3` dans « cdn », puis `poser-sons.mjs --ecrire` ;
2. dans le widget « Custom » de chaque overlay, remplacer HTML, CSS, JS et FIELDS par `widget.html`, `widget.css`,
   `widget.js`, `fields.json` du dossier de la marque, et fusionner `data.json` dans les réglages du widget (champs
   `son_*` ; le champ `avatar` de la v2 n'existe plus, il peut rester sans effet) ; garder la plateforme réglée
   (Twitch / YouTube) ;
3. bouton « Tester toutes les alertes », puis **Save** ; recharger la source « Alertes » d'OBS hors live.

## Vérifier sans StreamElements

- Mécanique (file, ordre, aucune perte, « passer », cadeaux groupés, textes, devise, bouton Tester, soutiens, bulle qui
  cite le pseudo) : `node test-widget.mjs` (Node 24, sans dépendance) → « widget.js : 7 scénarios OK ».
- Image par image : `apercu.html?plein=latshow&plateforme=twitch` (ou `linedev&plateforme=youtube`) montre la scène seule
  en 1920 × 1080 ; dans la console, `alerte('follower-latest', { name: 'Mika' })` puis `figer(0.62)` arrête toutes les
  animations à 0,62 s (la moustache frisée). Captures de contrôle de la v3 : 0,3 s, 0,62 s et 1,6 s par type.
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
