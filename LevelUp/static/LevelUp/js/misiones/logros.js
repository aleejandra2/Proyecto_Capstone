(()=>{
  const host = document.getElementById('msLogros'); if(!host) return;
  const tpl = document.getElementById('tplLogro').content.firstElementChild;
  const keys = Object.keys(localStorage).filter(k=>/^ms_.+_progress$/.test(k));
  const data = keys.map(k=>({ title: k.replace(/^ms_|_progress$/g,''), value: parseInt(localStorage.getItem(k)||'0',10)||0 }));
  if(!data.length){ host.innerHTML = '<div class="text-muted">Aún no hay logros. ¡Juega un nivel!</div>'; return; }
  data.forEach(it=>{
    const n = tpl.cloneNode(true);
    n.querySelector('.js-title').textContent = it.title.toUpperCase();
    n.querySelector('.js-desc').textContent = Progreso acumulado: %;
    host.appendChild(n);
  });
})();
