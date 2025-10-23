console.info('[games/loader] módulo cargado ✅');

const importMap = {
  memory:    () => import('./memory.js'),
  dragmatch: () => import('./dragmatch.js'),
  trivia:    () => import('./trivia.js'),
  ordering:  () => import('./ordering.js'),
  ordena:    () => import('./ordering.js'),
  secuencia: () => import('./ordering.js'),
  classify:  () => import('./classify.js'),
  clasifica: () => import('./classify.js'),
  cloze:     () => import('./cloze.js'),
  huecos:    () => import('./cloze.js'),
  vf:        () => import('./vf.js'),
  verdaderofalso: () => import('./vf.js'),
  truefalse: () => import('./vf.js'),
  labyrinth: () => import('./labyrinth.js'),
  laberinto: () => import('./labyrinth.js'),
  puertas:   () => import('./labyrinth.js'),
  shop:      () => import('./shop.js'),
  tiendita:  () => import('./shop.js'),
  carrito:   () => import('./shop.js'),
};

const looksLikeJSON = (s='') => /^\s*[{[]/.test(s || '');

function readCfg(host) {
  const cfgId = host.dataset.configId;
  const kind  = (host.dataset.kind || '').toLowerCase();
  const el    = cfgId ? document.getElementById(cfgId) : null;

  if (el && looksLikeJSON(el.textContent)) {
    try { return { kind, cfg: JSON.parse(el.textContent) }; } catch {}
  }
  const raw = (host.dataset.raw || '').trim();

  if (raw && looksLikeJSON(raw)) {
    try { return { kind, cfg: JSON.parse(raw) }; } catch {}
  }
  // Fallback texto plano (pairs/trivia)
  return { kind, cfg: { kind, text: raw } };
}

function parsePairs(text) {
  const out = [];
  (text || '').split(/\r?\n/).forEach(ln=>{
    ln = (ln||'').trim(); if(!ln) return;
    const p = ln.split('|').map(s=>s.trim());
    if (p.length>=2 && p[0] && p[1]) out.push([p[0], p[1]]);
  });
  return out;
}
function parseTrivia(text) {
  const out = [];
  (text || '').split(/\r?\n/).forEach(ln=>{
    ln = (ln||'').trim(); if(!ln) return;
    const parts = ln.split('|').map(s=>s.trim()).filter(Boolean);
    if (parts.length<3) return;
    const q = parts[0], opts = parts.slice(1);
    let ans = 0;
    const clean = opts.map((t,i)=> /\*$/.test(t) ? (ans=i, t.replace(/\*$/,'').trim()) : t);
    out.push({ q, opts: clean, ans });
  });
  return out;
}

function normalize(kind, cfg) {
  let c = { ...(cfg || {}) };
  if (!c.kind) c.kind = kind;

  // Si venía como texto y era JSON, parsearlo
  if (typeof c.text === 'string' && looksLikeJSON(c.text)) {
    try { c = { ...c, ...JSON.parse(c.text) }; delete c.text; } catch {}
  }

  // Fallback de texto para tipos que lo soportan
  if (typeof c.text === 'string' && c.text.trim()) {
    if (kind === 'trivia' && (!Array.isArray(c.trivia) || !c.trivia.length)) {
      const t = parseTrivia(c.text); if (t.length) c.trivia = t;
    }
    if ((kind === 'memory' || kind === 'dragmatch') && (!Array.isArray(c.pairs) || !c.pairs.length)) {
      const p = parsePairs(c.text); if (p.length) c.pairs = p;
    }
  }
  return c;
}

function ensureDemo(kind, cfg) {
  const c = { ...(cfg || {}) };
  if (kind === 'trivia' && (!c.trivia || !c.trivia.length)) {
    c.trivia = [
      { q:'¿Capital de Chile?', opts:['Valparaíso','Santiago','Concepción'], ans:1 },
      { q:'2 + 2 = ?', opts:['3','4','5'], ans:1 },
    ];
  }
  if ((kind === 'memory' || kind === 'dragmatch') && (!c.pairs || !c.pairs.length)) {
    c.pairs = [['Perro','Animal'], ['2+3','5']];
  }
  // demos mínimas para los nuevos si vinieron vacíos
  if (kind === 'ordering' && !(c.items && c.correct_order)) {
    c.items = [{id:'i1',text:'Observación'},{id:'i2',text:'Hipótesis'},{id:'i3',text:'Experimentación'},{id:'i4',text:'Conclusión'}];
    c.correct_order = ['i1','i2','i3','i4'];
  }
  if (kind === 'classify' && !(c.bins && c.items && c.answers)) {
    c.bins = [{id:'b1',label:'Vertebrados'},{id:'b2',label:'Invertebrados'}];
    c.items = [{id:'a1',text:'Gato'},{id:'a2',text:'Pulpo'},{id:'a3',text:'Águila'},{id:'a4',text:'Abeja'}];
    c.answers = {a1:'b1',a2:'b2',a3:'b1',a4:'b2'};
  }
  if (kind === 'cloze' && !(c.text && c.blanks)) {
    c.text = 'La capital de [[1]] es [[2]].';
    c.blanks = {'1':{options:['Chile','Perú','Argentina'],answer:'Chile'},'2':{options:['Santiago','Lima','Buenos Aires'],answer:'Santiago'}};
  }
  if (kind === 'vf' && !c.items) {
    c.items = [{text:'Los pingüinos son aves.',answer:'V'},{text:'El número 7 es par.',answer:'F'}];
  }
  if (kind === 'labyrinth' && !c.steps) {
    c.steps = [
      {q:'3 × 4 = ?',opts:['7','12','14'],ans:1},
      {q:"Antónimo de 'frío'",opts:['Helado','Caliente','Húmedo'],ans:1},
      {q:'¿Cuál es un vertebrado?',opts:['Pulpo','Gato','Abeja'],ans:1},
    ];
  }
  if (kind === 'shop' && !c.products) {
    c.currency = c.currency || '$';
    c.cash = (typeof c.cash === 'number') ? c.cash : 1000;
    c.products = c.products || [
      {id:'p1',name:'Cuaderno',price:299.9},
      {id:'p2',name:'Lápiz',price:120.0},
      {id:'p3',name:'Goma',price:199.5},
    ];
  }
  return c;
}

async function initHost(host) {
  const { kind, cfg } = readCfg(host);
  try {
    const loader = importMap[kind];
    if (!loader) throw new Error(`Tipo de juego no soportado: ${kind || '(vacío)'}`);
    const mod = await loader();

    let cfgNorm = normalize(kind, cfg);
    cfgNorm = ensureDemo(kind, cfgNorm);

    const fn = mod.default || mod.init;
    const rendered = fn ? await fn(host, cfgNorm) : null;

    if (!rendered && !host.querySelector('[data-game-rendered]')) {
      host.innerHTML = `<div class="alert alert-warning">No hay datos suficientes para el juego <b>${kind}</b>.</div>`;
    }
  } catch (err) {
    console.error('[games/loader] error', err);
    host.innerHTML = `<div class="alert alert-danger">No se pudo cargar el juego (${kind}).</div>`;
  }
}

document.querySelectorAll('.game-host').forEach(initHost);
new MutationObserver(ms=>{
  ms.forEach(m=>m.addedNodes && m.addedNodes.forEach(n=>{
    if (!(n instanceof HTMLElement)) return;
    if (n.classList?.contains('game-host')) initHost(n);
    n.querySelectorAll?.('.game-host').forEach(initHost);
  }));
}).observe(document.documentElement || document.body, {childList:true, subtree:true});