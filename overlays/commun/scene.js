/* Moteur commun des overlays.
   - met la maquette 1920x1080 à l'échelle de la source (2560x1440 dans OBS) ;
   - relit ../live.js toutes les 2 s (textes du jour écrits par le cockpit) et remplit [data-live] ;
   - compte à rebours [data-compte] (minutes : live.attente_min, 5 par défaut) et chrono [data-depuis].
   Séance choisie par l'URL : ?seance=gaming|montage|dev (posée par obs/generer.mjs). */
(function () {
  const params = new URLSearchParams(location.search);
  // Séance : ?seance=… dans l'URL, sinon la variable CSS --seance posée par le « CSS personnalisé » de la source OBS.
  function seanceCourante() {
    const css = getComputedStyle(document.documentElement).getPropertyValue('--seance').trim().replace(/["']/g, '');
    return params.get('seance') || css || document.documentElement.dataset.seance || 'gaming';
  }
  let seance = seanceCourante();
  const debut = Date.now();
  const etat = { live: {} };

  function echelle() {
    const s = document.getElementById('scene');
    if (s) s.style.transform = 'scale(' + (window.innerWidth / 1920) + ')';
  }
  window.addEventListener('resize', echelle);

  function deuxChiffres(n) { return String(n).padStart(2, '0'); }
  function minSec(ms) { const t = Math.max(0, Math.round(ms / 1000)); return deuxChiffres(Math.floor(t / 60)) + ':' + deuxChiffres(t % 60); }

  function remplir() {
    const l = etat.live;
    document.querySelectorAll('[data-live]').forEach(el => {
      const cle = el.dataset.live;
      let v = l[cle];
      if (cle === 'etape_n') v = l.etapes ? deuxChiffres(l.etape || 1) + '/' + deuxChiffres(l.etapes) : '';
      const vide = v === undefined || v === null || v === '' || v === 0;
      el.textContent = vide ? (el.dataset.defaut || '') : String(v);
      const bloc = el.closest('[data-si]');
      if (bloc) bloc.hidden = vide && !el.dataset.defaut;
    });
    document.querySelectorAll('[data-progression]').forEach(el => {
      const n = Math.max(0, Math.min(12, l.etapes || 0)), k = l.etape || 0;
      if (el.childElementCount !== n) { el.innerHTML = ''; for (let i = 0; i < n; i++) el.appendChild(document.createElement('i')); }
      [...el.children].forEach((c, i) => { c.className = i < k - 1 ? 'fait' : (i === k - 1 ? 'actif' : ''); });
      el.hidden = n === 0;
    });
    document.dispatchEvent(new CustomEvent('live', { detail: l }));
  }

  function relire() {
    const s = document.createElement('script');
    s.src = '../live.js?t=' + Date.now();
    s.onload = () => { seance = seanceCourante(); document.documentElement.dataset.seance = seance; const L = window.LIVE || {}; etat.live = L[seance] || {}; remplir(); s.remove(); };
    s.onerror = () => s.remove();
    document.head.appendChild(s);
  }

  function battre() {
    const attente = (Number(etat.live.attente_min) || 5) * 60000;
    const reste = attente - (Date.now() - debut);
    document.querySelectorAll('[data-compte]').forEach(el => { el.textContent = reste > 0 ? minSec(reste) : el.dataset.fini || '00:00'; });
    document.querySelectorAll('[data-compte-barre]').forEach(el => { el.style.transform = 'scaleX(' + Math.min(1, (Date.now() - debut) / attente) + ')'; });
    document.querySelectorAll('[data-depuis]').forEach(el => { el.textContent = minSec(Date.now() - debut); });
    document.documentElement.classList.toggle('compte-fini', reste <= 0);
  }

  document.documentElement.dataset.seance = seance;
  document.addEventListener('DOMContentLoaded', () => {
    echelle(); relire(); battre();
    setInterval(relire, 2000); setInterval(battre, 250);
    requestAnimationFrame(() => document.documentElement.classList.add('pret'));
  });
})();
