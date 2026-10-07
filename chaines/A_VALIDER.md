# Chaînes — à valider par le client

Préparé le 2026-10-07. **Rien n'est publié** : le client a choisi « je prépare, tu valides ». Une fois validé, Claude
publie lui-même (Twitch : tableau de bord → Paramètres → Chaîne ; YouTube : Studio → Personnalisation).
Visuels refaits avec `python D:\Stream\OBS\chaines\rendre.py` (sources HTML à côté de chaque PNG). Charte :
`D:\Stream\OBS\docs\CHARTE_LIVE.md`.

---

## 1. Twitch — latshow (gaming, 129 followers)

### Bio (246 caractères sur 300)

| Aujourd'hui | Proposé |
|---|---|
| Jeune streamer multi-passions. Je code, je joue et je parle avec vous de tout ce qui passe. Deux ambiances selon les heures : sessions normales le midi quand je peux, ASMR le soir pour ceux qui veulent chill ou s'endormir. Bienvenue, installe-toi. | Lives gaming en français, sans prise de tête : je joue, je discute avec toi, et parfois je monte mes vidéos en direct. Le midi quand je peux, l'ASMR le soir pour décompresser. En même temps sur Twitch et YouTube. Installe-toi, le chat est ouvert. |

Pourquoi : la chaîne est 100 % gaming, le code a sa propre chaîne (linedev), et la bio dit enfin que les lives passent aussi sur YouTube.

### Liens sociaux (inchangés)

Mon discord → `https://discord.gg/JEwmC44hvh` · Linedev → `https://lank.li/linedev` · Ajoute ton serveur sur ServeurListe → `https://lank.li/serveurliste-1`

### Bannière de profil

- Aujourd'hui : violet, cubes et losanges en filigrane, « LATSHOW » et un trait violet (1920×480).
- Proposé : `twitch-latshow\banniere_1200x480.png` (source `banniere.html`). Fond nuit, « LATSHOW » en Russo One, trait
  cyan, une phrase : « Lives gaming en français · Twitch et YouTube en même temps ». Coins de cadrage discrets, rien d'autre.

### Écran hors ligne (bannière du lecteur vidéo)

- Aujourd'hui : la bannière agrandie, le mot LATSHOW coupé sur les bords (1920×1080).
- Proposé : `twitch-latshow\hors-ligne_1920x1080.png`. Ta photo, LATSHOW, « Pas de live en ce moment. », « Je reviens
  vite : le midi quand je peux, l'ASMR le soir. », le lien du Discord en bas.

### Panneaux (sous la vidéo)

Aujourd'hui, 4 panneaux violets : À propos, TikTok, Discord, Donation (lien `streamlabs.com/latshow`).
Proposé, 6 panneaux 320×100 dans `twitch-latshow\panneaux\` (même modèle : `panneau.html`) :

| Image | Lien de l'image | Texte sous le panneau |
|---|---|---|
| `a-propos_320x100.png` — À PROPOS · Qui je suis, ce qu'on fait ici | aucun | Moi c'est Latshow. Je streame les jeux qui me plaisent, surtout de la simulation et de l'exploration (No Man's Sky en ce moment), et je monte mes épisodes pour YouTube. Ici on joue par passion, on discute, et personne n'est de trop. |
| `planning_320x100.png` — PLANNING · Quand me trouver en live | `https://discord.gg/JEwmC44hvh` | Pas d'horaires fixes pour l'instant : le midi quand je peux, l'ASMR le soir. Active la cloche ou rejoins le Discord pour être prévenu à chaque live. |
| `discord_320x100.png` — DISCORD · La commu, même hors live | `https://discord.gg/JEwmC44hvh` | Annonces des lives, entraide, soirées multi : la commu continue entre deux streams. Clique sur l'image pour nous rejoindre. |
| `soutenir_320x100.png` — SOUTENIR · Dons, abonnements, follow | **lien de dons StreamElements** (voir questions) | Le follow et l'abonnement, c'est ce qui aide le plus. Si tu veux aller plus loin, un don sert à améliorer le stream : matériel, jeux, confort du live. Merci, vraiment. |
| `materiel_320x100.png` — MATÉRIEL · Ce que j'utilise en live | aucun | Caméra : Logitech MX Brio · Micro : FIFINE K658 · Logiciel : OBS Studio · **(à compléter : PC, écran, clavier, souris — voir questions)** |
| `regles_320x100.png` — RÈGLES DU CHAT · Pour que ça reste cool | aucun | 1. On reste bienveillant, avec tout le monde. 2. Pas de spoil sur le jeu en cours. 3. Pas de pub ni de lien sans demander. 4. Pas de conseils de jeu non demandés (backseat), sauf si je demande de l'aide. 5. Les modos ont le dernier mot. |

Le panneau TikTok actuel disparaît (TikTok reste dans les liens de YouTube) : à dire si tu veux le garder.

### Titre de live type (le même sur Twitch et YouTube)

- Aujourd'hui : « 🔴 LIVE No Man's Sky - Episode 16 ».
- Proposé, jeu : « No Man's Sky — épisode 17 : on part explorer une nouvelle galaxie [FR] » (le jeu d'abord, puis ce qu'on y fait).
- Proposé, montage : « Montage en direct — je monte l'épisode 17 de No Man's Sky [FR] ».

---

## 2. YouTube — Latshow (@Latshow-y, 72 abonnés, 155 vidéos)

### Description

| Aujourd'hui | Proposé |
|---|---|
| Salut, moi c'est Latshow. Jeune streamer passionné par le gaming, le code et les conversations qui partent dans tous les sens.<br>Sur cette chaîne, tu trouveras deux ambiances. Le midi, des sessions classiques où je joue, je code en parallèle et je discute avec la communauté. Le soir, place à l'ASMR : voix posée, jeux calmes, lumière tamisée, parfait pour décompresser ou s'endormir.<br>Que tu sois là pour le gameplay, pour apprendre à coder en regardant, ou juste pour passer un moment tranquille, tu es à la bonne adresse. Abonne-toi pour ne rien rater des prochains lives et vidéos. | Salut, moi c'est Latshow. Ici, c'est du gaming en français, sans prise de tête.<br><br>Les lives passent en même temps sur Twitch et ici : je joue, je discute avec le chat, et parfois je monte mes vidéos en direct. Le midi quand je peux, l'ASMR le soir pour décompresser.<br><br>Tu trouveras aussi les épisodes montés de mes séries (No Man's Sky, How to Fish, Librarian, Storage Hunter Simulator 2, Roadside Research…) et des shorts avec les meilleurs moments.<br><br>Abonne-toi et active la cloche pour ne rater aucun live. Le code, c'est sur ma chaîne linedev. |

### Liens (dans cet ordre ; le premier s'affiche sous le nom de la chaîne)

| Aujourd'hui | Proposé |
|---|---|
| Tiktok → lank.li/latshow-tiktok · Twitch → lank.li/latshow-twitch · Linedev → lank.li/linedev · Thème Zodpress → lank.li/theme-zodpress · Thème Rainbow → lank.li/theme-rainbow · Ajout ton serveur ServeurListe → lank.li/serveurliste-1 | Twitch → `https://lank.li/latshow-twitch` · Discord → `https://discord.gg/JEwmC44hvh` · TikTok → `https://lank.li/latshow-tiktok` · Linedev → `https://lank.li/linedev` · Thème Zodpress → `https://lank.li/theme-zodpress` · Thème Rainbow → `https://lank.li/theme-rainbow` · Ajoute ton serveur sur ServeurListe → `https://lank.li/serveurliste-1` |

Changements : Twitch en premier (les lives), le Discord ajouté (il n'y était pas), « Ajout » corrigé en « Ajoute ».

### Bannière

- Aujourd'hui : même dessin que l'ancienne bannière Twitch (violet, cubes), 2560×1440.
- Proposé : `youtube-latshow\banniere_2560x1440.png`. Tout le texte dans la zone sûre (1546×423 au centre) : lisible
  pareil sur téléphone, ordinateur et télé.

### Titre de live type

Le même que sur Twitch (voir plus haut) : en multistream, les deux plateformes reçoivent le même titre.

---

## 3. YouTube — linedev (@linedevfr) : nouveau format de lives dev

### Description

| Aujourd'hui | Proposé |
|---|---|
| Des tips de développement web en moins d'une minute, deux fois par jour du lundi au samedi.<br><br>PHP, JavaScript, SQL, CSS, Laravel, Symfony, React, Git… Un piège, une astuce, une bonne pratique : du vrai code, expliqué simplement et sans jargon.<br><br>Au programme :<br>▸ Trouve le bug<br>▸ Junior vs pro<br>▸ C'est quoi ? (un concept en une minute)<br>▸ Devine le résultat<br><br>Tu fais autrement ? Dis-le en commentaire : les meilleures idées deviennent les prochains tips.<br><br>Plus de tips → linedev.fr | Des tips de développement web en moins d'une minute, deux fois par jour du lundi au samedi. Et maintenant, des cours en live : je pose les choses et je t'apprends le dev le plus simplement possible.<br><br>PHP, JavaScript, SQL, CSS, Laravel, Symfony, React, Git… Un piège, une astuce, une bonne pratique : du vrai code, expliqué simplement et sans jargon.<br><br>En short :<br>▸ Trouve le bug<br>▸ Junior vs pro<br>▸ C'est quoi ? (un concept en une minute)<br>▸ Devine le résultat<br><br>En live :<br>▸ Une notion expliquée depuis zéro<br>▸ On code ensemble, pas à pas<br>▸ Tes questions dans le chat, avec une vraie réponse<br><br>Tu fais autrement ? Dis-le en commentaire : les meilleures idées deviennent les prochains tips.<br><br>Plus de tips → linedev.fr |

Liens : inchangés (Linedev, TikTok, Thème Zodpress, Thème Rainbow, Ton serveur sur ServeurListe, Instagram, tous par
lank.li ; e-mail contact@linedev.fr).

### Bannière (variante)

- Aujourd'hui (en ligne depuis le 2026-09-27) : « Un tip dev en 60 secondes, chaque jour. »
- Proposé : `youtube-linedev\banniere_2048x1152.png` (même composition, même mascotte) avec « Un tip chaque jour, des
  cours en live. », `const live = 'on code ensemble';` et `echo "Pas à pas, simplement.";`. À publier seulement quand
  le premier cours en live est fixé.

### Titre de live type

« Les variables en JavaScript, expliquées simplement — cours dev en live » (la notion d'abord, puis le format).

---

## Questions pour le client

1. **Dons** : on passe sur StreamElements. Le lien du panneau « Soutenir » (aujourd'hui `streamlabs.com/latshow`)
   deviendra la page de dons StreamElements, créée pendant la mise en place des alertes. D'accord pour retirer Streamlabs ?
2. **ASMR le soir** : c'est toujours d'actualité ? La bio, l'écran hors ligne et le panneau Planning le disent.
3. **Matériel** : quels PC, écran, clavier et souris citer ? Sinon le panneau ne garde que caméra, micro et logiciel.
4. **Photo de profil YouTube Latshow** : c'est un dessin, alors que Twitch montre ta vraie photo. On met la même photo
   partout (celle de Twitch) ?
5. **Liens de dev sur Latshow** (Thèmes Zodpress et Rainbow, ServeurListe) : on les garde sur la chaîne gaming ?
6. **Discord** : il n'existe pas de lien lank.li pour le Discord. On garde le lien direct, ou tu en crées un
   (`lank.li/latshow-discord`) ?
