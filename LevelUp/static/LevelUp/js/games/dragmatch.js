export default async function initDragMatch(host, cfg = {}) {
  const pairs = normalizePairs(cfg);
  if (!pairs.length) {
    host.innerHTML = `<div class="alert alert-warning" data-game-rendered>No hay elementos para emparejar.</div>`;
    return false;
  }

  const left = document.createElement('div'); left.className = 'gm-col';
  const right = document.createElement('div'); right.className = 'gm-col';
  left.setAttribute('data-game-rendered','1');

  function norm(s){ return String(s||'').trim().toLowerCase(); }
  function isPureNumber(s){ const t = String(s||'').trim().replace(/,/g,'.'); return /^\d+(\.\d+)?$/.test(t); }
  function isExpression(s){ const t = String(s||''); return /[+\-*/x\u00D7\u00F7^]/.test(t); }
  function evalNumber(s){
    if (s == null) return NaN;
    let t = String(s).trim().replace(/[\u00D7x]/gi,'*').replace(/[\u00F7]/g,'/').replace(/,/g,'.');
    if (!/^[-+/*^(). \d]*$/.test(t)) return NaN;
    t = t.replace(/\^/g,'**');
    try { const v = Function(`"use strict"; return (${t||'NaN'});`)(); const n = Number(v); return Number.isFinite(n) ? n : NaN; } catch { return NaN; }
  }
  function valueKey(s){
    const expr = isExpression(s), num = isPureNumber(s);
    if (expr || num){ const v = evalNumber(s); if (Number.isFinite(v)) return 'num:'+v; }
    return 'txt:'+norm(s);
  }
  // índices desordenados para aleatorizar columnas
  const idx = pairs.map((_,i)=>i);
  const idxL = shuffle(idx.slice());
  const idxR = shuffle(idx.slice());
  idxL.forEach(i => {
    const a = pairs[i][0];
    const tile = document.createElement('div'); tile.className = 'gm-tile'; tile.textContent = a; tile.draggable = true; tile.dataset.id = 'l'+i; tile.dataset.val = valueKey(a);
    left.appendChild(tile);
  });
  idxR.forEach(i => {
    const b = pairs[i][1];
    const slot = document.createElement('div'); slot.className = 'gm-slot'; slot.dataset.id = 'r'+i; slot.textContent = b; slot.dataset.val = valueKey(b);
    right.appendChild(slot);
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
    // highlight slot filled
    slot.classList.add('gm-slot-filled');
    // Si todas las fichas fueron colocadas en algún slot, marcar completado
    const total = pairs.length;
    const host = wrap.closest('.game-host');
    // calcular score por equivalencia de texto (soporta repetidos "5")
    let correct = 0;
    let detail = [];
    for (let i=0;i<total;i++){
      const s = wrap.querySelector(`.gm-slot[data-id="r${i}"]`);
      const t = s && s.querySelector('.gm-tile');
      if (t && t.dataset.val === s.dataset.val) correct++;
    }
    // construir detalle de pares asignados
    for (let i=0;i<total;i++){
      const s = wrap.querySelector(`.gm-slot[data-id="r${i}"]`);
      const t = s && s.querySelector('.gm-tile');
      if (t) {
        const ok = (t.dataset.val === s.dataset.val);
        detail.push({ left: t.textContent, right: s.textContent, ok });
      } else {
        detail.push({ left: null, right: s.textContent, ok: false });
      }
    }
    if (host) {
      host.dataset.gameScore = String(correct/Math.max(1,total));
      host.dataset.gameCorrect = String(correct);
      host.dataset.gameTotal = String(total);
      try { host.dataset.gameDetail = JSON.stringify({ map: detail }); } catch {}
      if (correct === total) host.dataset.gameComplete = '1';
    }
  });

  function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }

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
