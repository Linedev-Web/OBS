// Test sans réseau de la lecture du fil StreamElements par le service des soutiens : node obs/test-soutiens.mjs
// Traduction d'une activité en soutien (mêmes règles que le relais des widgets) et lecture de la clé d'un overlay.
import assert from 'node:assert/strict';
import { cleDOverlay, idsDeActivite, soutienDeActivite } from './streamelements.mjs';

const activite = (type, provider, data, createdAt = '2026-11-19T12:52:13.078Z') => ({ _id: 'a1', type, provider, channel: 'c1', data, createdAt });

// 1. Follow Twitch : le nom affiché, sinon le pseudo ; la date de l'activité.
{
  assert.deepEqual(soutienDeActivite(activite('follow', 'twitch', { username: 'kev_92', displayName: 'Kev_92' })),
    { plateforme: 'twitch', genre: 'follow', nom: 'Kev_92', quand: '2026-11-19T12:52:13.078Z' });
  assert.equal(soutienDeActivite(activite('follow', 'twitch', { username: 'kev_92' })).nom, 'kev_92');
}

// 2. Abonné YouTube = follow ; abonnement Twitch = abonnement, offert : compte pour celui qui l'offre.
{
  assert.equal(soutienDeActivite(activite('subscriber', 'youtube', { username: 'Lucas Martin' })).genre, 'follow');
  const sub = soutienDeActivite(activite('subscriber', 'twitch', { username: 'pixelsam', displayName: 'PixelSam', amount: 3 }));
  assert.equal(sub.genre, 'abonnement');
  assert.equal(sub.nom, 'PixelSam');
  assert.equal(soutienDeActivite(activite('subscriber', 'twitch', { username: 'recoit', gifted: true, sender: 'Généreux' })).nom, 'Généreux');
  assert.equal(soutienDeActivite(activite('communityGiftPurchase', 'twitch', { username: 'genereux', sender: 'Généreux', amount: 5 })).nom, 'Généreux');
  assert.equal(soutienDeActivite(activite('sponsor', 'youtube', { username: 'membre' })).genre, 'abonnement');
  assert.equal(soutienDeActivite(activite('sponsor', 'youtube', { username: 'recoit', gifted: true, sender: 'Offreur' })).nom, 'Offreur');
}

// 3. Dons : montant et devise ; bits en « BITS ».
{
  assert.deepEqual(soutienDeActivite(activite('tip', 'twitch', { username: 'Nina', amount: 5, currency: 'EUR', message: 'coucou' })),
    { plateforme: 'twitch', genre: 'don', nom: 'Nina', montant: 5, devise: 'EUR', quand: '2026-11-19T12:52:13.078Z' });
  assert.equal(soutienDeActivite(activite('superchat', 'youtube', { username: 'Chloé', amount: 10, currency: 'EUR' })).montant, 10);
  const bits = soutienDeActivite(activite('cheer', 'twitch', { username: 'Tom', amount: 500 }));
  assert.equal(bits.devise, 'BITS');
  assert.equal(bits.montant, 500);
}

// 4. Plateforme : celle de l'activité, sinon celle de la chaîne (dons StreamElements) ; autre chose = rien.
{
  assert.equal(soutienDeActivite(activite('tip', 'StreamElements', { username: 'Nina', amount: 2, currency: 'EUR' }), 'youtube').plateforme, 'youtube');
  assert.equal(soutienDeActivite(activite('tip', 'kick', { username: 'Nina', amount: 2 })), null);
}

// 5. Ce qui n'est pas un soutien : raid, host, points de chaîne, activité sans nom ou illisible.
{
  for (const type of ['raid', 'host', 'channelPointsRedemption', 'merch']) assert.equal(soutienDeActivite(activite(type, 'twitch', { username: 'x', amount: 1 })), null, type);
  assert.equal(soutienDeActivite(activite('follow', 'twitch', {})), null);
  assert.equal(soutienDeActivite(null), null);
  assert.equal(soutienDeActivite({ type: 'follow' }), null);
}

// 6. Clé d'un overlay : le dernier segment de l'adresse, rien pour une autre page.
{
  assert.equal(cleDOverlay('https://streamelements.com/overlay/abc123/clef-secrete'), 'clef-secrete');
  assert.equal(cleDOverlay('https://streamelements.com/overlay/abc123/clef-secrete?muted=1'), 'clef-secrete');
  assert.equal(cleDOverlay('file:///D:/Stream/OBS/overlays/latshow/pause.html'), null);
  assert.equal(cleDOverlay(undefined), null);
}

// 7. Identifiants d'une activité : les siens sans doublon, plus une empreinte datée ; le même don vu en direct sans _id
//    et en rattrapage avec _id partage l'empreinte (il ne s'additionne pas deux fois) ; deux dons différents, non.
{
  const don = activite('tip', 'twitch', { username: 'Nina', amount: 5, currency: 'EUR' });
  const ids = idsDeActivite({ ...don, activityId: 'a1' }, soutienDeActivite(don));
  assert.deepEqual(ids, ['a1', 'tip|twitch|Nina|5|2026-11-19T12:52:13.078Z']);
  const direct = { ...don, _id: undefined };
  const empreinte = (a) => idsDeActivite(a, soutienDeActivite(a)).at(-1);
  assert.equal(empreinte(direct), empreinte(don));
  const autre = activite('tip', 'twitch', { username: 'Nina', amount: 5, currency: 'EUR' }, '2026-11-19T13:10:00.000Z');
  assert.notEqual(empreinte(autre), empreinte(don));
  assert.deepEqual(idsDeActivite({ type: 'tip' }, soutienDeActivite(don)), []);
}

console.log('soutiens (StreamElements) : 7 scénarios OK');
