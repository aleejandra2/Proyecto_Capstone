console.info('[games/loader] módulo cargado ✅');

const importMap = {
  memory: () => import('./memory.js'),
  dragmatch: () => import('./dragmatch.js'),
  trivia: () => import('./trivia.js'),
  ordering: () => import('./ordering.js'),
  ordena: () => import('./ordering.js'),
  secuencia: () => import('./ordering.js'),
  classify: () => import('./classify.js'),
  clasifica: () => import('./classify.js'),
  cloze: () => import('./cloze.js'),
  huecos: () => import('./cloze.js'),
  vf: () => import('./vf.js'),
  verdaderofalso: () => import('./vf.js'),
  truefalse: () => import('./vf.js'),
  labyrinth: () => import('./labyrinth.js'),
  laberinto: () => import('./labyrinth.js'),
  puertas: () => import('./labyrinth.js'),
  shop: () => import('./shop.js'),
  tiendita: () => import('./shop.js'),
  carrito: () => import('./shop.js'),
};

const looksLikeJSON = (s = '') => /^\s*[{[]/.test(s || '');

function readCfg(host) {
  console.group(`🔍 [readCfg] Leyendo configuración del host`);

  const cfgId = host.dataset.configId;
  const kind = (host.dataset.kind || '').toLowerCase();

  console.log('📋 Dataset del host:', {
    configId: cfgId,
    kind: kind,
    allDataset: { ...host.dataset }
  });

  const el = cfgId ? document.getElementById(cfgId) : null;

  if (el) {
    console.log('✅ Elemento config encontrado');

    if (looksLikeJSON(el.textContent)) {
      try {
        const parsed = JSON.parse(el.textContent);
        console.log('✅ JSON parseado exitosamente:', parsed);
        console.groupEnd();
        return { kind, cfg: parsed };
      } catch (err) {
        console.error('❌ Error parseando JSON:', err);
      }
    }
  } else if (cfgId) {
    console.warn('⚠️ No se encontró elemento con ID:', cfgId);
  }

  const raw = (host.dataset.raw || '').trim();

  if (raw && looksLikeJSON(raw)) {
    try {
      const parsed = JSON.parse(raw);
      console.log('✅ JSON parseado desde data-raw');
      console.groupEnd();
      return { kind, cfg: parsed };
    } catch (err) {
      console.error('❌ Error parseando data-raw:', err);
    }
  }

  console.log('⚠️ Usando fallback de texto plano');
  const result = { kind, cfg: { kind, text: raw } };
  console.groupEnd();
  return result;
}

function normalize(kind, cfg) {
  console.group('🔄 [normalize] Normalizando configuración');
  console.log('📥 Input:', { kind, cfg });

  let c = { ...(cfg || {}) };
  if (!c.kind) c.kind = kind;

  // Si venía como texto y era JSON, parsearlo
  if (typeof c.text === 'string' && looksLikeJSON(c.text)) {
    try {
      const parsed = JSON.parse(c.text);
      c = { ...c, ...parsed };
      delete c.text;
    } catch (err) {
      console.error('❌ Error parseando c.text:', err);
    }
  }

  console.log('📤 Output normalizado:', c);
  console.groupEnd();
  return c;
}

function ensureDemo(kind, cfg) {
  console.group('🎮 [ensureDemo] Validando datos para:', kind);
  console.log('📥 Config recibida:', cfg);

  const c = { ...(cfg || {}) };
  let isValid = false;

  // Validación específica por tipo
  switch (kind) {
    case 'trivia':
      // Puede tener 'questions' o 'trivia'
      const hasQuestions = Array.isArray(c.questions) && c.questions.length > 0;
      const hasTrivia = Array.isArray(c.trivia) && c.trivia.length > 0;

      console.log('🔍 Trivia validation:', { hasQuestions, hasTrivia });

      if (hasQuestions || hasTrivia) {
        isValid = true;
        // Normalizar: siempre usar 'trivia'
        if (hasQuestions && !hasTrivia) {
          console.log('✅ Copiando questions → trivia');
          c.trivia = c.questions;
        }
      }

      if (!isValid) {
        console.warn('⚠️ No hay preguntas, usando demo');
        c.trivia = [
          { q: '¿Capital de Chile?', opts: ['Valparaíso', 'Santiago', 'Concepción'], ans: 1 },
          { q: '2 + 2 = ?', opts: ['3', '4', '5'], ans: 1 },
        ];
        isValid = true;
      }
      break;

    case 'memory':
    case 'dragmatch':
      isValid = Array.isArray(c.pairs) && c.pairs.length >= 2;
      console.log('🔍 Memory/DragMatch validation:', { hasPairs: isValid, count: c.pairs?.length });

      if (!isValid) {
        console.warn('⚠️ Insuficientes pairs (necesita ≥2), usando demo');
        c.pairs = [['Perro', 'Animal'], ['2+3', '5'], ['Sol', 'Estrella']];
        isValid = true;
      }
      break;

    case 'ordering':
      isValid = (Array.isArray(c.items) && c.items.length > 0 &&
        Array.isArray(c.correct_order) && c.correct_order.length > 0);
      console.log('🔍 Ordering validation:', {
        hasItems: Array.isArray(c.items),
        hasOrder: Array.isArray(c.correct_order),
        itemsCount: c.items?.length,
        orderCount: c.correct_order?.length
      });

      if (!isValid) {
        console.warn('⚠️ Datos incompletos, usando demo');
        c.items = [
          { id: 'i1', text: 'Observación' },
          { id: 'i2', text: 'Hipótesis' },
          { id: 'i3', text: 'Experimentación' },
          { id: 'i4', text: 'Conclusión' }
        ];
        c.correct_order = ['i1', 'i2', 'i3', 'i4'];
        isValid = true;
      }
      break;

    case 'classify':
      isValid = (Array.isArray(c.bins) && c.bins.length > 0 &&
        Array.isArray(c.items) && c.items.length > 0 &&
        c.answers && typeof c.answers === 'object');
      console.log('🔍 Classify validation:', {
        hasBins: Array.isArray(c.bins),
        hasItems: Array.isArray(c.items),
        hasAnswers: !!c.answers,
        binsCount: c.bins?.length,
        itemsCount: c.items?.length
      });

      if (!isValid) {
        console.warn('⚠️ Datos incompletos, usando demo');
        c.bins = [{ id: 'b1', label: 'Vertebrados' }, { id: 'b2', label: 'Invertebrados' }];
        c.items = [{ id: 'a1', text: 'Gato' }, { id: 'a2', text: 'Pulpo' }];
        c.answers = { a1: 'b1', a2: 'b2' };
        isValid = true;
      }
      break;

    case 'cloze':
      isValid = (c.text && typeof c.text === 'string' &&
        c.blanks && typeof c.blanks === 'object' &&
        Object.keys(c.blanks).length > 0);
      console.log('🔍 Cloze validation:', {
        hasText: !!c.text,
        hasBlanks: !!c.blanks,
        blanksCount: c.blanks ? Object.keys(c.blanks).length : 0
      });

      if (!isValid) {
        console.warn('⚠️ Datos incompletos, usando demo');
        c.text = 'La capital de [[1]] es [[2]].';
        c.blanks = {
          '1': { options: ['Chile', 'Perú', 'Argentina'], answer: 'Chile' },
          '2': { options: ['Santiago', 'Lima', 'Buenos Aires'], answer: 'Santiago' }
        };
        isValid = true;
      }
      break;

    case 'vf':
    case 'verdaderofalso':
    case 'truefalse':
      isValid = Array.isArray(c.items) && c.items.length > 0;
      console.log('🔍 V/F validation:', { hasItems: isValid, count: c.items?.length });

      // Normalizar: is_true → answer
      if (isValid && c.items.length > 0) {
        c.items = c.items.map(item => ({
          text: item.text,
          answer: item.answer || (item.is_true ? 'V' : 'F')
        }));
      }

      if (!isValid) {
        console.warn('⚠️ No hay ítems, usando demo');
        c.items = [
          { text: 'Los pingüinos son aves.', answer: 'V' },
          { text: 'El número 7 es par.', answer: 'F' }
        ];
        isValid = true;
      }
      break;

    case 'labyrinth':
    case 'laberinto':
      isValid = Array.isArray(c.steps) && c.steps.length > 0;
      console.log('🔍 Labyrinth validation:', { hasSteps: isValid, count: c.steps?.length });

      if (!isValid) {
        console.warn('⚠️ No hay pasos, usando demo');
        c.steps = [
          { q: '3 × 4 = ?', opts: ['7', '12', '14'], ans: 1 },
          { q: "Antónimo de 'frío'", opts: ['Helado', 'Caliente', 'Húmedo'], ans: 1 }
        ];
        isValid = true;
      }
      break;

    case 'shop':
    case 'tiendita':
      isValid = Array.isArray(c.products) && c.products.length > 0;
      console.log('🔍 Shop validation:', { hasProducts: isValid, count: c.products?.length });

      if (!isValid) {
        console.warn('⚠️ No hay productos, usando demo');
        c.currency = c.currency || '$';
        c.cash = (typeof c.cash === 'number') ? c.cash : 1000;
        c.products = [
          { id: 'p1', name: 'Cuaderno', price: 299.9 },
          { id: 'p2', name: 'Lápiz', price: 120.0 }
        ];
        isValid = true;
      }
      break;

    default:
      console.warn('⚠️ Tipo de juego desconocido:', kind);
      isValid = false;
  }

  console.log(isValid ? '✅ Validación exitosa' : '❌ Validación fallida');
  console.log('📤 Output final:', c);
  console.groupEnd();
  return c;
}

async function initHost(host) {
  console.group(`🎯 [initHost] Inicializando host`);

  const { kind, cfg } = readCfg(host);

  console.log('📦 Config leída:', { kind, cfg });

  try {
    const loader = importMap[kind];

    if (!loader) {
      throw new Error(`Tipo de juego no soportado: ${kind || '(vacío)'}`);
    }

    console.log('⏳ Cargando módulo para:', kind);
    const mod = await loader();

    let cfgNorm = normalize(kind, cfg);
    cfgNorm = ensureDemo(kind, cfgNorm);

    const fn = mod.default || mod.init;

    if (!fn) {
      throw new Error('Módulo sin función de inicialización');
    }

    console.log('🚀 Ejecutando función de inicialización...');
    const rendered = await fn(host, cfgNorm);

    if (rendered || host.querySelector('[data-game-rendered]')) {
      console.log('✅ Juego renderizado correctamente');
    } else {
      console.warn('⚠️ No se detectó renderizado');
    }

  } catch (err) {
    console.error('❌ ERROR:', err);
    host.innerHTML = `<div class="alert alert-danger">
      <strong>Error:</strong> ${err.message}
    </div>`;
  }

  console.groupEnd();
}

// Inicializar todos los hosts existentes
console.log('🔍 Buscando .game-host...');
const hosts = document.querySelectorAll('.game-host');
console.log(`✅ Encontrados ${hosts.length} hosts`);

hosts.forEach((host, idx) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎮 HOST ${idx + 1}/${hosts.length}`);
  console.log(`${'='.repeat(60)}`);
  initHost(host);
});

// Observer para hosts dinámicos
new MutationObserver(ms => {
  ms.forEach(m => m.addedNodes && m.addedNodes.forEach(n => {
    if (!(n instanceof HTMLElement)) return;
    if (n.classList?.contains('game-host')) initHost(n);
    n.querySelectorAll?.('.game-host').forEach(initHost);
  }));
}).observe(document.documentElement || document.body, { childList: true, subtree: true });