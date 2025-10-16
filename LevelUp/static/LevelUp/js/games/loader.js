console.info('[games/loader] módulo cargado ✅');

const importMap = {
  memory:    () => import('./memory.js'),
  dragmatch: () => import('./dragmatch.js'),
  trivia:    () => import('./trivia.js'),
};

function readCfg(host) {
  const cfgId = host.dataset.configId;
  const kind  = (host.dataset.kind || '').toLowerCase();
  const el    = cfgId ? document.getElementById(cfgId) : null;
  let cfg = {};
  try { cfg = el ? JSON.parse(el.textContent) : {}; } catch { cfg = {}; }
  // Fallback: si no hay <script>, intenta desde data-raw
  if ((!cfg || Object.keys(cfg).length === 0) && host.dataset.raw) {
    const raw = host.dataset.raw || '';
    if (raw.trim()) {
      if (kind === 'trivia') cfg = { kind, text: raw };
      else cfg = { kind, text: raw };
    }
  }
  console.debug('[games/loader] cfg', { kind, cfgId, cfg });
  return { kind, cfg };
}

// ---- NUEVO: normalizadores de texto plano ----
function parsePairs(text) {
  const out = [];
  (text || '').split(/\r?\n/).forEach(ln => {
    ln = (ln || '').trim();
    if (!ln) return;
    const parts = ln.split('|').map(s => s.trim());
    if (parts.length >= 2 && parts[0] && parts[1]) out.push([parts[0], parts[1]]);
  });
  return out;
}

function parseTrivia(text) {
  const out = [];
  (text || '').split(/\r?\n/).forEach(ln => {
    ln = (ln || '').trim();
    if (!ln) return;
    const parts = ln.split('|').map(s => s.trim()).filter(Boolean);
    if (parts.length < 3) return;
    const q = parts[0];
    const opts = parts.slice(1);
    let ans = 0;
    const clean = opts.map((t, i) => {
      if (/\*$/.test(t)) { ans = i; return t.replace(/\*$/, '').trim(); }
      return t;
    });
    out.push({ q, opts: clean, ans });
  });
  return out;
}

function normalize(kind, cfg) {
  const c = { ...(cfg || {}) };
  const hasPairs  = Array.isArray(c.pairs)  && c.pairs.length  > 0;
  const hasTrivia = Array.isArray(c.trivia) && c.trivia.length > 0;
  const textSrc = (c.text || c.game_pairs || '').trim();

  if (!hasPairs && !hasTrivia && textSrc) {
    if (kind === 'trivia') {
      const t = parseTrivia(textSrc);
      if (t.length) c.trivia = t;
    } else {
      const p = parsePairs(textSrc);
      if (p.length) c.pairs = p;
    }
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

    // Fallback DEMO: si no hay datos, renderiza ejemplos para visualizar
    if (kind === 'trivia' && (!cfgNorm.trivia || cfgNorm.trivia.length === 0)) {
      console.warn('[games/loader] usando demo de trivia');
      cfgNorm = { ...cfgNorm, trivia: [
        { q: '¿Capital de Chile?', opts: ['Valparaíso','Santiago','Concepción'], ans: 1 },
        { q: '2 + 2 = ?',        opts: ['3','4','5'],                          ans: 1 },
      ]};
    }
    if (kind !== 'trivia' && (!cfgNorm.pairs || cfgNorm.pairs.length === 0)) {
      console.warn('[games/loader] usando demo de pares');
      cfgNorm = { ...cfgNorm, pairs: [ ['Perro','Animal'], ['2+3','5'] ] };
    }
    const rendered = await mod.default(host, cfgNorm);

    if (!rendered && !host.querySelector('[data-game-rendered]')) {
      host.innerHTML = `<div class="alert alert-warning">No hay datos suficientes para el juego <b>${kind}</b>.</div>`;
    }
  } catch (err) {
    console.error('[games/loader] error', err);
    host.innerHTML = `<div class="alert alert-danger">No se pudo cargar el juego (${kind}).</div>`;
  }
}

// Inicializa hosts presentes
document.querySelectorAll('.game-host').forEach(initHost);

// Observa nuevos hosts agregados dinámicamente
const mo = new MutationObserver((mutations) => {
  mutations.forEach(m => {
    m.addedNodes && m.addedNodes.forEach(n => {
      if (!(n instanceof HTMLElement)) return;
      if (n.classList && n.classList.contains('game-host')) {
        initHost(n);
      }
      // si vienen envueltos
      n.querySelectorAll && n.querySelectorAll('.game-host').forEach(initHost);
    });
  });
});
mo.observe(document.documentElement || document.body, { childList: true, subtree: true });
