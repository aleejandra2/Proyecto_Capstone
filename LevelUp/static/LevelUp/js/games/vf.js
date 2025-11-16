// static/LevelUp/js/games/vf.js
import { shuffle, header, playSound } from './core.js';

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

  function renderEndCard() {
    const total = items.length;
    const score = correct / total;
    let title, icon, color;

    if (score >= 0.6) {
      title = '¡Excelente!';
      icon = '🎉';
      color = '#15803d';
    } else {
      title = 'Sigue practicando';
      icon = '😢';
      color = '#b91c1c';
    }

    wrap.innerHTML = `
      <div style="
        text-align:center;
        padding:3rem 2rem;
        background:white;
        border-radius:24px;
        box-shadow:0 18px 60px rgba(15,23,42,0.18);
      ">
        <div style="font-size:4rem; margin-bottom:1rem;">${icon}</div>
        <h3 style="
          font-size:2.4rem;
          font-weight:900;
          color:#1f2933;
          margin-bottom:0.75rem;
        ">
          ${title}
        </h3>
        <p style="
          font-size:1.25rem;
          font-weight:700;
          color:${color};
          margin-bottom:0.25rem;
        ">
          ${correct} de ${total} correctas
        </p>
        <p style="font-size:1.05rem; color:#4b5563;">
          Puntuación: ${Math.round(score * 100)}%
        </p>
      </div>
    `;

    host.dataset.gameComplete = 'true';
    host.dataset.gameScore = score.toFixed(2);
    host.dataset.gameCorrect = correct;
    host.dataset.gameTotal = total;
  }

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
      buttons.forEach(b => (b.disabled = true));

      // Validar respuesta
      const isCorrect = userAnswer === correctAnswer;

      if (isCorrect) {
        playSound('success');
        btn.classList.add('correct');
        feedback.innerHTML = '<span class="text-success">✓ ¡Correcto!</span>';
        correct++;
      } else {
        playSound('error');
        btn.classList.add('incorrect');
        feedback.innerHTML = '<span class="text-danger">✗ Incorrecto</span>';
      }

      answered++;

      // Actualizar UI
      host.querySelector('#vfCorrect').textContent = correct;
      hd.setBar((answered / items.length) * 100);
      hd.bump && hd.bump();

      // Si terminó, marcar como completo
      if (answered === items.length) {
        playSound('complete');
        console.log('✅ Juego completado:', { correct, total: items.length });

        setTimeout(renderEndCard, 400);
      }
    });
  });

  console.log('✅ Verdadero/Falso renderizado');
  console.groupEnd();
  return true;
}
