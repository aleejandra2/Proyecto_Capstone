// Memoria (parejas) con puntaje parcial y soporte de imÃ¡genes
export default async function initMemory(host, cfg = {}) {
  const pairs = normalizePairs(cfg);
  if (!pairs.length) {
    host.innerHTML = `<div class="alert alert-warning" data-game-rendered>No hay pares configurados.</div>`;
    return false;
  }

  host.innerHTML = '';
  const board = document.createElement('div');
  board.className = 'game-board';
  board.setAttribute('data-game-rendered','1');

  const cards = [];
  pairs.forEach(([a, b], idx) => { cards.push(makeCard(a, idx), makeCard(b, idx)); });
  shuffle(cards);
  cards.forEach(c => board.appendChild(c.el));
  host.appendChild(board);

  let open = [];
  let solved = 0; // cartas resueltas
  cards.forEach(c => c.el.addEventListener('click', () => {
    if (c.solved || c.flipped) return;
    c.flip(true);
    open.push(c);
    if (open.length === 2) {
      const [c1, c2] = open; open = [];
        const pairMatch = (c1.pair === c2.pair);
        if (pairMatch) {
        c1.solved = c2.solved = true;
        solved += 2;
        const totalPairs = cards.length / 2;
        const donePairs  = solved / 2;
        host.dataset.gameScore = String(donePairs / Math.max(1, totalPairs));
        host.dataset.gameCorrect = String(donePairs);
        host.dataset.gameTotal = String(totalPairs);
        if (solved === cards.length) {
          host.insertAdjacentHTML('beforeend', `<div class="alert alert-success mt-2">Â¡Completado!</div>`);
          host.dataset.gameComplete = '1';
        }
      } else {
        setTimeout(() => { c1.flip(false); c2.flip(false); }, 600);
      }
    }
  }));

  return true;
}

function normalizePairs(cfg) {
  if (Array.isArray(cfg.pairs) && cfg.pairs.length) {
    return cfg.pairs.map(p => Array.isArray(p) ? p : [p?.a ?? p?.left ?? p?.x ?? '', p?.b ?? p?.right ?? p?.y ?? ''])
                    .filter(([a,b]) => a && b);
  }
  if (Array.isArray(cfg.items) && cfg.items.length) {
    const out = cfg.items.map(it => {
      const left  = it.left?.texto ?? it.left ?? it.a ?? it.front ?? it.term ?? it.x ?? '';
      const right = it.right?.texto ?? it.right ?? it.b ?? it.back  ?? it.def  ?? it.y ?? '';
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

function isImgToken(s){
  const t = String(s||'').trim();
  if (/^img:\/\//i.test(t)) return t.replace(/^img:/i,'');
  if (/^https?:\/\//i.test(t) && /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(t)) return t;
  return null;
}

function makeCard(text, pair) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'game-card';
  const img = isImgToken(text);
  const back = img ? `<img src="${img}" alt="img" style="max-width:100%;max-height:100%;object-fit:contain">` : escapeHtml(text);
  el.innerHTML = `<span class="front">?</span><span class="back">${back}</span>`;
  let flipped = false; const api = {
    el, pair, solved: false,
    text: String(text || ''),
    get flipped(){ return flipped; },
    flip(on){ flipped = !!on; el.classList.toggle('flipped', flipped); }
  };
  return api;
}

function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m])); }
// eval seguro para expresiones numÃ©ricas simples
function evalNumber(s){
  if (s == null) return NaN;
  let t = String(s).trim();
  // Reemplazos comunes
  t = t.replace(/Ã—|x/gi,'*').replace(/Ã·/g,'/').replace(/,/g,'.');
  // Permitir solo dÃ­gitos, operadores bÃ¡sicos y parÃ©ntesis
  if (!/^[-+/*^(). \d]*$/.test(t)) return NaN;
  // Implementar ^ como potencia
  t = t.replace(/\^/g,'**');
  try{
    // eslint-disable-next-line no-new-func
    const val = Function(`"use strict"; return (${t || 'NaN'});`)();
    const num = Number(val);
    return Number.isFinite(num) ? num : NaN;
  }catch{ return NaN; }
}
function approxEq(a,b){
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a-b) < 1e-9;
}



function isPureNumber(s){ const t=String(s||'').trim().replace(/,/g,'.'); return /^\d+(\.\d+)?$/.test(t);} function isExpression(s){ const t=String(s||''); return /[+\-*/x\u00D7\u00F7^]/.test(t);}
