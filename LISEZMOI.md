# Lancer un live

Tout est prêt dans OBS. Une séance = une collection de scènes (menu **Collection de scènes**) et un profil (menu **Profil**).

| Séance | Collection | Profil | Diffuse sur |
|---|---|---|---|
| Gaming | Live — Gaming | Live Latshow | Twitch latshow + YouTube Latshow |
| Montage | Live — Montage | Live Latshow | Twitch latshow + YouTube Latshow |
| Dev (cours) | Live — Dev | Live linedev | YouTube linedev |

## En 5 gestes

1. Dans OBS : choisis la **collection** et le **profil** de ta séance.
2. Gaming : double-clic sur **Capture du jeu** et choisis ton jeu. Montage et Dev : double-clic sur **Fenêtre** et choisis ton logiciel ou ta page.
3. Dans le cockpit, page **Live** : écris le jeu ou le sujet du cours, l’étape, le prochain live (les écrans se mettent à jour tout seuls).
4. **Ctrl+Alt+F1** (Démarrage, compte à rebours de 5 min), puis **Démarrer le streaming**.
5. Change de scène avec les touches ci-dessous. Pause, Pause bébé et Souci technique coupent ton micro tout seuls.

## Touches (les mêmes dans les trois séances)

| Touche | Gaming | Montage | Dev |
|---|---|---|---|
| Ctrl+Alt+F1 | Démarrage | Démarrage | Démarrage |
| Ctrl+Alt+F2 | Jeu | Montage | Cours |
| Ctrl+Alt+F3 | Jeu sans caméra | Aperçu plein écran | Face à face |
| Ctrl+Alt+F4 | Discussion | Discussion | Questions |
| Ctrl+Alt+F5 | Pause | Pause | Pause |
| Ctrl+Alt+F6 | Pause bébé | Pause bébé | Pause bébé |
| Ctrl+Alt+F7 | Souci technique | Souci technique | Souci technique |
| Ctrl+Alt+F8 | Fin | Fin | Fin |
| Ctrl+Alt+F9 | Couper le micro | | |
| Ctrl+Alt+F10 | Rétablir le micro | | |

Le détail de chaque scène (à quoi elle sert) est sur la page **Live** du cockpit et dans `obs/seances.json`.

## Stream Deck

Touche **Live** en haut à gauche de ta page d’accueil → **Gaming**, **Montage** ou **Dev**. Dans chaque dossier : les 8 scènes (celle à l’antenne est allumée), **Charger la séance** (bonne collection et bon profil d’un coup), **Micro** et **Son** (allumés quand ils sont coupés), **Garder 60 s** (enregistre le dernier moment fort dans `D:StreamRush`, pour en faire un short), **Enregistrer**, et **Live** : appui long pour lancer ou couper le direct.
