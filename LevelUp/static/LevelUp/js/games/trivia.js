// static/LevelUp/js/games/trivia.js
import { shuffle, playSound } from './core.js';

console.log('🎮 [TRIVIA] Módulo cargado');

export default async function init(host, cfg) {
  console.log('🎮 [TRIVIA] Inicializando');
  console.log('📦 Config:', cfg);

  const questions = shuffle(cfg.trivia || cfg.questions || []);
  if (!questions.length) {
    console.error('❌ [TRIVIA] No hay preguntas');
    return;
  }

  let currentQ = 0;
  let correctas = 0;
  let lives = cfg.lives != null ? cfg.lives : 3;

  // Limpiar host
  host.innerHTML = '';
  host.style.padding = '0';
  host.style.background = 'transparent';

  // Contenedor principal
  const wrapper = document.createElement('div');
  wrapper.className = 'tr-card';

  // Header del juego (sin avatar)
  const headerDiv = document.createElement('div');
  headerDiv.style.cssText = `
    background: linear-gradient(135deg, #FF6B6B 0%, #ff8787 100%);
    padding: 2rem 1.5rem;
    border-radius: 20px;
    margin-bottom: 2rem;
    text-align: center;
    box-shadow: 0 6px 24px rgba(255, 107, 107, 0.4);
  `;
  headerDiv.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;gap:1rem;margin-bottom:1rem;">
      <div style="width:60px;height:60px;background:rgba(255,255,255,0.2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:2rem;backdrop-filter:blur(10px);">
        🧠
      </div>
      <div>
        <div style="color:white;font-size:1.8rem;font-weight:900;text-shadow:0 2px 8px rgba(0,0,0,0.2);">
          Trivia
        </div>
      </div>
    </div>
    <div style="color:rgba(255,255,255,0.95);font-size:1.1rem;font-weight:600;margin-bottom:1.5rem;">
      ❓ Responde correctamente para avanzar
    </div>
    <div style="display:flex;gap:1.5rem;justify-content:center;flex-wrap:wrap;">
      <div style="background:rgba(255,255,255,0.2);backdrop-filter:blur(10px);padding:0.75rem 1.5rem;border-radius:12px;">
        <div style="color:rgba(255,255,255,0.8);font-size:0.9rem;font-weight:600;margin-bottom:0.25rem;">Pregunta</div>
        <div style="color:white;font-size:1.6rem;font-weight:900;">
          <span id="tr-current">1</span><span style="font-size:1.1rem;opacity:0.7;">/${questions.length}</span>
        </div>
      </div>
      <div style="background:rgba(255,255,255,0.2);backdrop-filter:blur(10px);padding:0.75rem 1.5rem;border-radius:12px;">
        <div style="color:rgba(255,255,255,0.8);font-size:0.9rem;font-weight:600;margin-bottom:0.25rem;">Vidas</div>
        <div style="font-size:1.8rem;" id="tr-lives">${'❤️'.repeat(lives)}</div>
      </div>
    </div>
  `;
  wrapper.appendChild(headerDiv);

  // Pregunta
  const qDiv = document.createElement('div');
  qDiv.className = 'tr-q';
  qDiv.id = 'tr-question';
  qDiv.style.marginBottom = '2rem';
  wrapper.appendChild(qDiv);

  // Opciones
  const optsDiv = document.createElement('div');
  optsDiv.className = 'tr-opts';
  optsDiv.id = 'tr-options';
  optsDiv.style.cssText = 'display:flex;flex-direction:column;gap:1rem;';
  wrapper.appendChild(optsDiv);

  host.appendChild(wrapper);

  function renderQuestion() {
    console.log(`📝 [TRIVIA] Renderizando pregunta ${currentQ + 1}`);

    const q = questions[currentQ];
    qDiv.textContent = q.q || q.question || '¿Pregunta?';

    // Actualizar contador
    const currentEl = headerDiv.querySelector('#tr-current');
    if (currentEl) currentEl.textContent = currentQ + 1;

    // Limpiar opciones
    optsDiv.innerHTML = '';

    const opts = q.opts || q.options || [];
    const correctIndex = q.ans !== undefined ? q.ans : (q.answer || 0);

    opts.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = 'tr-opt';
      btn.textContent = opt;
      btn.setAttribute('data-index', idx);

      btn.addEventListener('click', () => {
        console.log(`👆 [TRIVIA] Click en opción ${idx}`);

        // Deshabilitar todos los botones
        optsDiv.querySelectorAll('.tr-opt').forEach(b => {
          b.disabled = true;
          b.style.cursor = 'not-allowed';
        });

        if (idx === correctIndex) {
          console.log('✅ [TRIVIA] Respuesta correcta');
          playSound('success');
          btn.classList.add('btn-success');
          correctas++;
        } else {
          console.log('❌ [TRIVIA] Respuesta incorrecta');
          playSound('error');
          btn.classList.add('btn-danger');
          lives--;

          // Actualizar corazones
          const livesEl = headerDiv.querySelector('#tr-lives');
          if (livesEl) {
            livesEl.textContent = '❤️'.repeat(Math.max(0, lives)) || '💔';
          }

          // Mostrar la correcta
          const correctBtn = optsDiv.querySelector(`[data-index="${correctIndex}"]`);
          if (correctBtn) {
            setTimeout(() => {
              correctBtn.classList.add('btn-success');
            }, 300);
          }
        }

        // Siguiente pregunta o finalizar
        setTimeout(() => {
          currentQ++;
          if (currentQ < questions.length && lives > 0) {
            renderQuestion();
          } else {
            finish(lives <= 0);
          }
        }, 1500);
      });

      optsDiv.appendChild(btn);
    });
  }

  function finish(outOfLives = false) {
    console.log('🏁 [TRIVIA] Juego terminado');
    console.log(`📊 [TRIVIA] Correctas: ${correctas}/${questions.length}`);

    const score = correctas / questions.length;

    let icon, title, detail;
    if (outOfLives) {
      icon = '😢';
      title = 'Sigue practicando';
      detail = 'Te quedaste sin vidas. Puedes intentarlo de nuevo cuando quieras.';
      playSound('error');
    } else if (score >= 0.7) {
      icon = '🎉';
      title = '¡Excelente!';
      detail = 'Respondiste muy bien la trivia.';
      playSound('complete');
    } else if (score >= 0.4) {
      icon = '😊';
      title = '¡Buen intento!';
      detail = 'Vas por buen camino, sigue practicando.';
      playSound('success');
    } else {
      icon = '😢';
      title = 'Sigue practicando';
      detail = 'Puedes volver a intentarlo para mejorar tu puntuación.';
      playSound('error');
    }

    wrapper.innerHTML = `
      <div style="text-align:center;padding:3rem 1.5rem;">
        <div style="font-size:4rem;margin-bottom:1rem;">${icon}</div>
        <h3 style="font-size:2rem;font-weight:800;color:#2c3e50;margin-bottom:1rem;">
          ${title}
        </h3>
        <div style="font-size:1.5rem;font-weight:700;color:#495057;margin-bottom:1.5rem;">
          ${correctas} de ${questions.length} correctas
        </div>
        <div style="width:100%;max-width:300px;height:20px;background:#e9ecef;border-radius:10px;overflow:hidden;margin:0 auto 0.75rem auto;">
          <div style="width:${score * 100}%;height:100%;background:linear-gradient(135deg,#51CF66,#8ce99a);transition:width 1s ease;"></div>
        </div>
        <p style="margin-top:0.5rem;color:#6b7280;">${detail}</p>
      </div>
    `;

    // Marcar como completado
    host.dataset.gameComplete = 'true';
    host.dataset.gameScore = score.toFixed(2);
    host.dataset.gameCorrect = correctas;
    host.dataset.gameTotal = questions.length;

    console.log('✅ [TRIVIA] Marcado como completado');
  }

  // Iniciar primera pregunta
  renderQuestion();

  console.log('✅ Trivia renderizada');
  host.dataset.gameRendered = 'true';
  return wrapper;
}
