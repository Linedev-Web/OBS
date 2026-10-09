/* Soutiens du live (demande du client, 2026-10-09) : follows, abonnements et dons sur Twitch, YouTube et TikTok, écrits
   par obs/soutiens.mjs dans ../soutiens.js et relus toutes les 2 s (comme live.js). Deux formes :
   - [data-soutiens="defile"] : une ligne qui défile en boucle (au-dessus de la caméra, bandeau vertical) ; immobile tant
     qu'elle tient dans sa largeur ; repart du début à chaque nouveau soutien ;
   - [data-soutiens="liste"] : tous les pseudos (écrans de fin), fixes tant qu'ils tiennent dans le cadre, sinon
     défilement vertical en boucle.
   data-vide : la phrase tant que personne n'a encore soutenu (elle donne envie d'apparaître dans la liste).
   Sobre : le logo de la plateforme devant le pseudo, aucune autre forme (charte des lives). */
(function () {
  const ICONES = {
    twitch: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M4.3 2 3 5.3V19h4.6v3h2.6l3-3h3.7L22 13.9V2H4.3Zm15.4 10.8-2.9 2.9h-4.6l-2.6 2.6v-2.6H5.6V4.3h14.1v8.5ZM16.3 6.8h-2.1v5.1h2.1V6.8Zm-5.6 0H8.6v5.1h2.1V6.8Z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4a2.6 2.6 0 0 0-1.8 1.8A27 27 0 0 0 2 12a27 27 0 0 0 .4 4.8 2.6 2.6 0 0 0 1.8 1.8c1.6.4 7.8.4 7.8.4s6.2 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.8A27 27 0 0 0 22 12a27 27 0 0 0-.4-4.8ZM10 15.1V8.9l5.3 3.1L10 15.1Z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.6 2c.3 2.4 1.7 3.9 4 4.1v3.1a7.3 7.3 0 0 1-3.9-1.3v6.4a6 6 0 1 1-6-6v3.2a2.9 2.9 0 1 0 2.8 2.9V2h3.1Z"/></svg>',
  };
  const GENRES = { abonnement: 'abonné', don: 'don' }; // un follow n'a pas de mention : c'est le cas courant
  const IMPORTANCE = { don: 0, abonnement: 1, follow: 2 };
  const VITESSE = 70; // pixels de maquette par seconde
  let signature = null;

  function argent(s) {
    if (!s.montant) return '';
    if (s.devise === 'DIAMANTS' || s.devise === 'BITS') return `${new Intl.NumberFormat('fr-FR').format(s.montant)} ${s.devise === 'BITS' ? 'bits' : 'diamants'}`;
    try { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: s.devise || 'EUR' }).format(s.montant); }
    catch { return String(s.montant); }
  }

  function element(s) {
    const e = document.createElement('span');
    e.className = 'soutien';
    e.dataset.plateforme = s.plateforme;
    const icone = document.createElement('span');
    icone.className = 'soutien-icone';
    icone.innerHTML = ICONES[s.plateforme] || '';
    const nom = document.createElement('span');
    nom.className = 'soutien-nom';
    nom.textContent = s.nom;
    e.append(icone, nom);
    const mention = s.genre === 'don' ? (argent(s) || GENRES.don) : GENRES[s.genre];
    if (mention) {
      const m = document.createElement('span');
      m.className = 'soutien-genre';
      m.textContent = mention;
      e.append(m);
    }
    return e;
  }

  function texteVide(conteneur) {
    const p = document.createElement('span');
    p.className = 'soutiens-vide';
    p.textContent = conteneur.dataset.vide || '';
    return p;
  }

  // Une ligne : immobile si elle tient, sinon deux copies qui glissent en boucle.
  function rendreDefile(conteneur, liste) {
    conteneur.textContent = '';
    if (!liste.length) { conteneur.append(texteVide(conteneur)); return; }
    const piste = document.createElement('span');
    piste.className = 'soutiens-piste';
    for (const s of liste) piste.append(element(s));
    conteneur.append(piste);
    const largeur = piste.scrollWidth;
    if (largeur <= conteneur.clientWidth) return;
    const ecart = parseFloat(getComputedStyle(piste).columnGap) || 0;
    for (const s of liste) piste.append(element(s));
    const distance = largeur + ecart;
    piste.style.setProperty('--distance', `${-distance}px`);
    piste.style.animation = `soutiens-defile ${distance / VITESSE}s linear infinite`;
  }

  // Les pseudos de la fin : dons, puis abonnements, puis follows ; défilement vertical s'ils dépassent du cadre.
  function rendreListe(conteneur, liste) {
    conteneur.textContent = '';
    conteneur.classList.remove('en-boucle');
    if (!liste.length) { conteneur.append(texteVide(conteneur)); return; }
    const tries = [...liste].sort((a, b) => IMPORTANCE[a.genre] - IMPORTANCE[b.genre] || Date.parse(a.quand) - Date.parse(b.quand));
    const bloc = document.createElement('div');
    bloc.className = 'soutiens-bloc';
    for (const s of tries) bloc.append(element(s));
    conteneur.append(bloc);
    if (bloc.scrollHeight <= conteneur.clientHeight) return; // tout tient : liste fixe
    conteneur.classList.add('en-boucle'); // fondu en haut et en bas : aucune ligne coupée net
    const copie = bloc.cloneNode(true);
    copie.setAttribute('aria-hidden', 'true');
    conteneur.append(copie);
    const distance = bloc.offsetHeight + (parseFloat(getComputedStyle(conteneur).rowGap) || 0);
    for (const b of [bloc, copie]) {
      b.style.setProperty('--distance', `${-distance}px`);
      b.style.animation = `soutiens-monte ${distance / (VITESSE * 0.5)}s linear infinite`;
    }
  }

  function rendre(donnees) {
    const liste = Array.isArray(donnees && donnees.liste) ? donnees.liste : [];
    const nouvelle = JSON.stringify(liste);
    if (nouvelle === signature) return; // rien de neuf : on ne relance pas le défilement
    signature = nouvelle;
    document.querySelectorAll('[data-soutiens]').forEach((c) => (c.dataset.soutiens === 'liste' ? rendreListe(c, liste) : rendreDefile(c, liste)));
  }

  function relire() {
    const s = document.createElement('script');
    s.src = '../soutiens.js?t=' + Date.now();
    s.onload = () => { rendre(window.SOUTIENS); s.remove(); };
    s.onerror = () => { if (signature === null) rendre({ liste: [] }); s.remove(); };
    document.head.appendChild(s);
  }

  document.addEventListener('DOMContentLoaded', () => {
    relire();
    setInterval(relire, 2000);
  });
})();
