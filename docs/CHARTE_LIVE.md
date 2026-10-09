# Charte des lives — règles de style communes

Demande du client (2026-10-07) : « beaucoup plus propre, beaucoup plus épuré », « qu'on voie le jeu et ma cam, un peu de
travail par-ci par-là », « je ne veux pas que ça se voie que c'est fait par une IA ». Tout ce qui s'affiche pendant un live
(overlays, alertes, bannières, panneaux) suit ces règles.

## Interdits (ce qui fait « généré »)

- Néon, halos lumineux, flous de verre, dégradés partout, particules, étincelles, emoji, icônes décoratives en série.
- Textes génériques en anglais (« Starting soon », « BRB ») : tout est en français, avec la voix du client (tutoiement).
- Animations qui rebondissent ou tournent. Le mouvement est rare, lent, utile (fondu, glissement court).
  **Exception : les alertes** (demande du client, 2026-10-07 : « je veux du fun, comme une animation After Effects ») —
  titre qui claque en zoom, secousse, sticker qui saute, bulle de BD drôle, gerbe de losanges, jingle à chaque alerte.
  Toujours sans trait décoratif ni néon.
  **Exception aussi : la transition de scène** (demande du client, 2026-10-07 : « une animation en mode élément en 3D »)
  — tuiles qui se retournent en 3D, nom de la chaîne en relief, une seule couleur d'accent en vague. Sans néon ni particules.
- Plus de deux tailles de titre par écran, plus d'une couleur d'accent par écran.
- **Aucune forme décorative à côté, devant, après ou sous un texte** : ni trait (2026-10-07 : « ça fait IA, les traits, tout
  le monde en a »), ni point, ni losange, ni pastille de couleur (2026-10-09 : « on vire tout ça, j'en veux plus de
  pastille », « je veux le truc plus simple, plus sobre »). La hiérarchie vient de la taille, de la graisse, de la couleur du
  texte et de l'espace. Restent : les lignes de structure (bord d'un cadre, séparation de zones), la barre de progression du
  compte à rebours, et le logo d'une plateforme devant un pseudo quand il informe (soutiens du live).

## Latshow — lives gaming et montage (Twitch latshow + YouTube Latshow)

- Fond : `#07060F` (nuit), surfaces `#0F0E1A`, traits `rgba(233,230,255,.14)`.
- Texte : `#E9E6FF` ; texte secondaire `rgba(233,230,255,.62)`.
- Accent unique : cyan `#22D3EE` (surtitres, compte à rebours). Le violet `#A855F7` n'apparaît que dans les alertes.
- Polices : **Russo One** pour le mot LATSHOW et les grands titres en capitales ; **Inter** (400/700) pour tout le reste.
- Signature : le mot LATSHOW en Russo One, seul (plus de losange depuis le 2026-10-09).
- Cadres caméra : bordure 2 px `rgba(233,230,255,.22)`, coins droits (la caméra n'est pas masquée dans OBS). Aucune étiquette
  « LATSHOW » sur un cadre (Jeu : 2026-10-08 ; Fin : 2026-10-09).
- **Soutiens du live** (2026-10-09) : au-dessus de la caméra de la scène Jeu, dans le bandeau vertical et sur les écrans de
  fin, les pseudos du live (follow, abonnement, don) avec le logo de la plateforme, sans autre forme. Service
  `obs/soutiens.mjs`, affichage `overlays/commun/soutiens.js`.
- Couleurs de la caméra : neutres (le filtre « Couleurs » ne retire plus de bleu depuis le 2026-10-08 : le client se
  trouvait jaune). Vérifier sur le mur blanc derrière lui, qui doit rester blanc.

## linedev — lives dev (YouTube linedev, format « j'apprends le dev simplement »)

- Charte « La Ligne » de linedev.fr (déjà sur la chaîne, `D:\Stream\Pilotage\docs\chaine_linedev\`) :
  papier `#EFE9DD`, grille `#DCD4C3` (pas de 60 px), encre `#14130F`, vermillon `#F4471B`, clair `#FBF8F1`, gris `#8C8677`.
- Polices : **Archivo Black** (titres, « linedev.fr »), **JetBrains Mono** (tout le reste).
- Signature : la gouttière de numéros de ligne à gauche (ligne active en vermillon), plus de point carré en fin de titre (2026-10-09), la
  mascotte Curseur (SVG de `banniere.html`), des blocs de code sombres (`#14130F`, mots-clés vermillon, chaînes `#F2D46B`).
- Format des cours : titre du cours + étape « 02/05 » toujours visibles en bas pendant la scène Cours.

## Technique

- Overlays : HTML locaux, maquette 1920 × 1080 mise à l'échelle par `overlays/commun/scene.js` (source OBS en 2560 × 1440).
- Polices en local (`overlays/commun/polices/`), aucune ressource en ligne : un live ne doit pas dépendre d'un CDN.
- Textes du jour (jeu, sujet du cours, étape, prochain live) : `overlays/live.js`, relu toutes les 2 s par les overlays.
- Positions des caméras, captures et chats : `obs/seances.json` (`cadres`), seule source de vérité.
