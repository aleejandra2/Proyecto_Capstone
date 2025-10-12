export default async function initDragMatch(host, cfg = {}) {
  const pairs = normalizePairs(cfg);
  if (!pairs.length) {
    host.innerHTML = `<div class="alert alert-warning" data-game-rendered>No hay elementos para emparejar.</div>`;
    return false;
  }

  const left = document.createElement('div'); left.className = 'gm-col';
  const right = document.createElement('div'); right.className = 'gm-col';
  left.setAttribute('data-game-rendered','1');

  pairs.forEach(([a, b], i) => {
    const tile = document.createElement('div'); tile.className = 'gm-tile'; tile.textContent = a; tile.draggable = true; tile.dataset.id = 'l'+i;
    const slot = document.createElement('div'); slot.className = 'gm-slot'; slot.dataset.id = 'r'+i; slot.textContent = b;
    left.appendChild(tile); right.appendChild(slot);
  });

  const wrap = document.createElement('div'); wrap.className = 'gm-wrap'; wrap.append(left, right);
  host.innerHTML = ''; host.appendChild(wrap);

  wrap.addEventListener('dragstart', e => {
    if (e.target.classList.contains('gm-tile')) e.dataTransfer.setData('text/plain', e.target.dataset.id);
  });
  wrap.addEventListener('dragover', e => {
    if (e.target.classList.contains('gm-slot')) e.preventDefault();
  });
  wrap.addEventListener('drop', e => {
    const slot = e.target.closest('.gm-slot'); if (!slot) return;
    const id = e.dataTransfer.getData('text/plain');
    const tile = wrap.querySelector(`[data-id="${id}"]`);
    if (tile) slot.appendChild(tile);
  });

  return true;
}

function normalizePairs(cfg) {
  if (Array.isArray(cfg.pairs) && cfg.pairs.length) {
    return cfg.pairs.map(p => Array.isArray(p) ? p : [p?.a ?? p?.left ?? p?.x ?? '', p?.b ?? p?.right ?? p?.y ?? ''])
                    .filter(([a,b]) => a && b);
  }
  if (Array.isArray(cfg.items) && cfg.items.length) {
    const out = cfg.items.map(it => {
      const left  = it.left?.texto ?? it.left ?? it.a ?? it.term ?? it.x ?? '';
      const right = it.right?.texto ?? it.right ?? it.b ?? it.def  ?? it.y ?? '';
      return [left, right];
    }).filter(([a,b]) => a && b);
    if (out.length) return out;
  }
  const text = cfg.text || cfg.game_pairs || cfg.pairsRaw || '';
  if (typeof text === 'string') {
    return text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)
      .map(ln => ln.split('|').map(s=>s.trim()))
      .filter(p => p.length >= 2).map(p => [p[0], p[1]]);
  }
  return [];
}
