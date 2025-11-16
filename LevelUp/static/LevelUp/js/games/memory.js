import { shuffle, playSound } from './core.js';

console.log('🎮 [MEMORY] Módulo cargado');

export default async function init(host, cfg) {
  console.log('🎮 [MEMORY] Inicializando');

  const pairs = cfg.pairs || [];
  if (pairs.length < 2) {
    console.error('❌ [MEMORY] Necesita al menos 2 pares');
    return;
  }

  // Crear cartas duplicadas a partir de pairs
  const cards = [];
  pairs.forEach((pair, idx) => {
    // pair[0] y pair[1] = textos o imágenes de las dos mitades
    cards.push({ id: `a-${idx}`, text: pair[0], pairId: idx });
    cards.push({ id: `b-${idx}`, text: pair[1], pairId: idx });
  });

  const shuffled = shuffle(cards);
  let flipped = [];
  let matched = 0;
  let attempts = 0;

  // Limpiar host
  host.innerHTML = '';
  host.style.padding = '0';
  host.style.background = 'transparent';

  // Contenedor principal
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'padding: 0;';

  // Header del juego
  const headerDiv = document.createElement('div');
  headerDiv.style.cssText = `
    background: linear-gradient(135deg, #e599f7 0%, #b197fc 100%);
    padding: 2rem 1.5rem;
    border-radius: 20px;
    margin-bottom: 2rem;
    text-align: center;
    box-shadow: 0 6px 24px rgba(181, 151, 252, 0.3);
  `;
  headerDiv.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; gap: 1rem; margin-bottom: 1rem;">
      <div style="width: 60px; height: 60px; background: rgba(255, 255, 255, 0.2); border-radius: 50%;
                  display: flex; align-items: center; justify-content: center; font-size: 2rem; backdrop-filter: blur(10px);">
        🧠
      </div>
      <div>
        <div style="color: white; font-size: 1.8rem; font-weight: 900; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);">
          Juego de Memoria
        </div>
      </div>
    </div>
    <div style="color: rgba(255,255,255,0.95); font-size: 1.1rem; font-weight: 600; margin-bottom: 1.5rem;">
      🎯 Encuentra todos los pares volteando las cartas
    </div>
    <div style="display: flex; gap: 2rem; justify-content: center; flex-wrap: wrap;">
      <div style="background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(10px); padding: 0.75rem 1.5rem; border-radius: 12px;">
        <div style="color: rgba(255,255,255,0.8); font-size: 0.9rem; font-weight: 600; margin-bottom: 0.25rem;">Parejas</div>
        <div style="color: white; font-size: 1.8rem; font-weight: 900;">
          <span id="mem-matched">0</span><span style="font-size: 1.2rem; opacity: 0.7;">/${pairs.length}</span>
        </div>
      </div>
      <div style="background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(10px); padding: 0.75rem 1.5rem; border-radius: 12px;">
        <div style="color: rgba(255,255,255,0.8); font-size: 0.9rem; font-weight: 600; margin-bottom: 0.25rem;">Intentos</div>
        <div style="color: white; font-size: 1.8rem; font-weight: 900;" id="mem-attempts">0</div>
      </div>
    </div>
  `;
  wrapper.appendChild(headerDiv);

  // Board de cartas
  const board = document.createElement('div');
  board.className = 'memory-board';
  board.style.cssText = `
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 1.25rem;
    padding: 0;
  `;

  shuffled.forEach((card) => {
    const cardWrap = document.createElement('div');
    cardWrap.className = 'memory-card-wrap';

    const cardEl = document.createElement('div');
    cardEl.className = 'memory-card';
    cardEl.dataset.cardId = card.id;
    cardEl.dataset.pairId = card.pairId;

    // Cara frontal (dorso)
    const front = document.createElement('div');
    front.className = 'card-front';

    // Cara trasera (texto)
    const back = document.createElement('div');
    back.className = 'card-back';
    back.textContent = card.text;

    cardEl.appendChild(front);
    cardEl.appendChild(back);
    cardWrap.appendChild(cardEl);

    // Lógica de click
    cardEl.addEventListener('click', () => {
      if (cardEl.classList.contains('flipped') ||
        cardEl.classList.contains('matched') ||
        flipped.length >= 2) {
        return;
      }

      console.log(`👆 [MEMORY] Click en carta ${card.id}`);

      cardEl.classList.add('flipped');
      flipped.push(cardEl);

      if (flipped.length === 2) {
        attempts++;
        const attemptsEl = headerDiv.querySelector('#mem-attempts');
        if (attemptsEl) attemptsEl.textContent = attempts;

        const [c1, c2] = flipped;
        const pair1 = c1.dataset.pairId;
        const pair2 = c2.dataset.pairId;

        if (pair1 === pair2) {
          console.log('✅ [MEMORY] Par encontrado!');
          playSound('success');

          setTimeout(() => {
            c1.classList.add('matched');
            c2.classList.add('matched');

            // Efecto visual en el texto
            const back1 = c1.querySelector('.card-back');
            const back2 = c2.querySelector('.card-back');
            if (back1 && back2) {
              back1.style.cssText += `
                background: linear-gradient(135deg, #51CF66 0%, #8ce99a 100%) !important;
                color: white !important;
                border-color: #51CF66 !important;
              `;
              back2.style.cssText += `
                background: linear-gradient(135deg, #51CF66 0%, #8ce99a 100%) !important;
                color: white !important;
                border-color: #51CF66 !important;
              `;
            }

            matched++;
            const matchedEl = headerDiv.querySelector('#mem-matched');
            if (matchedEl) matchedEl.textContent = matched;

            flipped = [];

            if (matched === pairs.length) {
              setTimeout(() => finish(), 600);
            }
          }, 500);
        } else {
          console.log('❌ [MEMORY] No coinciden');
          playSound('error');

          setTimeout(() => {
            c1.classList.remove('flipped');
            c2.classList.remove('flipped');

            c1.style.animation = 'wiggle 0.5s ease-out';
            c2.style.animation = 'wiggle 0.5s ease-out';

            setTimeout(() => {
              c1.style.animation = '';
              c2.style.animation = '';
            }, 500);

            flipped = [];
          }, 900);
        }
      }
    });

    board.appendChild(cardWrap);
  });

  wrapper.appendChild(board);
  host.appendChild(wrapper);

  function finish() {
    console.log('🏁 [MEMORY] Juego completado');
    playSound('complete');

    const efficiency = attempts > 0 ? (pairs.length / attempts) : 1;
    const stars = efficiency >= 0.8 ? '⭐⭐⭐' : efficiency >= 0.6 ? '⭐⭐' : '⭐';

    wrapper.innerHTML = `
      <div style="text-align: center; padding: 3rem 2rem; background: white; border-radius: 24px; box-shadow: 0 8px 32px rgba(0,0,0,0.12);">
        <div style="font-size: 5rem; margin-bottom: 1.5rem; animation: bounce-in 0.6s ease-out;">🎉</div>
        <h3 style="font-size: 2.5rem; font-weight: 900; color: #2c3e50; margin-bottom: 1rem;">
          ¡Felicitaciones!
        </h3>
        <div style="font-size: 3rem; margin-bottom: 1rem;">
          ${stars}
        </div>
        <div style="font-size: 1.4rem; font-weight: 700; color: #51CF66; margin-bottom: 1rem;">
          Encontraste todos los ${pairs.length} pares
        </div>
        <div style="font-size: 1.2rem; font-weight: 600; color: #6c757d;">
          En ${attempts} intentos
        </div>
      </div>
    `;

    host.dataset.gameComplete = 'true';
    host.dataset.gameScore = '1';
    host.dataset.gameCorrect = pairs.length;
    host.dataset.gameTotal = pairs.length;

    console.log('✅ [MEMORY] Marcado como completado');
  }

  console.log('✅ Memory renderizado');
  host.dataset.gameRendered = 'true';
  return wrapper;
}
