'use strict';
// Alertes sur mesure (Latshow / linedev) — widget personnalisé StreamElements.
// Même fichier pour les deux marques : seuls widget.html, widget.css et les valeurs par défaut de fields.json changent.
// Une alerte à la fois, dans l'ordre d'arrivée, aucune perdue. Tout texte venu des spectateurs passe par textContent :
// jamais d'innerHTML, donc aucun HTML ni script injecté ne peut s'exécuter.

const SORTIE_MS = 420;          // durée de l'animation de sortie (widget.css, .sortie)
// v2 (2026-10-07) : titre, bulle de BD drôle, sticker et jingle propres à chaque type d'alerte.
const TITRES = {
  follow: 'Nouveau follow', abonne: 'Nouvel abonné', sub: 'Abonnement', resub: 'Réabonnement', gift: 'Cadeau !',
  membre: 'Nouveau membre', tip: 'Don !', superchat: 'Super Chat', cheer: 'Bits !', raid: 'Raid !',
};
const BULLES = {
  follow: ['Bienvenue dans la team !', 'Un de plus, on est bien', 'Installe-toi !'],
  abonne: ['Bienvenue sur la chaîne !', 'Un de plus, on est bien', 'Installe-toi !'],
  sub: ['T’es un boss.', 'Merci, vraiment !', 'La classe absolue'],
  resub: ['Fidèle au poste !', 'Respect.', 'Toujours là, merci !'],
  gift: ['Quelle générosité !', 'Le Père Noël est là', 'Merci pour eux !'],
  membre: ['La classe !', 'Bienvenue au club', 'Merci, vraiment !'],
  tip: ['Merci, vraiment !', 'Tu régales !', 'Ça fait chaud au cœur'],
  superchat: ['Merci !!', 'Tu régales !', 'Énorme, merci'],
  cheer: ['Ça pique… merci !', 'Pluie de bits !', 'Merci !'],
  raid: ['Bienvenue à tous !', 'La horde arrive', 'Installez-vous !'],
};
const BULLES_DEV = {
  abonne: ['Bienvenue dans le cours !', 'git commit -m "merci"', 'Un dev de plus !'],
  membre: ['Tu fais partie du code', 'npm install soutien', 'Merci, vraiment !'],
  tip: ['Ça compile !', 'Le café est offert', 'Merci, vraiment !'],
  superchat: ['Ça compile !', 'Énorme, merci', 'Merci !!'],
};
const COULEURS_ECLAT = ['var(--couleur)', '#FFFFFF', 'var(--couleur)', '#A855F7', '#22D3EE'];
const AVATAR_DEFAUT = 'https://static-cdn.jtvnw.net/jtv_user_pictures/40408b0c-5cdc-4c32-b698-dc2e8a6de3bf-profile_image-600x600.png';
const PSEUDO_MAX = 25;          // caractères ; au-delà, coupé avec « … »
const FILTRE_DELAI_MS = 800;    // le filtre de grossièretés de StreamElements ne doit jamais bloquer la file
const CHEERMOTES = /(^|\s)(cheer|biblethump|cheerwhal|corgo|uni|showlove|party|seemsgood|pride|kappa|frankerz|heyguys|dansgame|elegiggle|trihard|kreygasm|4head|swiftrage|notlikethis|failfish|vohiyo|pjsalt|mrdestructoid|bday|ripcheer|shamrock|streamlabs|muxy|doodlecheer|anon)\d+(?=\s|$)/gi;
const NIVEAUX = { 2000: 'niveau 2', 3000: 'niveau 3', prime: 'Prime' };

let reglages = {};
let devise = 'EUR';
let plateforme = 'twitch';
let sonCoupe = false;
let numeroLigne = 12;           // linedev : numéro de la première ligne de la carte (gouttière)
const file = [];
let enCours = null;

const $ = (id) => document.getElementById(id);

window.addEventListener('onWidgetLoad', (obj) => {
  const d = (obj && obj.detail) || {};
  reglages = d.fieldData || {};
  if (d.currency && d.currency.code) devise = String(d.currency.code).toUpperCase();
  if (reglages.devise && String(reglages.devise).trim()) devise = String(reglages.devise).trim().toUpperCase();
  plateforme = choisirPlateforme(reglages.plateforme, d.channel);
  document.documentElement.style.setProperty('--haut', `${nombre('haut', 40)}px`);
});

window.addEventListener('onEventReceived', (obj) => {
  const d = (obj && obj.detail) || {};
  const ecouteur = d.listener;
  const evt = d.event || {};
  if (ecouteur === 'event:skip') return passer();
  if (ecouteur === 'alertService:toggleSound') { sonCoupe = !sonCoupe; return; }
  if (estBoutonTester(ecouteur, evt)) return demonstration();
  const alerte = construire(ecouteur, evt);
  if (!alerte) return;
  alerte.cle = cleDe(ecouteur, alerte);
  file.push(alerte);
  suivant();
});

function estBoutonTester(ecouteur, evt) {
  const champ = evt.field || (evt.data && evt.data.field);
  if (ecouteur === 'widget-button') return champ === 'tester';
  return ecouteur === 'event:test' && evt.listener === 'widget-button' && champ === 'tester';
}

function choisirPlateforme(champ, canal) {
  if (champ === 'twitch' || champ === 'youtube') return champ;
  const fournisseur = canal && (canal.provider || canal.platform);
  return fournisseur === 'youtube' ? 'youtube' : 'twitch';
}

// ---------- Réglages ----------

function actif(cle) { return reglages[cle] !== false && reglages[cle] !== 'false'; }

function nombre(cle, defaut) {
  const n = Number(reglages[cle]);
  return Number.isFinite(n) ? n : defaut;
}

// ---------- Textes ----------

function pseudo(brut) {
  const s = String(brut == null ? '' : brut).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!s) return '';
  return s.length > PSEUDO_MAX ? `${s.slice(0, PSEUDO_MAX - 1)}…` : s;
}

function nettoyerMessage(brut, retirerCheermotes) {
  let s = String(brut == null ? '' : brut).replace(/[\u0000-\u001f\u007f]/g, ' ');
  if (retirerCheermotes) s = s.replace(CHEERMOTES, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  const max = Math.max(0, Math.round(nombre('messageMax', 140)));
  if (!max) return '';
  if (s.length <= max) return s;
  const coupe = s.slice(0, max);
  const espace = coupe.lastIndexOf(' ');
  return `${(espace > max * 0.6 ? coupe.slice(0, espace) : coupe).replace(/[\s,.;:!?-]+$/, '')}…`;
}

function argent(montant) {
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: devise || 'EUR' }).format(montant);
  } catch {
    return `${montant.toFixed(2).replace('.', ',')} ${devise || '€'}`;
  }
}

function entier(n) { return new Intl.NumberFormat('fr-FR').format(n); }

function mois(n) { return n > 1 ? ` · ${n} mois` : ''; }

// ---------- Événement → alerte ----------

function construire(ecouteur, e) {
  const nom = pseudo(e.displayName || e.name) || 'Quelqu’un';
  const montant = Number(e.amount) || 0;
  switch (ecouteur) {
    case 'follower-latest':
      if (!actif('afficherFollow')) return null;
      return { type: 'Follow', nom, detail: 'te suit' };
    case 'subscriber-latest':
      return plateforme === 'youtube' ? abonneYoutube(nom) : abonnementTwitch(e, nom, montant);
    case 'tip-latest':
      if (!actif('afficherDon') || montant < nombre('donMin', 0)) return null;
      return { type: 'Don', nom, detail: `: ${argent(montant)}`, message: nettoyerMessage(e.message, false) };
    case 'cheer-latest':
      if (!actif('afficherBits') || montant < nombre('bitsMin', 1)) return null;
      return { type: 'Bits', nom, detail: `: ${entier(montant)} bits`, message: nettoyerMessage(e.message, true) };
    case 'raid-latest':
      if (!actif('afficherRaid') || montant < nombre('raidMin', 1)) return null;
      return { type: 'Raid', nom, detail: raid(montant) };
    case 'sponsor-latest':
      return membreYoutube(e, nom, montant);
    case 'superchat-latest':
      if (!actif('afficherSuperchat')) return null;
      return { type: 'Super Chat', nom, detail: `: ${argent(montant)}`, message: nettoyerMessage(e.message, false) };
    default:
      return null;
  }
}

// Type d'alerte (titre, couleur, bulle, jingle) à partir de l'écouteur StreamElements et de l'alerte construite.
function cleDe(ecouteur, alerte) {
  switch (ecouteur) {
    case 'follower-latest': return 'follow';
    case 'subscriber-latest':
      if (plateforme === 'youtube') return 'abonne';
      if (/offert/i.test(alerte.type)) return 'gift';
      return /mois/.test(alerte.detail) ? 'resub' : 'sub';
    case 'tip-latest': return 'tip';
    case 'cheer-latest': return 'cheer';
    case 'raid-latest': return 'raid';
    case 'sponsor-latest': return /offerte/i.test(alerte.type) ? 'gift' : 'membre';
    case 'superchat-latest': return 'superchat';
    default: return 'follow';
  }
}

function abonneYoutube(nom) {
  if (!actif('afficherAbonneYoutube')) return null;
  return { type: 'Abonné', nom, detail: 's’abonne à la chaîne' };
}

function abonnementTwitch(e, nom, montant) {
  if (!actif('afficherSub')) return null;
  if (e.isCommunityGift || e.playedAsCommunityGift) return null; // déjà annoncé par le cadeau groupé
  if (e.bulkGifted) {
    const offrant = pseudo(e.sender || e.name) || 'Quelqu’un';
    return { type: 'Abonnements offerts', nom: offrant, detail: montant > 1 ? `offre ${entier(montant)} abonnements` : 'offre un abonnement' };
  }
  if (e.gifted) {
    const offrant = pseudo(e.sender) || 'Quelqu’un';
    return { type: 'Abonnement offert', nom: offrant, detail: `offre un abonnement à ${nom}` };
  }
  const niveau = NIVEAUX[String(e.tier)] ? ` · ${NIVEAUX[String(e.tier)]}` : '';
  return { type: 'Abonnement', nom, detail: `s’abonne${mois(montant)}${niveau}`, message: nettoyerMessage(e.message, false) };
}

function membreYoutube(e, nom, montant) {
  if (!actif('afficherMembre')) return null;
  if (e.isCommunityGift || e.playedAsCommunityGift) return null;
  if (e.bulkGifted) {
    const offrant = pseudo(e.sender || e.name) || 'Quelqu’un';
    return { type: 'Adhésions offertes', nom: offrant, detail: montant > 1 ? `offre ${entier(montant)} adhésions` : 'offre une adhésion' };
  }
  if (e.gifted) {
    const offrant = pseudo(e.sender) || 'Quelqu’un';
    return { type: 'Adhésion offerte', nom: offrant, detail: `offre une adhésion à ${nom}` };
  }
  return { type: 'Membre', nom, detail: `devient membre${mois(montant)}`, message: nettoyerMessage(e.message, false) };
}

function raid(n) {
  if (n > 1) return `arrive avec ${entier(n)} personnes`;
  if (n === 1) return 'arrive avec 1 personne';
  return 'arrive en raid';
}

// ---------- File d'attente ----------

async function suivant() {
  if (enCours || !file.length) return;
  enCours = { passer: null };
  const alerte = file.shift();
  try {
    if (alerte.message && actif('filtrer')) alerte.message = await filtrer(alerte.message);
    await afficher(alerte);
  } catch (erreur) {
    console.error('[alertes]', erreur);
  } finally {
    enCours = null;
    if (typeof SE_API !== 'undefined' && SE_API.resumeQueue) {
      try { SE_API.resumeQueue(); } catch (erreur) { console.error('[alertes] resumeQueue', erreur); }
    }
    setTimeout(suivant, Math.max(0, nombre('entre', 0.6)) * 1000);
  }
}

function filtrer(message) {
  if (typeof SE_API === 'undefined' || !SE_API.sanitize) return Promise.resolve(message);
  const delai = new Promise((ok) => setTimeout(() => ok(message), FILTRE_DELAI_MS));
  const filtre = SE_API.sanitize({ message })
    .then((r) => (r && r.result && typeof r.result.message === 'string' ? r.result.message : message))
    .catch(() => message);
  return Promise.race([filtre, delai]);
}

function afficher(alerte) {
  return new Promise((fin) => {
    const carte = $('alerte');
    remplir(alerte);
    carte.hidden = false;
    carte.classList.remove('sortie', 'entree', 'secoue');
    void carte.offsetWidth; // relance les animations CSS
    carte.classList.add('entree', 'secoue');
    jouerSon(alerte.cle);
    let fini = false;
    const terminer = () => {
      if (fini) return;
      fini = true;
      clearTimeout(minuteur);
      carte.classList.remove('entree', 'secoue');
      carte.classList.add('sortie');
      setTimeout(() => {
        carte.hidden = true;
        carte.classList.remove('sortie');
        fin();
      }, SORTIE_MS);
    };
    const minuteur = setTimeout(terminer, Math.max(2, nombre('duree', 7)) * 1000);
    enCours.passer = terminer;
  });
}

function passer() {
  if (enCours && enCours.passer) enCours.passer();
}

// Texte découpé en lettres (chacune animée avec un léger décalage), toujours par textContent.
function lettres(el, texte) {
  if (!el) return;
  el.textContent = '';
  [...String(texte)].forEach((c, i) => {
    const s = document.createElement('span');
    s.className = 'l';
    s.style.setProperty('--i', String(i));
    s.textContent = c;
    el.appendChild(s);
  });
}

function eclat() {
  const zone = $('eclat');
  if (!zone) return;
  zone.textContent = '';
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + Math.random() * 0.4;
    const d = 260 + Math.random() * 360;
    const g = document.createElement('i');
    g.style.setProperty('--dx', `${Math.round(Math.cos(a) * d)}px`);
    g.style.setProperty('--dy', `${Math.round(Math.sin(a) * d * 0.55)}px`);
    g.style.setProperty('--r', `${Math.round(Math.random() * 360)}deg`);
    g.style.setProperty('--t', `${10 + Math.round(Math.random() * 16)}px`);
    g.style.setProperty('--c', COULEURS_ECLAT[i % COULEURS_ECLAT.length]);
    zone.appendChild(g);
  }
}

function remplir(alerte) {
  const carte = $('alerte');
  [...carte.classList].filter((c) => c.startsWith('theme-')).forEach((c) => carte.classList.remove(c));
  carte.classList.add(`theme-${alerte.cle || 'follow'}`);
  if ($('titre')) lettres($('titre'), TITRES[alerte.cle] || alerte.type);
  if ($('type')) $('type').textContent = alerte.type;
  if ($('bulle')) { const dev = document.querySelector('[data-marque=linedev]'); const choix = (dev && BULLES_DEV[alerte.cle]) || BULLES[alerte.cle] || BULLES.follow; $('bulle').textContent = choix[Math.floor(Math.random() * choix.length)]; }
  if ($('avatar')) $('avatar').src = (reglages.avatar && String(reglages.avatar).trim()) || AVATAR_DEFAUT;
  eclat();
  if ($('titre')) lettres($('pseudo'), alerte.nom); else $('pseudo').textContent = alerte.nom;
  $('detail').textContent = alerte.detail;
  $('message').textContent = alerte.message || '';
  $('alerte').classList.toggle('avec-message', Boolean(alerte.message));
  numeroLigne = numeroLigne >= 90 ? 12 : numeroLigne + 3;
  $('alerte').style.setProperty('--debut', String(numeroLigne - 1));
}

function jouerSon(cle) {
  const url = (cle && reglages[`son_${cle}`]) || reglages.son;
  if (!url || sonCoupe) return;
  try {
    const son = new Audio(url);
    son.volume = Math.min(1, Math.max(0, nombre('volume', 40) / 100));
    son.play().catch(() => {});
  } catch (erreur) {
    console.error('[alertes] son', erreur);
  }
}

// ---------- Bouton « Tester toutes les alertes » ----------

function demonstration() {
  const exemples = plateforme === 'youtube'
    ? [
        ['subscriber-latest', { name: 'Exemple' }],
        ['sponsor-latest', { name: 'Exemple', amount: 3 }],
        ['superchat-latest', { name: 'Exemple', amount: 5, message: 'Merci pour le live !' }],
        ['tip-latest', { name: 'Exemple', amount: 5, message: 'Continue comme ça.' }],
      ]
    : [
        ['follower-latest', { name: 'Exemple' }],
        ['subscriber-latest', { name: 'Exemple', amount: 3, tier: '1000', message: 'Trois mois déjà !' }],
        ['subscriber-latest', { name: 'Exemple', sender: 'Exemple', amount: 5, bulkGifted: true }],
        ['tip-latest', { name: 'Exemple', amount: 5, message: 'Merci pour le live !' }],
        ['cheer-latest', { name: 'Exemple', amount: 500, message: 'Cheer500 Bien joué' }],
        ['raid-latest', { name: 'Exemple', amount: 42 }],
      ];
  for (const [ecouteur, evt] of exemples) {
    const alerte = construire(ecouteur, evt);
    if (alerte) { alerte.cle = cleDe(ecouteur, alerte); file.push(alerte); }
  }
  suivant();
}
