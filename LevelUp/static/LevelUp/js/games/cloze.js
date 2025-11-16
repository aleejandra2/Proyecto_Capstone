// static/LevelUp/js/games/cloze.js
import { shuffle, header, playSound } from './core.js';

export default function init(host, cfg) {
  console.group('🎮 [CLOZE] Inicializando');
  console.log('📦 Config:', cfg);

  const text = cfg.text || '';
  const blanks = cfg.blanks || {};

  console.log('📊 Datos:', { text: text.length, blanks: Object.keys(blanks).length });

  if (!text || !Object.keys(blanks).length) {
    console.error('❌ Faltan datos');
    host.innerHTML = '<div class="alert alert-warning">Falta texto o blanks</div>';
    console.groupEnd();
    return false;
  }

  host.innerHTML = '';
  host.setAttribute('data-game-rendered', 'true');

  const hd = header(host, 'Completar Espacios', cfg.timeLimit || 90);

  const wrap = document.createElement('div');
  wrap.className = 'cloze-game';
  host.appendChild(wrap);

  // Crear banco de palabras si no existe
  const bank = cfg.bank || [];
  const allOptions = new Set();
  Object.values(blanks).forEach(b => {
    if (Array.isArray(b.options)) {
      b.options.forEach(opt => allOptions.add(opt));
    }
  });
  const finalBank = bank.length ? bank : Array.from(allOptions);

  // Estado
  const state = {
    filled: {},
    correct: 0
  };

  // Renderizar texto con blanks
  let html = text;
  const blankIds = Object.keys(blanks);

  blankIds.forEach(id => {
    // Reemplazar [[id]] por un span
    const regex = new RegExp(`\\[\\[${id}\\]\\]`, 'g');
    html = html.replace(regex, `<span class="cloze-blank" data-blank-id="${id}" id="blank-${id}">______</span>`);
  });

  wrap.innerHTML = `
    <div class="cloze-text">${html}</div>
    <div class="cloze-bank" id="clozeBank">
      <div class="cloze-bank-title">📝 Arrastra o haz clic para completar:</div>
      <div class="cloze-words" id="clozeWords"></div>
    </div>
  `;

  const wordsContainer = wrap.querySelector('#clozeWords');

  // Crear palabras del banco (mezcladas)
  const shuffledBank = shuffle([...finalBank]);

  shuffledBank.forEach((word, idx) => {
    const wordEl = document.createElement('div');
    wordEl.className = 'cloze-word';
    wordEl.textContent = word;
    wordEl.draggable = true;
    wordEl.dataset.word = word;
    wordEl.id = `word-${idx}`;

    // Drag
    wordEl.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', word);
      wordEl.classList.add('dragging');
    });

    wordEl.addEventListener('dragend', () => {
      wordEl.classList.remove('dragging');
    });

    // Click para seleccionar
    wordEl.addEventListener('click', () => {
      document.querySelectorAll('.cloze-word').forEach(w => w.classList.remove('selected'));
      wordEl.classList.add('selected');
    });

    wordsContainer.appendChild(wordEl);
  });

  // Configurar blanks
  wrap.querySelectorAll('.cloze-blank').forEach(blank => {
    // Drag over
    blank.addEventListener('dragover', (e) => {
      e.preventDefault();
      blank.classList.add('drag-over');
    });

    blank.addEventListener('dragleave', () => {
      blank.classList.remove('drag-over');
    });

    // Drop
    blank.addEventListener('drop', (e) => {
      e.preventDefault();
      blank.classList.remove('drag-over');

      const word = e.dataTransfer.getData('text/plain');
      fillBlank(blank, word, false);
    });

    // Click en blank (si hay palabra seleccionada)
    blank.addEventListener('click', () => {
      const selected = document.querySelector('.cloze-word.selected');
      if (selected) {
        fillBlank(blank, selected.dataset.word, true);
        selected.remove();
      }
    });
  });

  function renderEndCard() {
    const total = blankIds.length;
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
          ${state.correct} de ${total} espacios completados correctamente
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

  function fillBlank(blank, word, removeFromBank) {
    const blankId = blank.dataset.blankId;
    const total = blankIds.length;

    // Si ya tenía algo, ajustar estado.correct
    if (state.filled[blankId]) {
      const prevWord = state.filled[blankId];
      if (prevWord === blanks[blankId].answer) {
        state.correct--;
      }
    }

    blank.textContent = word;
    blank.classList.add('filled');
    blank.classList.remove('correct', 'incorrect');

    state.filled[blankId] = word;

    const correctAnswer = blanks[blankId].answer;
    if (word === correctAnswer) {
      blank.classList.add('correct');
      playSound('success');
      state.correct++;
    } else {
      blank.classList.add('incorrect');
      playSound('error');
    }

    // Si vino por click, ya borramos la palabra del banco arriba

    // Actualizar progreso
    const filled = Object.keys(state.filled).length;
    hd.setBar((filled / total) * 100);
    hd.bump && hd.bump();

    // Si terminó
    if (filled === total) {
      playSound('complete');
      setTimeout(renderEndCard, 400);
    }
  }

  console.log('✅ Cloze renderizado');
  console.groupEnd();
  return true;
}
