// Memoria (parejas) — tolerante a múltiples formatos de entrada
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
  pairs.forEach(([a, b], idx) => {
    cards.push(makeCard(a, idx), makeCard(b, idx));
  });
  shuffle(cards);
  cards.forEach(c => board.appendChild(c.el));
  host.appendChild(board);

  let open = [];
  let solved = 0;
  cards.forEach(c => c.el.addEventListener('click', () => {
    if (c.solved || c.flipped) return;
    c.flip(true);
    open.push(c);
    if (open.length === 2) {
      const [c1, c2] = open;
      open = [];
      if (c1.pair === c2.pair) {
        c1.solved = c2.solved = true;
        solved += 2;
        if (solved === cards.length) {
          host.insertAdjacentHTML('beforeend', `<div class="alert alert-success mt-2">¡Completado!</div>`);
        }
      } else {
        setTimeout(() => { c1.flip(false); c2.flip(false); }, 600);
      }
    }
  }));

  return true;
}

function normalizePairs(cfg) {
  // 1) Array de arrays: [["A","B"],...]
  if (Array.isArray(cfg.pairs) && cfg.pairs.length) {
    return cfg.pairs.map(p => Array.isArray(p) ? p : [p?.a ?? p?.left ?? p?.x ?? '', p?.b ?? p?.right ?? p?.y ?? ''])
                    .filter(([a,b]) => a && b);
  }

  // 2) items como objetos {left:{texto}, right:{texto}} o variantes {a,b}
  if (Array.isArray(cfg.items) && cfg.items.length) {
    const out = cfg.items.map(it => {
      const left  = it.left?.texto ?? it.left ?? it.a ?? it.front ?? it.term ?? it.x ?? '';
      const right = it.right?.texto ?? it.right ?? it.b ?? it.back  ?? it.def  ?? it.y ?? '';
      return [left, right];
    }).filter(([a,b]) => a && b);
    if (out.length) return out;
  }

  // 3) texto "A|B" por línea (builder o manual)
  const text = cfg.text || cfg.game_pairs || cfg.pairsRaw || '';
  if (typeof text === 'string') {
    return text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)
      .map(ln => ln.split('|').map(s=>s.trim()))
      .filter(p => p.length >= 2).map(p => [p[0], p[1]]);
  }

  return [];
}

function makeCard(text, pair) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'game-card';
  el.innerHTML = `<span class="front">?</span><span class="back">${escapeHtml(text)}</span>`;
  let flipped = false; const api = {
    el, pair, solved: false,
    get flipped(){ return flipped; },
    flip(on){ flipped = !!on; el.classList.toggle('flipped', flipped); }
  };
  return api;
}

function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m])); }
