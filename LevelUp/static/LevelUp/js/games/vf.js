// static/LevelUp/js/games/vf.js
import { shuffle, header } from './core.js';

export default function init(host, cfg) {
  console.group('🎮 [VF] Inicializando Verdadero/Falso');
  console.log('📦 Config recibida:', cfg);

  // Normalizar items
  let items = cfg.items || [];

  // Convertir is_true a answer si es necesario
  items = items.map(item => ({
    text: item.text,
    answer: item.answer || (item.is_true ? 'V' : 'F')
  }));

  console.log('✅ Items normalizados:', items);

  if (!Array.isArray(items) || items.length === 0) {
    console.error('❌ No hay items válidos');
    host.innerHTML = '<div class="alert alert-warning">No hay afirmaciones para evaluar</div>';
    console.groupEnd();
    return false;
  }

  const timeLimit = cfg.timeLimit || 90;

  host.innerHTML = '';
  host.setAttribute('data-game-rendered', 'true');

  const hd = header(host, 'Verdadero o Falso', timeLimit);

  const wrap = document.createElement('div');
  wrap.className = 'vf-game';
  wrap.innerHTML = `
    <div class="vf-score">Correctas: <span id="vfCorrect">0</span> / ${items.length}</div>
    <div id="vfContainer"></div>
  `;
  host.appendChild(wrap);

  const container = wrap.querySelector('#vfContainer');
  let correct = 0;
  let answered = 0;

  // Renderizar items
  items.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'vf-card';
    card.innerHTML = `
      <div class="vf-number">Afirmación ${idx + 1}</div>
      <div class="vf-statement">${item.text}</div>
      <div class="vf-buttons">
        <button class="vf-btn vf-btn-true" data-idx="${idx}" data-answer="V">
          <span class="vf-icon">✓</span>
          Verdadero
        </button>
        <button class="vf-btn vf-btn-false" data-idx="${idx}" data-answer="F">
          <span class="vf-icon">✗</span>
          Falso
        </button>
      </div>
      <div class="vf-feedback" data-idx="${idx}"></div>
    `;
    container.appendChild(card);
  });

  // Event listeners
  host.querySelectorAll('.vf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const userAnswer = btn.dataset.answer;
      const correctAnswer = items[idx].answer;
      const card = btn.closest('.vf-card');
      const feedback = card.querySelector('.vf-feedback');
      const buttons = card.querySelectorAll('.vf-btn');

      // Deshabilitar botones
      buttons.forEach(b => b.disabled = true);

      // Validar respuesta
      const isCorrect = userAnswer === correctAnswer;

      if (isCorrect) {
        btn.classList.add('correct');
        feedback.innerHTML = '<span class="text-success">✓ ¡Correcto!</span>';
        correct++;
      } else {
        btn.classList.add('incorrect');
        feedback.innerHTML = `<span class="text-danger">✗ Incorrecto. La respuesta correcta era: <strong>${correctAnswer === 'V' ? 'Verdadero' : 'Falso'}</strong></span>`;
      }

      answered++;

      // Actualizar UI
      host.querySelector('#vfCorrect').textContent = correct;
      hd.setBar((answered / items.length) * 100);
      hd.bump();

      // Si terminó, marcar como completo
      if (answered === items.length) {
        console.log('✅ Juego completado:', { correct, total: items.length });
        host.dataset.gameComplete = 'true';
        host.dataset.gameScore = (correct / items.length).toFixed(2);
        host.dataset.gameCorrect = correct;
        host.dataset.gameTotal = items.length;

        setTimeout(() => {
          const summary = document.createElement('div');
          summary.className = 'alert alert-success mt-3';
          summary.innerHTML = `
            <h5>¡Juego terminado! 🎉</h5>
            <p>Respuestas correctas: <strong>${correct}</strong> de <strong>${items.length}</strong></p>
            <p>Puntuación: <strong>${Math.round((correct / items.length) * 100)}%</strong></p>
          `;
          wrap.appendChild(summary);
        }, 300);
      }
    });
  });

  console.log('✅ Verdadero/Falso renderizado');
  console.groupEnd();
  return true;
}