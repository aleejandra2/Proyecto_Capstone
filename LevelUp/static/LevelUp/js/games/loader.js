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
  if (!c.pairs && !c.trivia && c.text) {
    if (kind === 'trivia') {
      const t = parseTrivia(c.text);
      if (t.length) c.trivia = t;
    } else {
      const p = parsePairs(c.text);
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
    const cfgNorm = normalize(kind, cfg);
    const rendered = await mod.default(host, cfgNorm);

    if (!rendered && !host.querySelector('[data-game-rendered]')) {
      host.innerHTML = `<div class="alert alert-warning">No hay datos suficientes para el juego <b>${kind}</b>.</div>`;
    }
  } catch (err) {
    console.error('[games/loader] error', err);
    host.innerHTML = `<div class="alert alert-danger">No se pudo cargar el juego (${kind}).</div>`;
  }
}

document.querySelectorAll('.game-host').forEach(initHost);