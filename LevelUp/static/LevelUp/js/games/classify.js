// static/LevelUp/js/games/classify.js
import { shuffle, header, playSound } from './core.js';

export default function init(host, cfg) {
  console.group('🎮 [CLASSIFY] Inicializando');
  console.log('📦 Config:', cfg);

  // Normalizar estructura
  const bins = cfg.bins || [];
  let items = cfg.items || [];
  const answers = cfg.answers || {};

  console.log('📊 Datos:', { bins: bins.length, items: items.length, answers });

  if (!bins.length || !items.length || !Object.keys(answers).length) {
    console.error('❌ Datos incompletos');
    host.innerHTML = '<div class="alert alert-warning">Faltan datos para clasificar</div>';
    console.groupEnd();
    return false;
  }

  // Reset host
  host.innerHTML = '';
  host.setAttribute('data-game-rendered', 'true');

  // Header con tiempo y barra
  const hd = header(host, 'Clasificar', cfg.timeLimit || 90);

  // Contenedor principal
  const wrap = document.createElement('div');
  wrap.className = 'classify-game';
  wrap.innerHTML = `
    <div class="classify-pool">
      <div class="classify-pool-title">
        📦 Arrastra los elementos a la categoría correcta
      </div>
      <div class="classify-items" id="classifyPool"></div>
    </div>
    <div class="classify-bins" id="classifyBins"></div>
  `;
  host.appendChild(wrap);

  const pool = wrap.querySelector('#classifyPool');
  const binsContainer = wrap.querySelector('#classifyBins');

  // Mezclar ítems
  items = shuffle([...items]);

  // Estado
  const state = {
    placed: {},   // itemDomId -> bin.id
    correct: 0
  };

  // TAP (mobile): ítem seleccionado
  let selectedItem = null;

  function clearSelectedClassifyItem() {
    if (selectedItem) {
      selectedItem.classList.remove('selected');
      selectedItem = null;
    }
  }

  function renderEndCard() {
    const total = items.length;
    const score = state.correct / total;
    const good = score >= 0.6;

    wrap.innerHTML = `
      <div style="
        text-align:center;
        padding:3rem 2rem;
        background:white;
        border-radius:24px;
        box-shadow:0 18px 60px rgba(15,23,42,0.18);
      ">
        <div style="font-size:4rem; margin-bottom:1rem;">
          ${good ? '🎉' : '😢'}
        </div>
        <h3 style="
          font-size:2.4rem;
          font-weight:900;
          color:#1f2933;
          margin-bottom:0.75rem;
        ">
          ${good ? '¡Excelente!' : 'Sigue practicando'}
        </h3>
        <p style="
          font-size:1.25rem;
          font-weight:700;
          color:${good ? '#15803d' : '#b91c1c'};
          margin-bottom:0.25rem;
        ">
          ${state.correct} de ${total} clasificados correctamente
        </p>
        <p style="font-size:1.05rem; color:#4b5563;">
          Puntuación: ${Math.round(score * 100)}%
        </p>
      </div>
    `;

    host.dataset.gameComplete = 'true';
    host.dataset.gameScore = score.toFixed(2);
    host.dataset.gameCorrect = state.correct;
    host.dataset.gameTotal = total;
  }

  // Crear bins
  bins.forEach((bin) => {
    const binEl = document.createElement('div');
    binEl.className = 'classify-bin';
    binEl.dataset.binId = bin.id;
    binEl.innerHTML = `
      <div class="classify-bin-title">
        ${bin.label || bin.title || bin.id}
      </div>
      <div class="classify-bin-items" data-bin-id="${bin.id}"></div>
    `;

    const binItems = binEl.querySelector('.classify-bin-items');

    // Helper: colocar ítem en este bin (para drop y tap)
    function placeItemInBin(itemEl) {
      if (!itemEl) return;

      const itemDomId = itemEl.id;
      const total = items.length;

      // Registrar/actualizar en qué bin está
      state.placed[itemDomId] = bin.id;

      // Mover al bin
      binItems.appendChild(itemEl);

      // Quitar selección visual
      itemEl.classList.remove('selected');
      clearSelectedClassifyItem();

      // Verificar si es correcto
      const key = itemDomId.replace('item-', '');
      const correctBin = answers[key] || answers[itemDomId];

      if (bin.id === correctBin) {
        itemEl.style.background = 'linear-gradient(135deg, #51CF66, #8ce99a)';
        itemEl.style.color = '#fff';
        playSound('success');

        // evitar sumar varias veces el mismo ítem
        if (!itemEl.dataset.countedCorrect) {
          state.correct++;
          itemEl.dataset.countedCorrect = '1';
        }
      } else {
        itemEl.style.background = 'linear-gradient(135deg, #FF6B6B, #ff8787)';
        itemEl.style.color = '#fff';
        playSound('error');

        // si antes estaba correcto y ahora no, restar
        if (itemEl.dataset.countedCorrect === '1') {
          state.correct--;
          itemEl.dataset.countedCorrect = '0';
        }
      }

      // Actualizar progreso
      const placed = Object.keys(state.placed).length;
      hd.setBar((placed / total) * 100);
      hd.bump && hd.bump();

      // Si terminó (todos ubicados en algún bin)
      if (placed === total) {
        playSound('complete');
        setTimeout(renderEndCard, 400);
      }
    }

    // Drag over
    binEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      binEl.classList.add('drag-over');
    });

    binEl.addEventListener('dragleave', () => {
      binEl.classList.remove('drag-over');
    });

    // Drop (drag & drop desktop)
    binEl.addEventListener('drop', (e) => {
      e.preventDefault();
      binEl.classList.remove('drag-over');

      const itemDomId = e.dataTransfer.getData('text/plain');
      const itemEl = document.getElementById(itemDomId);
      if (!itemEl) return;

      placeItemInBin(itemEl);
    });

    // TAP: colocar ítem seleccionado en este bin (mobile)
    binEl.addEventListener('click', (e) => {
      // Si se hace click directamente sobre un ítem dentro del bin,
      // no interceptar (eso se maneja por el propio ítem)
      if (e.target.closest('.classify-item')) return;
      if (!selectedItem) return;

      placeItemInBin(selectedItem);
    });

    binsContainer.appendChild(binEl);
  });

  // Crear ítems
  items.forEach((item) => {
    const itemEl = document.createElement('div');
    itemEl.className = 'classify-item';
    itemEl.id = `item-${item.id}`;
    itemEl.textContent = item.text;
    itemEl.draggable = true;

    itemEl.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', itemEl.id);
      itemEl.classList.add('dragging');
    });

    itemEl.addEventListener('dragend', () => {
      itemEl.classList.remove('dragging');
    });

    // TAP: seleccionar/deseleccionar ítem
    itemEl.addEventListener('click', () => {
      // Si lo vuelves a tocar, se deselecciona
      if (selectedItem === itemEl) {
        itemEl.classList.remove('selected');
        selectedItem = null;
        return;
      }

      // Limpiar selección anterior
      document
        .querySelectorAll('.classify-item.selected')
        .forEach((i) => i.classList.remove('selected'));

      selectedItem = itemEl;
      itemEl.classList.add('selected');
    });

    pool.appendChild(itemEl);
  });

  console.log('✅ Classify renderizado');
  console.groupEnd();
  return true;
}
