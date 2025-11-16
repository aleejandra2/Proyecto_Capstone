import { shuffle, playSound } from './core.js';

console.log('🎮 [DRAGMATCH] Módulo cargado');

export default async function init(host, cfg) {
  console.log('🎮 [DRAGMATCH] Inicializando');
  console.log('📦 Config:', cfg);

  const pairs = cfg.pairs || [];
  if (pairs.length < 2) {
    console.error('❌ [DRAGMATCH] Necesita al menos 2 pares');
    return;
  }

  let matched = 0;

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
    background: linear-gradient(135deg, #4DABF7 0%, #339af0 100%);
    padding: 2rem 1.5rem;
    border-radius: 20px;
    margin-bottom: 2rem;
    text-align: center;
    box-shadow: 0 6px 24px rgba(77, 171, 247, 0.4);
  `;
  headerDiv.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; gap: 1rem; margin-bottom: 1rem;">
      <div style="width: 60px; height: 60px; background: rgba(255, 255, 255, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2rem; backdrop-filter: blur(10px);">
        🎯
      </div>
      <div>
        <div style="color: white; font-size: 1.8rem; font-weight: 900; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);">
          Arrastra y Empareja
        </div>
      </div>
    </div>
    <div style="color: rgba(255,255,255,0.95); font-size: 1.1rem; font-weight: 600; margin-bottom: 1.5rem;">
          🔗 Arrastra cada elemento a su pareja correcta
    </div>
    <div style="background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(10px); padding: 0.75rem 1.5rem; border-radius: 12px; display: inline-block;">
      <div style="color: rgba(255,255,255,0.8); font-size: 0.9rem; font-weight: 600; margin-bottom: 0.25rem;">Emparejadas</div>
      <div style="color: white; font-size: 1.8rem; font-weight: 900;">
        <span id="dm-matched">0</span><span style="font-size: 1.2rem; opacity: 0.7;">/${pairs.length}</span>
      </div>
    </div>
  `;
  wrapper.appendChild(headerDiv);

  // Contenedor de elementos
  const poolDiv = document.createElement('div');
  poolDiv.style.cssText = `
    background: white;
    padding: 2rem;
    border-radius: 20px;
    margin-bottom: 2rem;
    border: 3px dashed #dee2e6;
    min-height: 140px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    transition: all 0.3s;
  `;
  poolDiv.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; gap: 0.75rem; margin-bottom: 1.5rem;">
      <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #FFD43B, #FFA94D); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
        📦
      </div>
      <div style="font-size: 1.3rem; font-weight: 800; color: #495057;">
        Elementos para arrastrar
      </div>
    </div>
    <div id="dm-pool" style="display: flex; flex-wrap: wrap; gap: 1rem; justify-content: center; min-height: 60px;"></div>
  `;
  wrapper.appendChild(poolDiv);

  // Contenedor de parejas
  const pairsDiv = document.createElement('div');
  pairsDiv.style.cssText = `
    background: white;
    padding: 2rem;
    border-radius: 20px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  `;
  pairsDiv.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; gap: 0.75rem; margin-bottom: 1.5rem;">
      <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #4DABF7, #339af0); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
        🎯
      </div>
      <div style="font-size: 1.3rem; font-weight: 800; color: #4DABF7;">
        Lugares de destino
      </div>
    </div>
    <div id="dm-targets" style="display: flex; flex-direction: column; gap: 1.25rem;"></div>
  `;
  wrapper.appendChild(pairsDiv);

  const pool = poolDiv.querySelector('#dm-pool');
  const targetsContainer = pairsDiv.querySelector('#dm-targets');

  // Crear elementos arrastrables
  const leftItems = shuffle(pairs.map((p, i) => ({ text: p[0], pairId: i })));

  leftItems.forEach(item => {
    const chip = document.createElement('div');
    chip.className = 'dm-chip';
    chip.draggable = true;
    chip.dataset.pairId = item.pairId;
    chip.textContent = item.text;
    chip.style.cssText = `
      padding: 1.25rem 2rem;
      background: linear-gradient(135deg, #FFD43B 0%, #FFA94D 100%);
      color: white;
      border-radius: 16px;
      font-weight: 900;
      font-size: 1.15rem;
      cursor: grab;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 6px 20px rgba(255, 212, 59, 0.4);
      user-select: none;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    `;

    chip.addEventListener('dragstart', (e) => {
      console.log(`🖱️ [DRAGMATCH] Inicio arrastre:`, item.text);
      chip.classList.add('dragging');
      chip.style.opacity = '0.5';
      chip.style.transform = 'scale(0.95)';
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.pairId);
    });

    chip.addEventListener('dragend', () => {
      chip.classList.remove('dragging');
      chip.style.opacity = '1';
      chip.style.transform = '';
    });

    // Hover effect
    chip.addEventListener('mouseenter', () => {
      chip.style.transform = 'translateY(-6px) scale(1.05)';
      chip.style.boxShadow = '0 12px 32px rgba(255, 212, 59, 0.5)';
    });

    chip.addEventListener('mouseleave', () => {
      if (!chip.classList.contains('dragging')) {
        chip.style.transform = '';
        chip.style.boxShadow = '0 6px 20px rgba(255, 212, 59, 0.4)';
      }
    });

    pool.appendChild(chip);
  });

  // Crear targets
  pairs.forEach((pair, idx) => {
    const targetRow = document.createElement('div');
    targetRow.style.cssText = `
      display: flex;
      align-items: center;
      gap: 1.25rem;
      padding: 1.25rem;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      border-radius: 16px;
      flex-wrap: wrap;
      min-height: 90px;
    `;

    const label = document.createElement('div');
    label.style.cssText = `
      font-weight: 800;
      color: #2c3e50;
      font-size: 1.2rem;
      flex: 1;
      min-width: 150px;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    `;
    label.innerHTML = `
      <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #4DABF7, #339af0); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 1.1rem; flex-shrink: 0;">
        ${idx + 1}
      </div>
      <span>${pair[1]}</span>
    `;

    const slot = document.createElement('div');
    slot.className = 'dm-slot';
    slot.dataset.pairId = idx;
    slot.style.cssText = `
      min-width: 180px;
      min-height: 70px;
      border: 3px dashed #ced4da;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      background: white;
      padding: 0.75rem;
      box-shadow: inset 0 2px 6px rgba(0,0,0,0.05);
    `;
    slot.innerHTML = `
      <div style="color: #adb5bd; font-size: 1rem; font-weight: 700; text-align: center;">
        <div style="font-size: 1.5rem; margin-bottom: 0.25rem;">⬇️</div>
        Suelta aquí
      </div>
    `;

    slot.addEventListener('dragover', (e) => {
      e.preventDefault();
      slot.style.cssText += `
        background: linear-gradient(135deg, #e7f5ff 0%, #d0ebff 100%) !important;
        border-color: #4DABF7 !important;
        border-style: solid !important;
        border-width: 3px !important;
        transform: scale(1.05);
        box-shadow: 0 8px 24px rgba(77, 171, 247, 0.4) !important;
      `;
    });

    slot.addEventListener('dragleave', () => {
      if (!slot.querySelector('.dm-chip')) {
        slot.style.cssText = `
          min-width: 180px;
          min-height: 70px;
          border: 3px dashed #ced4da;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s;
          background: white;
          padding: 0.75rem;
          box-shadow: inset 0 2px 6px rgba(0,0,0,0.05);
        `;
        slot.innerHTML = `
          <div style="color: #adb5bd; font-size: 1rem; font-weight: 700; text-align: center;">
            <div style="font-size: 1.5rem; margin-bottom: 0.25rem;">⬇️</div>
            Suelta aquí
          </div>
        `;
      }
    });

    slot.addEventListener('drop', (e) => {
      e.preventDefault();

      const draggedPairId = e.dataTransfer.getData('text/plain');
      const targetPairId = slot.dataset.pairId;

      console.log(`📥 [DRAGMATCH] Drop en target ${targetPairId}, elemento ${draggedPairId}`);

      const draggedChip = pool.querySelector(`[data-pair-id="${draggedPairId}"]`);

      if (!draggedChip) {
        console.warn('⚠️ [DRAGMATCH] Chip no encontrado');
        return;
      }

      if (draggedPairId === targetPairId) {
        console.log('✅ [DRAGMATCH] Pareja correcta!');
        playSound('success');

        slot.innerHTML = '';
        slot.appendChild(draggedChip);
        draggedChip.draggable = false;
        draggedChip.style.cursor = 'default';
        draggedChip.style.transform = 'scale(1)';

        slot.style.cssText += `
          background: linear-gradient(135deg, #51CF66 0%, #8ce99a 100%) !important;
          border-color: #51CF66 !important;
          border-style: solid !important;
          border-width: 3px !important;
          animation: celebrate 0.7s ease-out;
          box-shadow: 0 8px 24px rgba(81, 207, 102, 0.5) !important;
        `;

        matched++;
        const matchedEl = headerDiv.querySelector('#dm-matched');
        if (matchedEl) matchedEl.textContent = matched;

        if (matched === pairs.length) {
          setTimeout(() => finish(), 1000);
        }
      } else {
        console.log('❌ [DRAGMATCH] Pareja incorrecta');
        playSound('error');
        slot.style.cssText = `
          min-width: 180px;
          min-height: 70px;
          border: 3px dashed #ced4da;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s;
          background: white;
          padding: 0.75rem;
          box-shadow: inset 0 2px 6px rgba(0,0,0,0.05);
        `;
        slot.innerHTML = `
          <div style="color: #adb5bd; font-size: 1rem; font-weight: 700; text-align: center;">
            <div style="font-size: 1.5rem; margin-bottom: 0.25rem;">⬇️</div>
            Suelta aquí
          </div>
        `;

        // Efecto de error
        slot.style.animation = 'wiggle 0.5s ease-out';
        targetRow.style.animation = 'wiggle 0.5s ease-out';
        setTimeout(() => {
          slot.style.animation = '';
          targetRow.style.animation = '';
        }, 500);
      }
    });

    targetRow.appendChild(label);
    targetRow.appendChild(slot);
    targetsContainer.appendChild(targetRow);
  });

  host.appendChild(wrapper);

  function finish() {
    console.log('🏁 [DRAGMATCH] Juego completado');
    playSound('complete');

    wrapper.innerHTML = `
      <div style="text-align: center; padding: 3rem 2rem; background: white; border-radius: 24px; box-shadow: 0 8px 32px rgba(0,0,0,0.12);">
        <div style="font-size: 5rem; margin-bottom: 1.5rem; animation: bounce-in 0.6s ease-out;">🎉</div>
        <h3 style="font-size: 2.5rem; font-weight: 900; color: #2c3e50; margin-bottom: 1rem;">
          ¡Perfecto!
        </h3>
        <div style="font-size: 1.4rem; font-weight: 700; color: #51CF66;">
          Todas las parejas correctas
        </div>
      </div>
    `;

    host.dataset.gameComplete = 'true';
    host.dataset.gameScore = '1';
    host.dataset.gameCorrect = pairs.length;
    host.dataset.gameTotal = pairs.length;

    console.log('✅ [DRAGMATCH] Marcado como completado');
  }

  console.log('✅ Dragmatch renderizado');
  host.dataset.gameRendered = 'true';
  return wrapper;
}