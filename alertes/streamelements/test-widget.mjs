// Test sans dépendance de widget.js (mêmes fichiers pour latshow et linedev) : node test-widget.mjs
// Faux DOM minimal + horloge simulée : file d'attente, aucune alerte perdue, « passer », cadeaux groupés, textes, devise.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const ICI = new URL('.', import.meta.url);

function environnement() {
  let maintenant = 0;
  const minuteurs = [];
  const avancer = (ms) => {
    const fin = maintenant + ms;
    for (;;) {
      minuteurs.sort((a, b) => a.t - b.t);
      const m = minuteurs[0];
      if (!m || m.t > fin) break;
      minuteurs.shift();
      maintenant = m.t;
      m.f();
    }
    maintenant = fin;
  };
  const elements = {};
  const element = (id) => elements[id] ??= {
    id, textContent: '', hidden: true, offsetWidth: 0,
    classes: new Set(), proprietes: {},
    classList: {
      add(...c) { c.forEach((x) => elements[id].classes.add(x)); },
      remove(...c) { c.forEach((x) => elements[id].classes.delete(x)); },
      toggle(c, v) { if (v) elements[id].classes.add(c); else elements[id].classes.delete(c); },
      replace(a, b) { if (!elements[id].classes.delete(a)) return false; elements[id].classes.add(b); return true; },
      [Symbol.iterator]() { return elements[id].classes.values(); },
    },
    style: { setProperty(k, v) { elements[id].proprietes[k] = v; } },
    enfants: [],
    appendChild(e) { elements[id].enfants.push(e); return e; },
    set innerHTML(_) { throw new Error('innerHTML interdit'); },
  };
  // v2 : lettres animées et gerbe de losanges créent des éléments (jamais d'innerHTML)
  const creer = () => ({ className: '', textContent: '', style: { setProperty() {} } });
  const ecouteurs = {};
  const affichees = [];
  const soutiens = []; // ce que le widget envoie au service local des soutiens (obs/soutiens.mjs)
  const contexte = {
    console, Intl, Promise, Number, String, Math, Boolean, Error, JSON, Array,
    fetch: (url, options) => { soutiens.push({ url, ...JSON.parse(options.body) }); return Promise.resolve(); },
    setTimeout: (f, ms = 0) => { minuteurs.push({ t: maintenant + ms, f }); return minuteurs.length; },
    clearTimeout: () => {},
    document: { getElementById: element, documentElement: element('racine'), createElement: creer, querySelector: () => null },
    window: { addEventListener: (nom, f) => { ecouteurs[nom] = f; } },
    Audio: class { constructor(url) { this.url = url; } play() { return Promise.resolve(); } },
  };
  vm.createContext(contexte);
  vm.runInContext(fs.readFileSync(new URL('latshow/widget.js', ICI), 'utf8'), contexte);
  const ancienRemplir = vm.runInContext('remplir', contexte);
  // Espaces insécables du format monétaire (U+00A0 sous Node, U+202F sous Chrome) ramenées à une espace simple.
  contexte.__noter = (a) => affichees.push(`${a.type}|${a.nom}|${a.detail}|${a.message || ''}`.replace(/[  ]/g, ' '));
  vm.runInContext('const __r = remplir; remplir = (a) => { __noter(a); __r(a); };', contexte);
  assert.ok(ancienRemplir);
  const charger = (fieldData = {}, provider = 'twitch', session) => ecouteurs.onWidgetLoad({ detail: { fieldData, channel: { provider }, currency: { code: 'EUR' }, session } });
  const envoyer = (listener, event = {}) => ecouteurs.onEventReceived({ detail: { listener, event } });
  return { avancer, charger, envoyer, affichees, element, soutiens };
}

const vider = async (env, ms) => { for (let i = 0; i < ms / 50; i++) { env.avancer(50); await new Promise((r) => setImmediate(r)); } };

// 1. Twitch : file d'attente dans l'ordre, une à la fois, aucune perdue ; cadeaux groupés annoncés une seule fois.
{
  const env = environnement();
  env.charger({ duree: 3, entre: 0.5, filtrer: false }, 'twitch');
  env.envoyer('follower-latest', { name: 'voituresballon' });
  env.envoyer('subscriber-latest', { name: 'Stifious', amount: 3, tier: '2000', message: 'Trois mois' });
  env.envoyer('subscriber-latest', { name: 'FyzDesign', sender: 'FyzDesign', amount: 5, bulkGifted: true });
  for (let i = 0; i < 5; i++) env.envoyer('subscriber-latest', { name: `Recu${i}`, sender: 'FyzDesign', gifted: true, isCommunityGift: true });
  env.envoyer('tip-latest', { name: 'Fyz', amount: 5, message: '<script>alert(1)</script>' });
  env.envoyer('cheer-latest', { name: 'Fan', amount: 500, message: 'Cheer500 Bien joué' });
  env.envoyer('raid-latest', { name: 'Rats', amount: 42 });
  env.envoyer('host-latest', { name: 'Ignoré', amount: 3 });
  await vider(env, 1000);
  assert.equal(env.affichees.length, 1, 'une seule alerte à la fois');
  await vider(env, 40000);
  assert.deepEqual(env.affichees, [
    'Follow|voituresballon|te suit|',
    'Abonnement|Stifious|s’abonne · 3 mois · niveau 2|Trois mois',
    'Abonnements offerts|FyzDesign|offre 5 abonnements|',
    'Don|Fyz|: 5,00 €|<script>alert(1)</script>',
    'Bits|Fan|: 500 bits|Bien joué',
    'Raid|Rats|arrive avec 42 personnes|',
  ]);
  assert.equal(env.element('message').textContent, '', 'message vidé après une alerte sans message');
}

// 2. « Passer » (event:skip) abrège l'alerte en cours sans perdre la suivante.
{
  const env = environnement();
  env.charger({ duree: 20, entre: 0, filtrer: false }, 'twitch');
  env.envoyer('follower-latest', { name: 'Un' });
  env.envoyer('follower-latest', { name: 'Deux' });
  await vider(env, 500);
  env.envoyer('event:skip');
  await vider(env, 1000);
  assert.deepEqual(env.affichees.map((a) => a.split('|')[1]), ['Un', 'Deux']);
}

// 3. YouTube : abonné, membre, Super Chat ; abonnement offert simple ; message tronqué sur un mot entier.
{
  const env = environnement();
  env.charger({ duree: 3, entre: 0, filtrer: false, messageMax: 40, plateforme: 'youtube' }, 'twitch');
  env.envoyer('subscriber-latest', { name: 'Marie' });
  env.envoyer('sponsor-latest', { name: 'Marie', amount: 2 });
  env.envoyer('superchat-latest', { name: 'Marie', amount: 10, message: 'Un message bien trop long pour tenir dans la limite fixée ici' });
  await vider(env, 20000);
  assert.deepEqual(env.affichees, [
    'Abonné|Marie|s’abonne à la chaîne|',
    'Membre|Marie|devient membre · 2 mois|',
    'Super Chat|Marie|: 10,00 €|Un message bien trop long pour tenir…',
  ]);
}

// 4. Twitch : abonnement offert à une personne, pseudo trop long coupé, raid sans nombre, minimum de don respecté.
{
  const env = environnement();
  env.charger({ duree: 3, entre: 0, filtrer: false, donMin: 2, raidMin: 0 }, 'twitch');
  env.envoyer('subscriber-latest', { name: 'Nouveau', sender: 'Stifious', gifted: true });
  env.envoyer('follower-latest', { name: 'UnPseudoVraimentTresTresLongDeTwitch' });
  env.envoyer('tip-latest', { name: 'Petit', amount: 1 });
  env.envoyer('raid-latest', { name: 'Rats', amount: 0 });
  await vider(env, 20000);
  assert.deepEqual(env.affichees, [
    'Abonnement offert|Stifious|offre un abonnement à Nouveau|',
    'Follow|UnPseudoVraimentTresTres…|te suit|',
    'Raid|Rats|arrive en raid|',
  ]);
}

// 5. Bouton « Tester toutes les alertes » (forme event:test et forme widget-button).
{
  const env = environnement();
  env.charger({ duree: 3, entre: 0, filtrer: false }, 'twitch');
  env.envoyer('event:test', { listener: 'widget-button', field: 'tester', value: 'tester' });
  await vider(env, 40000);
  assert.equal(env.affichees.length, 6);
  const yt = environnement();
  yt.charger({ duree: 3, entre: 0, filtrer: false, plateforme: 'youtube' });
  yt.envoyer('widget-button', { field: 'tester' });
  await vider(yt, 40000);
  assert.equal(yt.affichees.length, 4);
}

// 6. Soutiens du live : chaque follow, abonnement ou don part vers le service local ; l'abonnement offert compte pour
//    celui qui l'offre ; les alertes de test et les raids ne comptent pas ; la session est envoyée au chargement.
{
  const env = environnement();
  const session = { data: { 'follower-recent': [{ name: 'Ancien', createdAt: '2026-10-09T20:00:00Z' }], 'tip-recent': [{ name: 'Donneur', amount: 3, createdAt: '2026-10-09T20:01:00Z' }] } };
  env.charger({ duree: 3, entre: 0, filtrer: false }, 'twitch', session);
  env.envoyer('follower-latest', { name: 'Kev' });
  env.envoyer('subscriber-latest', { name: 'Recu', sender: 'Genereux', gifted: true });
  env.envoyer('cheer-latest', { name: 'Fan', amount: 500 });
  env.envoyer('follower-latest', { name: 'Essai', isTest: true });
  env.envoyer('raid-latest', { name: 'Rats', amount: 42 });
  assert.equal(env.soutiens[0].url, 'http://127.0.0.1:21310/soutien');
  assert.deepEqual(env.soutiens.map(({ url, ...m }) => m), [
    { type: 'session', plateforme: 'twitch', liste: [
      { genre: 'follow', nom: 'Ancien', plateforme: 'twitch', quand: '2026-10-09T20:00:00Z' },
      { genre: 'don', nom: 'Donneur', montant: 3, devise: 'EUR', plateforme: 'twitch', quand: '2026-10-09T20:01:00Z' },
    ] },
    { type: 'soutien', plateforme: 'twitch', genre: 'follow', nom: 'Kev' },
    { type: 'soutien', plateforme: 'twitch', genre: 'abonnement', nom: 'Genereux' },
    { type: 'soutien', plateforme: 'twitch', genre: 'don', nom: 'Fan', montant: 500, devise: 'BITS' },
  ]);
  const yt = environnement();
  yt.charger({ plateforme: 'youtube' });
  yt.envoyer('subscriber-latest', { name: 'Marie' });
  yt.envoyer('sponsor-latest', { name: 'Paul', amount: 1 });
  assert.deepEqual(yt.soutiens.map((m) => `${m.plateforme}|${m.genre}|${m.nom}`), ['youtube|follow|Marie', 'youtube|abonnement|Paul']);
}

console.log('widget.js : 6 scénarios OK');
