# Guide d'utilisation des Alertes et Widgets

Ce projet contient des alertes Twitch (sans JS) et un widget de rappel de follow (avec JS) pour OBS.

## Structure des dossiers
- `alerts/` : Contient les fichiers HTML/CSS pour les alertes Twitch.
- `widgets/` : Contient le widget de rappel de follow.
- `overlays/` : Contient les cadres pour webcam et autres éléments fixes.
- `assets/` : Dossier pour vos images ou sons personnalisés.

## Installation dans OBS

### 1. Scènes d'Overlay (`starting.html`, `ending.html`, `pause.html`)
Ces fichiers sont conçus pour remplir tout l'écran (1920x1080).
- **Starting Soon** (`starting.html`) : Pour le début du stream.
- **Ending** (`ending.html`) : Pour la fin du stream avec animation de déconnexion.
- **Pause** (`pause.html`) : Pour vos pauses (BRB), avec une animation de chargement.

### 2. Overlay Just Chatting (`just_chatting.html`)
Une scène complète pour discuter avec votre communauté.
- **Zone Webcam** : Large espace sur la gauche.
- **Zone Chat** : Colonne dédiée sur la droite.
- **Labels intégrés** : Follow, Sub et Donation s'affichent en bas et se mettent à jour automatiquement.
- **Configuration** : Ajoutez une source Navigateur (1920x1080) et placez votre webcam et votre chat derrière l'overlay.

### 3. Overlay Webcam Complet (`webcam_full.html`)
Un cadre animé avec 4 labels intégrés (2 au-dessus, 2 en dessous) et un espace vide au centre pour votre webcam.

- Ajoutez une source **Navigateur** dans OBS.
- Sélectionnez `overlays/webcam_full.html`.
- Définissez la taille sur environ **800x650** (cela laisse de la place pour les labels autour de la webcam de 594x445).
- Placez votre source Webcam au centre du cadre.
- Les fichiers sont lus depuis `../../Streamlabels/`.

### 2. Cadre Webcam Simple (`webcam.html`)
Si vous voulez juste le cadre sans les labels intégrés.
- Dimensions : **594x445**.

### 3. Overlay Streamlabels Séparé (`streamlabels.html`)
Un overlay discret pour afficher vos dernières statistiques (Follow, Sub, Donation).

- Ajoutez une source **Navigateur** dans OBS.
- Sélectionnez `overlays/streamlabels.html`.
- Définissez la taille (ex: **800x150**).
- **Important :** Pour que le widget puisse lire vos fichiers locaux, vous devez ajouter `--allow-file-access-from-files` aux raccourcis de lancement d'OBS ou utiliser un serveur local si OBS bloque l'accès direct.
- Les fichiers sont lus depuis `C:\Workspace\Stream\Streamlabels\`.

### 3. Alertes Twitch (Follow, Sub, Donation, Resub, First Sub)
Les alertes sont conçues pour être utilisées avec des plateformes comme **Streamlabs** ou **Streamelements** qui permettent d'injecter du code HTML/CSS personnalisé.

- **Follow** (`follow.html`) : Style Cyber-Néon.
- **Sub** (`sub.html`) : Style Carte Elite (Légendaire).
- **Donation** (`donation.html`) : Style Cash Drop (Pluie de billets).
- **Premier Sub** (`first_sub.html`) : Style Galaxy/Elite Gold (Minimaliste et Prestigieux).
- **Réabonnement** (`resub.html`) : Style Cyber-Holographique (Loyalty Update).
- **Nouveau Sub Variant** (`new_subscriber.html`) : Style Synthwave/Cyberpunk Pro.

- Copiez le contenu du fichier `.html` correspondant dans la section HTML/CSS de votre outil d'alerte.
- Les fichiers utilisent des placeholders comme `{name}`, `{amount}`, `{months}` ou `{tier}` qui sont automatiquement remplacés par votre service d'alerte.
- **Note :** Aucun JavaScript n'est utilisé dans ces fichiers, conformément à votre demande.

### 2. Widget de Rappel de Follow
Ce widget affiche une pop-in professionnelle toutes les 10 minutes pour encourager les spectateurs à vous suivre.

- Dans OBS, ajoutez une nouvelle source **Navigateur**.
- Cochez "Fichier local" et sélectionnez `widgets/follow_reminder.html`.
- Définissez la taille sur **1920x1080** (ou la taille de votre canvas).
- Le widget apparaîtra automatiquement en bas à droite de l'écran toutes les 10 minutes.

## Personnalisation
- **Couleurs :** Modifiez les variables CSS ou les couleurs hexadécimales dans les fichiers.
- **Police :** Les polices utilisent Google Fonts (Montserrat et Poppins).
- **Temps :** Pour changer l'intervalle du widget, modifiez `intervalTime` dans la balise `<script>` du fichier `follow_reminder.html`.

Bon stream ! 🎮
