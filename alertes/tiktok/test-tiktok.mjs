// Test sans dépendance de la traduction des événements TikFinity en alertes : node alertes/tiktok/test-tiktok.mjs
// Charge le moteur (widget.js) puis tiktok.js dans un bac à sable, sans réseau ni page.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const ICI = new URL('.', import.meta.url);
const contexte = {
  console, Intl, Number, String, Math, Boolean, Array, JSON, URLSearchParams,
  setTimeout: () => 0, clearTimeout: () => {},
  window: { addEventListener: () => {}, dispatchEvent: () => {}, __TEST_TIKTOK__: true },
  document: { getElementById: () => null, documentElement: { style: { setProperty() {} } }, querySelector: () => null },
};
vm.createContext(contexte);
vm.runInContext(fs.readFileSync(new URL('../streamelements/latshow/widget.js', ICI), 'utf8'), contexte);
vm.runInContext(fs.readFileSync(new URL('tiktok.js', ICI), 'utf8'), contexte);
const alerte = (evenement, etat) => vm.runInContext('alerteTikTok', contexte)(evenement, etat);
const sansEspacesFines = (s) => s.replace(/[  ]/g, ' ');

// 1. Follow : la photo TikTok de la personne devient le sticker.
{
  const a = alerte({ event: 'follow', data: { nickname: 'Marie', profilePictureUrl: 'https://exemple.test/marie.jpg' } }, { palierLikes: 0 });
  assert.equal(a.cle, 'follow');
  assert.equal(a.nom, 'Marie');
  assert.equal(a.image, 'https://exemple.test/marie.jpg');
}

// 2. Rafale de Roses : rien pendant la série, une seule alerte à la fin, avec le total.
{
  const etat = { palierLikes: 0 };
  const serie = [1, 2, 3, 5, 10].map((n, i, t) => alerte({ event: 'gift', data: { nickname: 'Kev', giftName: 'Rose', diamondCount: 1, giftType: 1, repeatCount: n, repeatEnd: i === t.length - 1 } }, etat));
  assert.deepEqual(serie.slice(0, 4), [null, null, null, null]);
  assert.equal(serie[4].detail, 'offre Rose × 10');
  assert.equal(serie[4].cle, 'tip', 'petit cadeau : alerte « Cadeau ! »');
}

// 3. Gros cadeau (≥ 1 000 diamants au total) : la grande alerte ; un cadeau hors rafale passe tout de suite.
{
  const a = alerte({ event: 'gift', data: { nickname: 'Lucas', giftName: 'Lion', diamondCount: 29999, giftType: 2, repeatCount: 1 } }, { palierLikes: 0 });
  assert.equal(a.cle, 'raid');
  assert.equal(a.titre, 'Énorme cadeau !');
  assert.equal(a.detail, 'offre Lion');
}

// 4. Format imbriqué (data.user, giftDetails) lu comme le format à plat.
{
  const a = alerte({ event: 'gift', data: { user: { nickname: 'Nina', profilePicture: { url: ['https://exemple.test/n.jpg'] } }, giftDetails: { giftName: 'Rose', diamondCount: 1, giftType: 1, giftImage: { giftPictureUrl: 'https://exemple.test/rose.png' } }, repeatCount: 3, repeatEnd: true } }, { palierLikes: 0 });
  assert.equal(a.nom, 'Nina');
  assert.equal(a.image, 'https://exemple.test/rose.png', 'image du cadeau plutôt que la photo');
  assert.equal(a.detail, 'offre Rose × 3');
}

// 5. Likes : une alerte par palier de 1 000, jamais deux fois le même palier.
{
  const etat = { palierLikes: 0 };
  const like = (total) => alerte({ event: 'like', data: { nickname: 'Tom', totalLikeCount: total } }, etat);
  assert.equal(like(999), null);
  assert.equal(sansEspacesFines(like(1040).nom), '1 000 likes');
  assert.equal(like(1500), null);
  assert.equal(sansEspacesFines(like(3100).nom), '3 000 likes');
}

// 6. Abonnement, et ce qui ne donne pas d'alerte (commentaire, arrivée, configuration de TikFinity).
{
  assert.equal(alerte({ event: 'subscribe', data: { nickname: 'Léa', subMonth: 3 } }, { palierLikes: 0 }).cle, 'resub');
  for (const event of ['chat', 'member', 'share', 'config', 'roomUser']) assert.equal(alerte({ event, data: {} }, { palierLikes: 0 }), null, event);
}

console.log('tiktok.js : 6 scénarios OK');
