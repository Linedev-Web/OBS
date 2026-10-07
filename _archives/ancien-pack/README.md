# Guide d'utilisation du Pack OBS Multi-Scènes

Ce projet est divisé en deux styles distincts : **Gaming** (Cyber-Néon) et **Job** (Professionnel/Nature/Café).

## Structure des dossiers
- `Gaming/` : Alertes et Overlays style futuriste pour les sessions de jeu.
- `Job/` : Alertes et Overlays sobres et élégants pour les sessions de développement Web.
- `assets/` : Dossier pour vos ressources personnalisées.

---

## Pack JOB (Développement Web)
Style minimaliste, couleurs café/nature, polices `Inter` et `JetBrains Mono`.

### 1. Scènes d'Overlay (1920x1080)
- **Starting** (`Job/overlays/starting.html`) : Ambiance "npm install" et café.
- **Ending** (`Job/overlays/ending.html`) : Conclusion propre de la session.
- **Pause** (`Job/overlays/pause.html`) : "Be Right Back" avec animation de respiration.
- **Just Chatting** (`Job/overlays/just_chatting.html`) : Layout optimisé avec zone Webcam (800x600), Chat à droite, et Labels automatiques en bas.

### 2. Alertes (Injectables dans Streamlabs/Elements)
- **Follow** (`Job/alerts/follow.html`) : Animation fluide "New Connection".
- **Sub** (`Job/alerts/sub.html`) : Style premium sombre et vert olive.
- **Donation** (`Job/alerts/donation.html`) : Design épuré "Support Received".

### 3. Webcam & Widgets
- **Cadre Webcam** (`Job/overlays/webcam.html`) : Bordure minimaliste (594x445).
- **Webcam Privacy (Blur)** (`Job/overlays/webcam_blur.html`) : Effet de flou pour protéger votre vie privée.
- **Rappel Follow** (`Job/widgets/follow_reminder.html`) : Pop-in discrète toutes les 10 min.

---

## Pack GAMING (Cyber-Néon)
Style dynamique Twitch Purple / Cyan Neon.

### 1. Scènes d'Overlay
- `Gaming/overlays/starting.html`, `ending.html`, `pause.html`, `just_chatting.html`.

### 2. Alertes
- `Gaming/alerts/follow.html`, `sub.html`, `donation.html`, `resub.html`, `first_sub.html`, `new_subscriber.html`.

### 3. Webcam & Widgets
- `Gaming/overlays/webcam_full.html` (avec labels intégrés).
- `Gaming/overlays/webcam_full_blur.html` (version Privacy pour l'overlay complet).
- **Webcam Privacy (Blur)** (`Gaming/overlays/webcam_blur.html`) : Effet de flou néon avec icône de verrou.
- `Gaming/widgets/follow_reminder.html`.

---

## Installation dans OBS

1. Ajoutez une source **Navigateur**.
2. Cochez **Fichier local**.
3. Sélectionnez le fichier `.html` désiré.
4. Pour les scènes complètes, réglez la taille sur **1920x1080**.
5. Pour les alertes, réglez la taille sur **800 x 400**.
6. **Astuce Privacy :** Pour l'effet de flou (`webcam_blur.html`), placez cette source **au-dessus** de votre webcam dans OBS. 
    *Note technique :* Le CSS ne peut pas flouter directement une source vidéo OBS située en dessous. L'overlay utilise donc un fond quasi-opaque pour masquer totalement votre visage tout en restant esthétique. Vous pouvez l'afficher/masquer avec un raccourci clavier ou un Stream Deck.
7. Pour les labels (Just Chatting), assurez-vous que vos fichiers Streamlabels sont bien dans `C:\Workspace\Stream\Streamlabels\`.

Bon stream ! ☕🎮
