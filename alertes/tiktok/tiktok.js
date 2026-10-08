'use strict';
// Alertes TikTok (Latshow / linedev) — demande du client, 2026-10-08 : les mêmes alertes que sur Twitch et YouTube,
// dans l'image verticale envoyée à TikTok. TikFinity (application de bureau) lit le live TikTok et rediffuse chaque
// événement sur ws://127.0.0.1:21213 ; ce fichier les traduit en alertes et les donne au moteur des alertes
// StreamElements (../streamelements/latshow/widget.js : même file d'attente, mêmes animations, mêmes jingles).
//
// Paramètres de la page : ?port=21213 (autre port), ?essai=1 (joue des événements d'exemple, sans TikFinity).
// Tout texte venu des spectateurs passe par textContent dans le moteur : jamais d'innerHTML.

const TIKTOK = {
  port: 21213,
  grosCadeau: 1000,     // diamants (cadeau × nombre) : au-delà, la grande alerte
  palierLikes: 1000,    // une alerte tous les 1 000 likes du live, pas à chaque like
  reconnexionMs: 3000,  // TikFinity fermé ou relancé : on retente sans fin
};
const BULLES_TIKTOK = {
  cadeau: ['Merci !', 'Ça fait plaisir', 'Tu régales !'],
  gros: ['ÉNORME, merci !', 'Je n’en reviens pas', 'Légende.'],
  likes: ['Ça chauffe !', 'Continuez !', 'Le live s’enflamme'],
};

// TikFinity donne l'utilisateur à plat (nickname, uniqueId…) ou dans data.user selon la version : on lit les deux.
function utilisateurTikTok(d) {
  const u = d.user || {};
  const photo = d.profilePictureUrl || u.profilePictureUrl || (u.profilePicture && Array.isArray(u.profilePicture.url) ? u.profilePicture.url[0] : '');
  return { nom: pseudo(d.nickname || u.nickname || d.uniqueId || u.uniqueId) || 'Quelqu’un', photo: photo || undefined };
}

function cadeauTikTok(d) {
  const g = d.giftDetails || d.gift || {};
  const image = d.giftPictureUrl || (g.giftImage && g.giftImage.giftPictureUrl) || g.image || '';
  return {
    nom: pseudo(d.giftName || g.giftName || g.name) || 'un cadeau',
    image: image || undefined,
    diamants: Number(d.diamondCount != null ? d.diamondCount : g.diamondCount) || 0,
    // type 1 : cadeau qu'on envoie en rafale ; TikTok renvoie l'événement à chaque envoi, puis une dernière fois en fin de série
    enSerie: Number(d.giftType != null ? d.giftType : g.giftType) === 1,
  };
}

/** Événement TikFinity → alerte du moteur (ou null : rien à afficher). `etat` garde le dernier palier de likes. */
function alerteTikTok(evenement, etat) {
  const d = (evenement && evenement.data) || {};
  const u = utilisateurTikTok(d);
  switch (evenement && evenement.event) {
    case 'follow':
      return { cle: 'follow', type: 'Follow', nom: u.nom, detail: 'te suit', image: u.photo };
    case 'subscribe': {
      const mois = Number(d.subMonth) || 0;
      return { cle: mois > 1 ? 'resub' : 'sub', type: 'Abonnement', nom: u.nom, detail: `s’abonne${mois > 1 ? ` · ${mois} mois` : ''}`, image: u.photo };
    }
    case 'gift': {
      const c = cadeauTikTok(d);
      if (c.enSerie && !d.repeatEnd) return null; // une seule alerte, avec le total, à la fin de la rafale
      const n = Math.max(1, Number(d.repeatCount) || 1);
      const gros = c.diamants * n >= TIKTOK.grosCadeau;
      return {
        cle: gros ? 'raid' : 'tip',
        titre: gros ? 'Énorme cadeau !' : 'Cadeau !',
        bulles: gros ? BULLES_TIKTOK.gros : BULLES_TIKTOK.cadeau,
        type: 'Cadeau', nom: u.nom,
        detail: `offre ${c.nom}${n > 1 ? ` × ${entier(n)}` : ''}`,
        image: c.image || u.photo,
      };
    }
    case 'like': {
      const palier = Math.floor((Number(d.totalLikeCount) || 0) / TIKTOK.palierLikes);
      if (palier < 1 || palier <= etat.palierLikes) return null;
      etat.palierLikes = palier;
      return { cle: 'follow', titre: 'Likes !', bulles: BULLES_TIKTOK.likes, type: 'Likes', nom: `${entier(palier * TIKTOK.palierLikes)} likes`, detail: `merci ${u.nom} et tout le monde !`, image: u.photo };
    }
    default:
      return null; // commentaires, arrivées, partages, configuration de TikFinity : pas d'alerte
  }
}

const etatTikTok = { palierLikes: 0 };

function recevoirTikTok(evenement) {
  const alerte = alerteTikTok(evenement, etatTikTok);
  if (!alerte) return;
  file.push(alerte);
  suivant();
}

function brancherTikFinity(port) {
  let ws;
  const reessayer = () => setTimeout(() => brancherTikFinity(port), TIKTOK.reconnexionMs);
  try { ws = new WebSocket(`ws://127.0.0.1:${port}/`); } catch { reessayer(); return; }
  ws.onmessage = (m) => {
    try { recevoirTikTok(JSON.parse(m.data)); } catch (erreur) { console.error('[tiktok]', erreur); }
  };
  ws.onclose = reessayer;
}

// Des événements d'exemple, passés par la même traduction que les vrais : un follow, une rafale de Roses (une seule
// alerte attendue), un gros cadeau, un abonnement, le premier palier de likes.
function essaiTikTok() {
  const rafale = [1, 2, 3, 5, 10].map((n, i, t) => ({ event: 'gift', data: { nickname: 'Kev_92', giftName: 'Rose', diamondCount: 1, giftType: 1, repeatCount: n, repeatEnd: i === t.length - 1 } }));
  const exemples = [
    { event: 'follow', data: { nickname: 'Marie', uniqueId: 'marie.92' } },
    ...rafale,
    { event: 'gift', data: { nickname: 'Lucas', giftName: 'Lion', diamondCount: 29999, giftType: 2, repeatCount: 1, repeatEnd: true } },
    { event: 'subscribe', data: { nickname: 'Nina', subMonth: 3 } },
    { event: 'like', data: { nickname: 'Tom', totalLikeCount: 1040 } },
  ];
  exemples.forEach(recevoirTikTok);
}

if (!window.__TEST_TIKTOK__) {
  const params = new URLSearchParams(location.search);
  window.dispatchEvent(new CustomEvent('onWidgetLoad', { detail: { fieldData: window.REGLAGES_TIKTOK || {}, channel: { provider: 'twitch' } } }));
  if (params.has('essai')) setTimeout(essaiTikTok, 800);
  else brancherTikFinity(Number(params.get('port')) || TIKTOK.port);
}
