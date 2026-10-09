// Chat des lives : la page dock.html de Social Stream Ninja, réglée pour être sobre (demande du client, 2026-10-09 :
// « un chat clean avec la bonne typo », moins gros). Utilisé par obs/generer.mjs pour les sources « Chat ».
// L'adresse vient de la référence (elle porte la session du client : ne jamais l'afficher) ; on y garde tout (voix,
// filtres) sauf ce qui abîmait le rendu, et la police de la marque s'ajoute.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const POLICES = { latshow: 'Inter', linedev: 'JetBrains Mono' };
// rtl : texte écrit de droite à gauche (« :pseudo ? message ») ; scale : la taille vient du CSS ; chroma : fond gris.
const RETIRES = ['rtl', 'scale', 'chroma'];
// Pas de « : » après le pseudo, pas de barre de boutons, pas d'ombre ni de contour sur le texte.
const AJOUTES = ['nocolon', 'nomenu', 'hideshadow'];

/** L'adresse du chat pour une marque, réglages d'origine conservés (session, voix, filtres). */
export function adresseChat(brute, marque) {
  const u = new URL(brute);
  for (const k of RETIRES) u.searchParams.delete(k);
  for (const k of AJOUTES) u.searchParams.set(k, '');
  u.searchParams.set('googlefont', POLICES[marque]);
  u.searchParams.set('font', POLICES[marque]);
  return u.toString().replace(/=(?=&|$)/g, ''); // les options sans valeur, comme dans l'adresse d'origine
}

/** Le CSS du chat d'une marque (obs/chat-<marque>.css), à poser dans le champ CSS de la source OBS. */
export const cssChat = (marque) => fs.readFileSync(path.join(ICI, `chat-${marque}.css`), 'utf8');
