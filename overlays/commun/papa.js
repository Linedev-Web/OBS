/* Habillage « papa » (validé par le client le 2026-11-08) : ce que les écrans ont en commun, en plus de scene.js.
   - .moustache : la moustache guidon du client (commun/moustache.svg), posée en SVG (couleur : currentColor) ;
   - [data-texte="clé"] : les textes qui changent selon la séance (les pages latshow servent au gaming, au montage et à
     Roblox) ; les pages linedev, propres au dev, écrivent leurs textes en dur ;
   - [data-photo="demarrage|pause|pause-enfant|fin"] : une photo tirée au hasard dans ../fonds.js (obs/fonds.mjs) ;
   - [data-conseil] : le conseil du papa, qui change toutes les 20 s ;
   - [data-cafes] : le compteur de cafés de la soirée ; la pause horizontale (<html data-compter-cafes>) en ajoute un à
     chaque affichage (elle est rechargée à chaque fois) ;
   - [data-statut] : où en est la pause enfant, dit par le Stream Deck (obs/jeu.mjs, /papa/enfant) ;
   - [data-coucher] : « Jusqu'à 23 h environ », si la page Live du cockpit a donné une heure (live.coucher). */
(function () {
  const SVG = 'http://www.w3.org/2000/svg';
  const TRACE = 'M120,54 C108,56 92,56 76,52 C62,48 50,46 38,46 C30,46 24,46 18,43 C9,38 6,28 11,20 C16,12 27,10 33,16 C37,21 34,28 28,28 C26,28 25,27 25.5,26 C29,25 31,21 28,18 C24,14 16,17 15,24 C14,32 20,38 30,40 C44,42 56,38 70,32 C84,26 100,24 112,28 C116,29 118,31 120,33 Z';

  const UNIVERS = { gaming: 'gaming', montage: 'gaming', dev: 'dev', roblox: 'roblox' };
  const seance = () => document.documentElement.dataset.seance || 'gaming';
  const univers = () => UNIVERS[seance()] || 'gaming';

  // Le soir ou la journée (demande du client, 2026-11-09) : « les petits dorment », « bonne nuit », « ce soir » seulement à
  // partir de 19 h ; le midi, les enfants ne sont pas à la maison.
  const HEURE_SOIR = 19;
  const HEURE_MATIN = 5;
  const MOMENT_FORCE = new URLSearchParams(location.search).get('moment'); // essai : ?moment=soir|jour
  const moment = () => {
    if (MOMENT_FORCE === 'soir' || MOMENT_FORCE === 'jour') return MOMENT_FORCE;
    const h = new Date().getHours();
    return h >= HEURE_SOIR || h < HEURE_MATIN ? 'soir' : 'jour';
  };

  // Textes des pages, dans la voix du client (tutoiement). « \n » : retour à la ligne ; « {cafes} » : le compteur ;
  // { soir, jour } : selon l'heure. Montage et Roblox ne changent que ce qui diffère du gaming ; les pages linedev écrivent
  // leurs textes en dur et ne prennent ici que ce qui dépend de l'heure.
  const TEXTES = {
    gaming: {
      'demarrage-mot': { soir: 'Les petits dorment, on peut y aller.', jour: 'Un moment de libre, on en profite.' },
      'demarrage-titre': 'Installe-toi,\nj’arrive.',
      'demarrage-petit': '',
      'ce-soir': { soir: 'Ce soir :', jour: 'Aujourd’hui :' },
      'ce-soir-vu': { soir: 'Ce soir, on a vu :', jour: 'Aujourd’hui, on a vu :' },
      'coucher-suite': { soir: ' environ. Après, dodo.', jour: ' environ.' },
      'pause-mot': { soir: 'Café n° {cafes} de la soirée.', jour: 'Café n° {cafes} de la journée.' },
      'pause-texte': 'Je reviens dans cinq minutes.\nLe chat reste ouvert, discute avec les autres.',
      'enfant-texte': 'Je reviens vite. Garde-moi ma place au chaud.',
      'fin-mot': 'Merci d’être passé.',
      'fin-titre': { soir: 'Bonne nuit\ntout le monde', jour: 'Merci,\nà très vite' },
      'fin-texte': { soir: 'Moi, je file me coucher : demain, réveil à 7 h.', jour: 'Je retourne à ma journée de papa.' },
      'fin-prochain': 'Prochain live',
      'pied': 'Un follow, ça me fait vraiment plaisir',
    },
    montage: {
      'demarrage-mot': { soir: 'Les petits dorment, on monte une vidéo.', jour: 'Un moment de libre, on monte une vidéo.' },
    },
    roblox: {
      'demarrage-mot': { soir: 'On construit un jeu ce soir.', jour: 'On construit un jeu aujourd’hui.' },
      'demarrage-titre': 'L’atelier\nouvre.',
      'demarrage-petit': 'Le lien du jeu arrive dans le chat.',
      'pause-mot': 'Le serveur reste ouvert.',
      'pause-texte': 'Continue à jouer, je reviens dans cinq minutes.\nTrouve-moi un bug en attendant.',
      'enfant-texte': 'Je reviens vite. Construis-moi un truc en attendant !',
      'fin-mot': 'Merci d’avoir construit avec moi.',
      'fin-titre': 'L’atelier\nferme.',
      'fin-texte': 'Le jeu reste en ligne : va battre mon record.',
      'fin-prochain': 'Prochain atelier',
      'pied': 'Viens tester le jeu avec moi',
    },
  };

  // Le conseil du papa : de vrais conseils, relus par le client sur la planche du 2026-11-08.
  const CONSEILS = {
    gaming: [
      'Baisse un peu la sensibilité de ta souris. Tu viseras mieux, promis.',
      'Valorant : garde ton viseur à hauteur de tête, même quand personne n’est en vue.',
      'Rocket League : regarde où sont les autres, pas seulement le ballon.',
      'Avant d’acheter un jeu, regarde dix minutes de partie sans montage.',
      'Une pause toutes les heures. Tes yeux te diront merci.',
      'Casque sur les oreilles quand toute la maison dort.',
    ],
    montage: [
      'Coupe les silences du début : on décide en deux secondes si on reste.',
      'Règle le son de ta voix avant celui du jeu.',
      'Sauvegarde ton projet avant chaque grosse coupe.',
      'Regarde ton montage une fois sans le son : tu verras ce qui traîne.',
      'Exporte dix secondes pour essayer avant le rendu complet.',
    ],
    dev: [
      'Avant de coller du code trouvé en ligne, lis-le une fois en entier.',
      'Un message d’erreur se lit jusqu’au bout. La réponse est souvent dedans.',
      'Un commit Git avant de tout changer, et tu peux toujours revenir en arrière.',
      'Ne fais jamais confiance à ce que tape l’utilisateur : vérifie tout côté serveur.',
      'Des noms de variables clairs. Dans six mois, tu me remercieras.',
      'Bloqué depuis vingt minutes ? Explique ton problème à voix haute.',
    ],
    roblox: [
      'Ctrl+D duplique la pièce choisie. Pratique pour un escalier.',
      'Coche Anchored sur tes décors, sinon ils tombent au lancement.',
      'Touche F : la caméra se centre sur l’objet choisi.',
      'Ctrl+G groupe tes pièces pour les déplacer d’un coup.',
      'F5 lance le test, Maj+F5 l’arrête.',
      'Tes scripts de jeu vont dans ServerScriptService, pas dans le décor.',
    ],
  };
  const CONSEIL_MS = 20000;

  const STATUTS = { histoire: 'une dernière histoire…', eau: 'verre d’eau demandé', calin: 'un gros câlin', dort: 'il dort !' };
  const STATUT_DEFAUT = 'mission papa en cours';
  const STATUT_VALIDE_MS = 3 * 3600 * 1000; // un statut plus vieux date d'une autre soirée
  const SOIREE_DECALAGE_MS = 6 * 3600 * 1000; // un café à 1 h du matin compte encore pour la soirée de la veille

  function moustache() {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 6 240 54');
    svg.setAttribute('aria-hidden', 'true');
    for (const miroir of [false, true]) {
      const p = document.createElementNS(SVG, 'path');
      p.setAttribute('fill', 'currentColor');
      p.setAttribute('d', TRACE);
      if (miroir) p.setAttribute('transform', 'matrix(-1 0 0 1 240 0)');
      svg.appendChild(p);
    }
    return svg;
  }
  function poserMoustaches() {
    document.querySelectorAll('.moustache:not([data-posee])').forEach((el) => { el.replaceChildren(moustache()); el.dataset.posee = ''; });
  }

  /** Écrit un texte : les « \n » deviennent des retours à la ligne, « {cafes} » le compteur de cafés. */
  function ecrire(el, texte) {
    const morceaux = [];
    texte.split('\n').forEach((ligne, i) => {
      if (i) morceaux.push(document.createElement('br'));
      ligne.split('{cafes}').forEach((bout, j) => {
        if (j) { const n = document.createElement('span'); n.dataset.cafes = ''; morceaux.push(n); }
        if (bout) morceaux.push(document.createTextNode(bout));
      });
    });
    el.replaceChildren(...morceaux);
  }

  let texteSeance = null;
  function poserTextes() {
    const s = seance();
    const quand = moment();
    if (`${s}|${quand}` === texteSeance) return;
    texteSeance = `${s}|${quand}`;
    const textes = { ...TEXTES.gaming, ...(TEXTES[univers()] || {}), ...(TEXTES[s] || {}) };
    document.querySelectorAll('[data-texte]').forEach((el) => {
      const brut = textes[el.dataset.texte];
      const t = brut && typeof brut === 'object' ? brut[quand] : brut;
      if (t === undefined) return;
      ecrire(el, t);
      el.hidden = t === '';
    });
    afficherCafes();
  }

  let photoUnivers = null;
  function poserPhotos() {
    const u = univers();
    if (u === photoUnivers) return;
    photoUnivers = u;
    const fonds = (window.FONDS || {})[u] || {};
    document.querySelectorAll('[data-photo]').forEach((el) => {
      const liste = fonds[el.dataset.photo] || [];
      el.classList.remove('vue');
      if (!liste.length) return;
      const choix = liste[Math.floor(Math.random() * liste.length)];
      const image = new Image();
      image.onload = () => { el.style.backgroundImage = `url("${choix}")`; el.classList.add('vue'); };
      image.src = choix;
    });
  }

  let conseilListe = null;
  let conseilRang = 0;
  function poserConseil() {
    const el = document.querySelector('[data-conseil]');
    if (!el) return;
    const liste = CONSEILS[seance()] || CONSEILS[univers()];
    if (liste === conseilListe) return;
    conseilListe = liste;
    conseilRang = Math.floor(Math.random() * liste.length);
    el.textContent = liste[conseilRang];
  }
  function conseilSuivant() {
    const el = document.querySelector('[data-conseil]');
    if (!el || !conseilListe) return;
    el.classList.add('cache');
    setTimeout(() => {
      conseilRang = (conseilRang + 1) % conseilListe.length;
      el.textContent = conseilListe[conseilRang];
      el.classList.remove('cache');
    }, 600);
  }

  function cleCafes() {
    const d = new Date(Date.now() - SOIREE_DECALAGE_MS);
    const jour = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return `cafes:${univers()}:${jour}`;
  }
  function lireCafes() {
    try { return Number(localStorage.getItem(cleCafes())) || 0; } catch { return 0; }
  }
  function afficherCafes() {
    const n = String(Math.max(1, lireCafes()));
    document.querySelectorAll('[data-cafes]').forEach((el) => { el.textContent = n; });
  }
  function compterCafe() {
    try { localStorage.setItem(cleCafes(), String(lireCafes() + 1)); } catch { /* stockage indisponible : on affiche 1 */ }
    afficherCafes();
  }

  function afficherStatut() {
    const els = document.querySelectorAll('[data-statut]');
    if (!els.length) return;
    const enfant = (window.JEU || {}).enfant;
    const frais = enfant && STATUTS[enfant.statut] && Date.now() - Number(enfant.depuis || 0) < STATUT_VALIDE_MS;
    const texte = frais ? STATUTS[enfant.statut] : STATUT_DEFAUT;
    els.forEach((el) => { if (el.textContent !== texte) el.textContent = texte; });
  }
  function relireJeu() {
    const s = document.createElement('script');
    s.src = '../jeu.js?t=' + Date.now();
    s.onload = () => { afficherStatut(); s.remove(); };
    s.onerror = () => { afficherStatut(); s.remove(); };
    document.head.appendChild(s);
  }

  function afficherCoucher(live) {
    const heure = String(live.coucher || '').trim();
    document.querySelectorAll('[data-coucher]').forEach((el) => {
      el.hidden = !heure;
      const h = el.querySelector('[data-coucher-heure]');
      if (h) h.textContent = heure;
    });
  }

  let premierLive = true;
  document.addEventListener('live', (e) => {
    poserTextes();
    poserPhotos();
    poserConseil();
    afficherCoucher(e.detail || {});
    if (premierLive) {
      premierLive = false;
      // La séance arrive par le CSS de la source OBS, ajouté à la fin du chargement : on compte le café un peu après.
      if (document.documentElement.hasAttribute('data-compter-cafes')) setTimeout(compterCafe, 1500);
      if (document.querySelector('[data-conseil]')) setInterval(conseilSuivant, CONSEIL_MS);
      if (document.querySelector('[data-statut]')) { relireJeu(); setInterval(relireJeu, 2000); }
    }
  });
  document.addEventListener('DOMContentLoaded', () => {
    poserMoustaches(); poserTextes(); afficherStatut(); afficherCafes();
    // Sans live.js (fichier absent), les textes du gaming restent et la photo est tirée quand même.
    setTimeout(() => { if (photoUnivers === null) { poserPhotos(); poserConseil(); } }, 1500);
  });
})();
