'use strict';
// Alertes sur mesure (Latshow / linedev) — widget personnalisé StreamElements.
// Même fichier pour les deux marques : seuls widget.html, widget.css et les valeurs par défaut de fields.json changent.
// Une alerte à la fois, dans l'ordre d'arrivée, aucune perdue. Tout texte venu des spectateurs passe par textContent :
// jamais d'innerHTML, donc aucun HTML ni script injecté ne peut s'exécuter.

const SORTIE_MS = 420;          // durée de l'animation de sortie (widget.css, .sortie)
const SON_DELAI_MS = 350;       // le son part quand la moustache atterrit : sa note forte tombe quand elle frise (0,48 s)
// v3 « papa » (2026-11-08) : titre, bulle de BD dans la voix du client, geste de la moustache et son propres à chaque
// type d'alerte (v2 du 2026-10-07 : même mécanique, style « gaming »).
const TITRES = {
  follow: 'Nouveau follow !', abonne: 'Nouvel abonné !', sub: 'Abonnement !', resub: 'Réabonnement !', gift: 'Cadeau !',
  membre: 'Nouveau membre !', tip: 'Dans la tirelire !', superchat: 'Super Chat !', cheer: 'Des bits !', raid: 'Ding dong, un raid !',
};
// {nom} : le pseudo, seulement s'il est court (NOM_BULLE_MAX) ; chaque liste garde au moins une bulle sans {nom}.
const BULLES = {
  follow: ['Merci {nom}, la moustache te salue !', 'Bienvenue {nom}, fais comme chez toi', 'Installe-toi, y a du café', 'La moustache te salue !'],
  abonne: ['Merci {nom}, la moustache te salue !', 'Bienvenue à la maison, {nom}', 'Un de plus à table !'],
  sub: ['{nom}, la moustache frise de joie !', 'Merci {nom}, t’es un amour', 'Ça, c’est du soutien !'],
  resub: ['{nom}, toujours fidèle au poste !', 'Encore là ? Je t’adore.', 'La moustache se souvient de toi'],
  gift: ['{nom} régale toute la tablée !', 'C’est Noël avant l’heure !', 'Merci pour les copains !'],
  membre: ['Bienvenue au club, {nom} !', 'La moustache t’adoube', 'Merci, vraiment !'],
  tip: ['Merci {nom}, ça paiera les couches !', 'La tirelire te dit merci !', 'Le café de demain, c’est toi'],
  superchat: ['Merci {nom}, ça paiera les couches !', 'La moustache en tremble !', 'Énorme, merci !'],
  cheer: ['Merci {nom}, ça chatouille !', 'Pluie de bits, la moustache frise !', 'Ça chatouille, merci !'],
  raid: ['Entrez, entrez ! Essuyez vos pieds', 'Chut, les petits dorment !', 'Bienvenue {nom} et toute la bande !'],
};
const BULLES_DEV = {
  abonne: ['Merci {nom}, la moustache te salue !', 'Un dev de plus à la maison !', 'Bienvenue dans le cours, {nom}'],
  membre: ['Bienvenue au club, {nom} !', 'Ça compile du premier coup !', 'Merci, vraiment !'],
  gift: ['{nom} régale toute la classe !', 'C’est Noël avant l’heure !', 'Merci pour les copains !'],
  tip: ['Merci {nom}, le café est offert !', 'Ça compile du premier coup !', 'La tasse te dit merci !'],
  superchat: ['Merci {nom}, le café est offert !', 'La moustache en tremble !', 'Énorme, merci !'],
};
const TITRES_DEV = { tip: 'Pour le café !' };
const NOM_BULLE_MAX = 14;      // au-delà, la bulle ne cite pas le pseudo (elle tiendrait sur trois lignes)
const ANONYME = 'Quelqu’un';
// Polices chargées dès l'ouverture : sinon la première alerte attend Google Fonts, texte invisible (display=block).
const POLICES = ['800 84px "Bricolage Grotesque"', '500 34px "Bricolage Grotesque"', '400 26px "Bricolage Grotesque"', '700 32px "Kalam"'];
const PSEUDO_MAX = 25;          // caractères ; au-delà, coupé avec « … »
const FILTRE_DELAI_MS = 800;    // le filtre de grossièretés de StreamElements ne doit jamais bloquer la file
const CHEERMOTES = /(^|\s)(cheer|biblethump|cheerwhal|corgo|uni|showlove|party|seemsgood|pride|kappa|frankerz|heyguys|dansgame|elegiggle|trihard|kreygasm|4head|swiftrage|notlikethis|failfish|vohiyo|pjsalt|mrdestructoid|bday|ripcheer|shamrock|streamlabs|muxy|doodlecheer|anon)\d+(?=\s|$)/gi;
const NIVEAUX = { 2000: 'niveau 2', 3000: 'niveau 3', prime: 'Prime' };

let reglages = {};
let devise = 'EUR';
let plateforme = 'twitch';
let sonCoupe = false;
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
  prechargerPolices();
  envoyerSession(d.session);
});

function prechargerPolices() {
  if (!document.fonts || typeof document.fonts.load !== 'function') return;
  for (const police of POLICES) document.fonts.load(police).catch(() => {});
}

window.addEventListener('onEventReceived', (obj) => {
  const d = (obj && obj.detail) || {};
  const ecouteur = d.listener;
  const evt = d.event || {};
  if (ecouteur === 'event:skip') return passer();
  if (ecouteur === 'alertService:toggleSound') { sonCoupe = !sonCoupe; return; }
  if (estBoutonTester(ecouteur, evt)) return demonstration();
  if (!evt.isTest) relayerSoutien(ecouteur, evt);
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
  const nom = pseudo(e.displayName || e.name) || ANONYME;
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

// ---------- Soutiens du live (obs/soutiens.mjs) ----------
// Chaque follow, abonnement ou don part aussi vers le service local des soutiens (lancé par OBS), qui en fait la liste
// du live : bandeau au-dessus de la caméra, bandeau vertical, écrans de fin. S'il ne répond pas, l'alerte n'en souffre pas.

const SOUTIENS = 'http://127.0.0.1:21310/soutien';

function envoyerSoutien(message) {
  try {
    fetch(SOUTIENS, { method: 'POST', mode: 'cors', keepalive: true, headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(message) }).catch(() => {});
  } catch { /* hors d'OBS (aperçu, test) : rien à envoyer */ }
}

// Qui soutient : l'abonné YouTube est l'équivalent du follow ; un abonnement offert compte pour celui qui l'offre.
function soutienDe(ecouteur, e) {
  const nom = pseudo(e.displayName || e.name);
  const offreur = pseudo(e.sender);
  const montant = Number(e.amount) || 0;
  switch (ecouteur) {
    case 'follower-latest': return { genre: 'follow', nom };
    case 'subscriber-latest':
      if (plateforme === 'youtube') return { genre: 'follow', nom };
      return { genre: 'abonnement', nom: (e.gifted || e.bulkGifted) && offreur ? offreur : nom };
    case 'sponsor-latest': return { genre: 'abonnement', nom: e.gifted && offreur ? offreur : nom };
    case 'tip-latest':
    case 'superchat-latest': return { genre: 'don', nom, montant, devise };
    case 'cheer-latest': return { genre: 'don', nom, montant, devise: 'BITS' };
    default: return null;
  }
}

function relayerSoutien(ecouteur, e) {
  const s = soutienDe(ecouteur, e);
  if (s && s.nom) envoyerSoutien({ type: 'soutien', plateforme, ...s });
}

// Au chargement : ce qui s'est passé depuis le début de la session StreamElements (le service garde ce qui date du live).
const RECENTS = [['follower-recent', 'follower-latest'], ['subscriber-recent', 'subscriber-latest'], ['tip-recent', 'tip-latest'],
  ['cheer-recent', 'cheer-latest'], ['sponsor-recent', 'sponsor-latest'], ['superchat-recent', 'superchat-latest']];
function envoyerSession(session) {
  const donnees = (session && session.data) || {};
  const liste = [];
  for (const [cle, ecouteur] of RECENTS) {
    for (const e of Array.isArray(donnees[cle]) ? donnees[cle] : []) {
      const s = soutienDe(ecouteur, e || {});
      if (s && s.nom) liste.push({ ...s, plateforme, quand: e.createdAt });
    }
  }
  if (liste.length) envoyerSoutien({ type: 'session', plateforme, liste });
}

function abonneYoutube(nom) {
  if (!actif('afficherAbonneYoutube')) return null;
  return { type: 'Abonné', nom, detail: 's’abonne à la chaîne' };
}

function abonnementTwitch(e, nom, montant) {
  if (!actif('afficherSub')) return null;
  if (e.isCommunityGift || e.playedAsCommunityGift) return null; // déjà annoncé par le cadeau groupé
  if (e.bulkGifted) {
    const offrant = pseudo(e.sender || e.name) || ANONYME;
    return { type: 'Abonnements offerts', nom: offrant, detail: montant > 1 ? `offre ${entier(montant)} abonnements` : 'offre un abonnement' };
  }
  if (e.gifted) {
    const offrant = pseudo(e.sender) || ANONYME;
    return { type: 'Abonnement offert', nom: offrant, detail: `offre un abonnement à ${nom}` };
  }
  const niveau = NIVEAUX[String(e.tier)] ? ` · ${NIVEAUX[String(e.tier)]}` : '';
  return { type: 'Abonnement', nom, detail: `s’abonne${mois(montant)}${niveau}`, message: nettoyerMessage(e.message, false) };
}

function membreYoutube(e, nom, montant) {
  if (!actif('afficherMembre')) return null;
  if (e.isCommunityGift || e.playedAsCommunityGift) return null;
  if (e.bulkGifted) {
    const offrant = pseudo(e.sender || e.name) || ANONYME;
    return { type: 'Adhésions offertes', nom: offrant, detail: montant > 1 ? `offre ${entier(montant)} adhésions` : 'offre une adhésion' };
  }
  if (e.gifted) {
    const offrant = pseudo(e.sender) || ANONYME;
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
    const son = setTimeout(() => jouerSon(alerte.cle), SON_DELAI_MS);
    let fini = false;
    const terminer = () => {
      if (fini) return;
      fini = true;
      clearTimeout(minuteur);
      clearTimeout(son);
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

// La bulle de BD, dans la voix du client : elle cite le pseudo quand il est court, jamais « Quelqu’un ».
const estDev = () => Boolean(document.querySelector('[data-marque=linedev]'));

function choisirBulle(alerte) {
  const liste = alerte.bulles || (estDev() && BULLES_DEV[alerte.cle]) || BULLES[alerte.cle] || BULLES.follow;
  const nom = String(alerte.nom || '');
  const citable = nom && nom !== ANONYME && [...nom].length <= NOM_BULLE_MAX;
  const sansNom = liste.filter((b) => !b.includes('{nom}'));
  const choix = citable || !sansNom.length ? liste : sansNom;
  return typo(choix[Math.floor(Math.random() * choix.length)]).replace('{nom}', nom);
}

// Espace fine insécable avant « ! ? ; : » (le « ! » ne part jamais seul à la ligne). Nos textes seulement, pas ceux des spectateurs.
function typo(texte) { return String(texte).replace(/ ([!?;:])/g, ' $1'); }

// « : 5,00 € » (dons, Super Chat, bits) se lit sous le pseudo : « t’offre 5,00 € ».
function texteDetail(detail) {
  const d = String(detail || '');
  return d.startsWith(':') ? `t’offre ${d.slice(1).trim()}` : d;
}

function remplir(alerte) {
  const carte = $('alerte');
  [...carte.classList].filter((c) => c.startsWith('theme-')).forEach((c) => carte.classList.remove(c));
  carte.classList.add(`theme-${alerte.cle || 'follow'}`);
  // titre, bulles et image propres à l'alerte (alertes TikTok : photo du spectateur, image du cadeau), sinon ceux du type
  lettres($('titre'), typo(alerte.titre || (estDev() && TITRES_DEV[alerte.cle]) || TITRES[alerte.cle] || alerte.type));
  lettres($('pseudo'), alerte.nom);
  $('detail').textContent = texteDetail(alerte.detail);
  $('message').textContent = alerte.message || '';
  carte.classList.toggle('avec-message', Boolean(alerte.message));
  if ($('bulle')) $('bulle').textContent = choisirBulle(alerte);
  const vignette = $('avatar');
  if (vignette) {
    vignette.hidden = !alerte.image;
    if (alerte.image) vignette.src = alerte.image;
  }
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
