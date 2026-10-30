/* Bannière du jeu (image verticale) : relit ../jeu.js chaque seconde (écrit par obs/jeu.mjs) et pose
   - <html data-jeu="valorant|roblox|…"> : le gabarit du jeu (couleurs, police, logo) dans latshow/vertical.html ;
   - [data-jeu-nom], [data-jeu-detail], [data-score="moi|adv"] ; classe .avec-score quand il y a un score ;
   - classe .marque sur le chiffre qui vient de changer (petit coup d'éclat). */
(function () {
  let avant = null;
  function poser(j) {
    const racine = document.documentElement;
    racine.dataset.jeu = j.jeu || 'autre';
    racine.classList.toggle('avec-score', Boolean(j.score));
    racine.classList.toggle('sans-jeu', !j.nom);
    document.querySelectorAll('[data-jeu-nom]').forEach((el) => { el.textContent = j.nom || ''; });
    document.querySelectorAll('[data-jeu-detail]').forEach((el) => { el.textContent = j.detail || ''; el.hidden = !j.detail; });
    document.querySelectorAll('[data-score]').forEach((el) => {
      const v = j.score ? String(j.score[el.dataset.score]) : '';
      if (el.textContent === v) return;
      el.textContent = v;
      if (avant && avant.score && j.score && avant.jeu === j.jeu) {
        el.classList.remove('marque-point'); void el.offsetWidth; el.classList.add('marque-point');
      }
    });
    if (!avant || avant.jeu !== j.jeu) {
      document.querySelectorAll('[data-jeu-entree]').forEach((el) => { el.classList.remove('entree'); void el.offsetWidth; el.classList.add('entree'); });
    }
    avant = j;
  }
  function relire() {
    const s = document.createElement('script');
    s.src = '../jeu.js?t=' + Date.now();
    s.onload = () => { if (window.JEU) poser(window.JEU); s.remove(); };
    s.onerror = () => s.remove();
    document.head.appendChild(s);
  }
  document.addEventListener('DOMContentLoaded', () => { relire(); setInterval(relire, 1000); });
})();
