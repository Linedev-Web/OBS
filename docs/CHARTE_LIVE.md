# Charte des lives — règles de style communes

Tout ce qui s'affiche pendant un live suit ces règles : overlays, alertes, transition, chat, bannières, panneaux, story
Instagram du cockpit.

## D'où vient le style « papa » (2026-11-08)

Le client trouvait l'habillage du 2026-10-07 « réellement thème gaming dark » : nuit, néon cyan, Russo One. Il disait que
ça ne lui ressemblait pas : « je suis plus du style papa qui joue quand il peut et qui aime partager son expérience de jeu
ou de développement ». Sa signature est **sa moustache guidon**.

La refonte a été proposée sur la planche https://claude.ai/artifact/2Ru62tHEhgJFjuATUknyaX, et le client l'a validée
« à 100 % ». Le ménage du 2026-10-07 reste en vigueur : « propre, épuré », « je ne veux pas que ça se voie que c'est fait
par une IA ».

## Interdits (ce qui fait « généré »)

- **Effets** :
  - néon, halos lumineux, flous de verre ;
  - particules, étincelles, emoji, icônes décoratives en série ;
  - un dégradé partout (le voile qui rend le texte lisible sur une photo est le seul permis).
- **Langue** : des textes génériques en anglais (« Starting soon », « BRB »). Tout est en français, dans la voix du client, au tutoiement.
- **Animations** : celles qui rebondissent ou tournent. Le mouvement est rare, lent et utile (fondu, glissement court).
  Trois exceptions :
  - **les alertes** (2026-10-07 : « je veux du fun, comme une animation After Effects ») : titre qui claque en zoom,
    secousse, sticker qui saute, bulle de BD drôle, jingle à chaque alerte. Depuis la v3 « papa » (2026-11-08), la
    moustache du client est le sticker : elle saute, frise d'un coup, rebondit. Plus de gerbe de losanges ;
  - **la transition de scène** « Coup de moustache » (2026-11-08, à la place des « Tuiles 3D » du 2026-10-07) ;
  - la moustache du compte à rebours, qui frise une fois à zéro.
- **Hiérarchie** : plus de deux tailles de titre par écran, ou plus d'une couleur d'accent par écran.
- **Formes à côté du texte** : aucune forme décorative à côté, devant, après ou sous un texte. Ni trait (2026-10-07 : « ça
  fait IA, les traits, tout le monde en a »), ni point, ni losange, ni pastille de couleur (2026-10-09 : « on vire tout
  ça, j'en veux plus de pastille »). La hiérarchie vient de la taille, de la graisse, de la couleur du texte et de
  l'espace. Restent permis :
  - les lignes de structure (bord d'un cadre, séparation de zones) ;
  - une barre d'avancée continue (cours dev) ;
  - le logo d'une plateforme devant un pseudo, quand il informe (soutiens du live).
- **La mise en page « style Claude »** (refusée le 2026-11-06) :
  - fausse gouttière de numéros de ligne ;
  - étiquettes numérotées en petites capitales ;
  - barre de progression segmentée ;
  - code posé dans des cartes.

## La moustache, sa signature

- Le dessin est `overlays/commun/moustache.svg` : une demi-moustache gauche, symétrisée, en `currentColor`. Les écrans la
  posent avec `.moustache` (`overlays/commun/papa.js`).
- C'est **un logo seul**, jamais une puce collée à un texte. Elle apparaît :
  - en haut à gauche des écrans d'attente ;
  - dans le compte à rebours, où elle se remplit puis frise à zéro ;
  - en autocollant sur un coin du cadre de la caméra, couleur d'accent ;
  - dans les alertes et dans la transition.

## Trois ambiances, une famille

L'ambiance vient de la séance (`data-seance`, posé par `overlays/commun/scene.js`) :

| Ambiance | Séance | Fond | Texte | Accent | Cadre de la caméra |
|---|---|---|---|---|---|
| Le salon du soir | gaming et montage | `#1F1712` | crème `#FFF3E3` | ambre `#F4A33A` | crème |
| Le bureau du matin | dev | papier `#F6F0E4` | encre `#1E1B16` | vermillon `#D9431D` (`#B4360F` en petit texte) | encre |
| L'atelier | roblox | bleu `#16324D` | `#FFF8EC` | jaune `#FFC83D` | `#FFF8EC` |

- **Jetons et composants** : `overlays/commun/papa.css`. Pour le gaming, `latshow.css` garde en plus les anciens noms de
  couleurs pour la bannière du jeu, et `linedev.css` ajoute le mot « linedev.fr ».
- **Polices** : locales et OFL, dans `overlays/commun/polices/`. Les TTF servent aussi à la story Instagram du cockpit.
  - Bricolage Grotesque : titres en 800 (`'Bricolage Titre'`), texte en 400, 500 et 700 (`'Bricolage'`) ;
  - Kalam pour les petits mots écrits à la main ;
  - Archivo Black pour le seul mot « linedev.fr », JetBrains Mono pour du code s'il en faut.
- **Écrans d'attente** (démarrage, pause, pause enfant, souci, fin) :
  - une photo tirée au hasard dans `fonds/<univers>/<écran>/` (liste : `overlays/fonds.js`, écrite par
    `node obs/fonds.mjs` ; photos CC0, crédits dans `fonds/credits.json`, photos écartées dans `fonds/_ecartees/`) ;
  - un voile de la couleur du fond, plus dense à gauche où se pose le texte.
  - Image verticale : voile sombre en bas, car TikTok écrit ses commentaires en blanc.
- **Cadres** : la caméra et les captures sont posées par OBS au-dessus de la page, aux positions de `obs/seances.json`
  (`cadres`), inchangées. La page dessine un passe-partout arrondi qui dépasse de 6 px. Les soutiens du live s'écrivent à
  la main dans sa bande du haut (scène Jeu) ou dans un bandeau.

## Les petits plus (validés le 2026-11-08)

- **Le conseil du papa** : sur les pauses, un vrai conseil change toutes les 20 s (listes dans `papa.js`, une par séance).
- **Le compteur de cafés** : chaque affichage de la pause compte un café de la soirée (stockage local de la page).
- **La pause enfant** :
  - le titre à l'écran est « Pause papa » ;
  - un petit mot dit où il en est, envoyé par le dossier « Pause enfant » du Stream Deck (`obs/jeu.mjs`, `/papa/enfant`) ;
  - « mission papa en cours » par défaut.
- **L'heure du coucher** : « Jusqu'à 23 h environ. Après, dodo. » au démarrage, si la page Live du cockpit donne une heure
  (`coucher` dans `overlays/live.js`).

## Sons

- **Musique des écrans d'attente** : chaleureuse, maison (ACE-Step, `musique/composer_papa.py`). Folk et jazz de café
  pour le salon du soir, piano et guitare pour le bureau, marimba et ukulélé pour l'atelier, berceuses pour la pause enfant.
- **Alertes** : douces, sans coup de basse (2026-10-16 : « ça casse les oreilles »). Kalimba, ukulélé, pièce dans la
  tirelire, sonnette pour un raid (`alertes/sons/composer_sons_papa.py`).

## Technique

- Overlays : HTML locaux, maquette 1920 × 1080 (1080 × 1920 en vertical) mise à l'échelle par `overlays/commun/scene.js`
  (source OBS en 2560 × 1440).
- Polices en local, aucune ressource en ligne : un live ne doit pas dépendre d'un CDN. Seuls les widgets StreamElements et
  le chat, déjà en ligne, chargent Google Fonts.
- Textes du jour (jeu, sujet du cours, étape, prochain live, heure du coucher) : `overlays/live.js`, relu toutes les 2 s.
- Positions des caméras, captures et chats : `obs/seances.json` (`cadres`), seule source de vérité.
