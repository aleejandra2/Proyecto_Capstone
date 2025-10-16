﻿// static/LevelUp/js/play_hud.js
(function(){
  function qs(s, r){ return (r||document).querySelector(s); }
  function qsa(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }

  function initAvatarHUD(){
    const AV = window.GAME_AVATAR || {};
    const img = qs('#hudAvatarImg');
    if (img) img.src = AV.img || '';
    const lvl = qs('#hudLevel'); if (lvl) lvl.textContent = AV.nivel ?? 1;
    const xp  = qs('#hudXP');    if (xp)  xp.textContent  = AV.xp ?? 0;

    // accesorios visuales en capas (mapeo similar a core.js)
    const equip = AV.equip || {};
    const map = { cara: 'hudLayerCara', cabeza: 'hudLayerCabeza', espalda: 'hudLayerEspalda' };
    Object.entries(map).forEach(([slot, id])=>{
      const layer = qs('#'+id);
      const slug = (equip[slot] || '').trim();
      if (layer) layer.className = 'lv-layer ' + (slug ? ('lv-accessorio-' + slug) : '');
    });
  }

  function startTimer(seconds){
    const el = qs('#hudTime');
    let t = parseInt(seconds || '90', 10) || 90;
    if (el) el.textContent = t + 's';
    const it = setInterval(()=>{
      t--; if (el) el.textContent = Math.max(0, t) + 's';
      if (t <= 0) clearInterval(it);
    }, 1000);
  }

  function updateProgress(){
    const hosts = qsa('.game-host');
    const total = hosts.length || 1;
    let done = 0;
    hosts.forEach(h => { if (h.dataset.gameComplete === '1') done++; });
    const pct = Math.round((done/total) * 100);
    const bar = qs('#play-progress');
    if (bar) bar.style.width = pct + '%';
  }

  function addCoins(n){
    const el = qs('#hudCoins');
    if (!el) return; 
    const cur = parseInt(el.textContent || '0', 10) || 0;
    el.textContent = cur + (n||0);
  }

  function addStreak(){
    const el = qs('#hudStreak');
    if (!el) return 0;
    const cur = parseInt(el.textContent || '0', 10) || 0;
    const next = cur + 1; el.textContent = next;
    return next;
  }

  function confettiBoom(){
    // Simple confeti con emojis sin dependencias
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);
    const EMOJIS = ['ðŸŽ‰','âœ¨','ðŸŽˆ','ðŸª™','â­','ðŸ”¥'];
    const N = 30;
    for (let i=0;i<N;i++){
      const span = document.createElement('span');
      span.className = 'confetti';
      span.textContent = EMOJIS[Math.floor(Math.random()*EMOJIS.length)];
      const left = Math.random()*100; // vw
      const dx = (Math.random()*60 - 30) + 'vw';
      span.style.left = left + 'vw';
      span.style.setProperty('--dx', dx);
      span.style.animationDelay = (Math.random()*0.6)+'s';
      container.appendChild(span);
    }
    setTimeout(()=>{ container.remove(); }, 3000);
  }

  function markComplete(host){
    if (!host || host.dataset.gameComplete === '1') return;
    host.dataset.gameComplete = '1';
    addCoins(5);
    const streak = addStreak();
    updateProgress();
    if (streak >= 2) confettiBoom();

    // Si existe checkbox/hidden para este item, mÃ¡rcalos
    const itemId = host.dataset.item;
    if (itemId) {
      const chk = document.getElementById('done_' + itemId);
      const hid = document.getElementById('hidden_done_' + itemId);
      if (chk) chk.checked = true;
      if (hid) hid.value = 'true';
    }
  }

  function watchHosts(){
    const hosts = qsa('.game-host');
    const observer = new MutationObserver((mutations)=>{
      // si aparece un .alert-success dentro del host => completado
      mutations.forEach(m => {
        const host = m.target.closest ? m.target.closest('.game-host') : null;
        if (!host) return;
        if (host.querySelector('.alert-success')) markComplete(host);
      });
    });
    hosts.forEach(h => {
      observer.observe(h, { childList: true, subtree: true });
    });

    // fallback: si los juegos marcan data-game-complete, actualizamos
    setInterval(updateProgress, 800);
  }

  function init(){
    initAvatarHUD();
    startTimer(90);
    watchHosts();
    updateProgress();

    // Si no hay ningÃºn host, monta uno de DEMO para visualizar el look&feel
    const container = document.querySelector('.card.p-3');
    if (container && document.querySelectorAll('.game-host').length === 0) {
      const cfgId = 'gamecfg_demo_autogen';
      const script = document.createElement('script');
      script.type = 'application/json';
      script.id = cfgId;
      script.textContent = JSON.stringify({ kind: 'trivia', text: 'Â¿Capital de Chile? | ValparaÃ­so | Santiago* | ConcepciÃ³n\n2 + 2 = ? | 3 | 4* | 5' });
      const host = document.createElement('div');
      host.className = 'game-host my-2';
      host.dataset.actividad = '0';
      host.dataset.item = '0';
      host.dataset.kind = 'trivia';
      host.dataset.configId = cfgId;
      host.innerHTML = '<div class="game-skeleton">Cargando minijuegoâ€¦</div>';
      container.appendChild(script);
      container.appendChild(host);
    }

    // Envío: antes de enviar el form existente, inyecta campos hidden
    const form = document.getElementById('play-form') || document.querySelector('form');
    form?.addEventListener('submit', (e) => {
      // Por cada host, enviar completado, score y conteos// Por cada host, enviar completado, score y conteos
      document.querySelectorAll('.game-host').forEach(h => {
        const id = h.dataset.item; if (!id) return;
        // completado
        let done = (h.dataset.gameComplete === '1');
        const chk = document.getElementById('hidden_done_'+id);
        if (chk && chk.value) done = (chk.value === 'true');
        let node = form.querySelector(`[name="item_${id}_completado"]`);
        if (!node) { node = document.createElement('input'); node.type='hidden'; node.name=`item_${id}_completado`; form.appendChild(node); }
        node.value = done ? 'true' : 'false';
        // score
        const score = Math.max(0, Math.min(1, parseFloat(h.dataset.gameScore || '0') || (done?1:0)));
        let s = form.querySelector(`[name="item_${id}_score"]`);
        if (!s) { s = document.createElement('input'); s.type='hidden'; s.name=`item_${id}_score`; form.appendChild(s); }
        s.value = String(score);
        // correctas/total
        const corr = parseInt(h.dataset.gameCorrect || '0', 10) || 0;
        const tot  = parseInt(h.dataset.gameTotal   || '0', 10) || 0;
        let c = form.querySelector(`[name="item_${id}_correctas"]`);
        if (!c) { c = document.createElement('input'); c.type='hidden'; c.name=`item_${id}_correctas`; form.appendChild(c); }
        c.value = String(corr);
        let t = form.querySelector(`[name="item_${id}_total"]`);
        if (!t) { t = document.createElement('input'); t.type='hidden'; t.name=`item_${id}_total`; form.appendChild(t); }
        t.value = String(tot);
        // kind y detalle (para resultados enriquecidos)
        let k = form.querySelector(`[name="item_${id}_kind"]`);
        if (!k) { k = document.createElement('input'); k.type='hidden'; k.name=`item_${id}_kind`; form.appendChild(k); }
        k.value = h.dataset.kind || '';
        const det = h.dataset.gameDetail || '';
        if (det) {
          let d = form.querySelector(`[name="item_${id}_detail"]`);
          if (!d) { d = document.createElement('input'); d.type='hidden'; d.name=`item_${id}_detail`; form.appendChild(d); }
          d.value = det;
        }
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

