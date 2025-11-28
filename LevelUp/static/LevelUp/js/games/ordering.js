// static/LevelUp/js/games/ordering.js
import { shuffle, playSound } from './core.js';

console.log('🎮 [ORDERING] Módulo cargado');

export default async function init(host, cfg) {
  console.log('🎮 [ORDERING] Inicializando');
  console.log('📦 Config:', cfg);

  const items = cfg.items || [];
  const correctOrder = cfg.correct_order || [];

  if (!items.length || !correctOrder.length) {
    console.error('❌ [ORDERING] Datos incompletos');
    return;
  }

  console.log('📊 Datos:', { items, correctOrder });

  // Limpiar host
  host.innerHTML = '';
  host.style.padding = '0';
  host.style.background = 'transparent';

  // Contenedor principal
  const wrapper = document.createElement('div');
  wrapper.className = 'ordering-game';

  // Header del juego
  const headerDiv = document.createElement('div');
  headerDiv.style.cssText = `
    background: linear-gradient(135deg, #FFD43B 0%, #FFA94D 100%);
    padding: 1.5rem;
    border-radius: 20px;
    margin-bottom: 1.5rem;
    text-align: center;
  `;
  headerDiv.innerHTML = `
    <div style="color: white; font-size: 1.4rem; font-weight: 800; margin-bottom: 0.5rem;">
      📋 Ordenar Secuencia
    </div>
    <div style="color: rgba(255,255,255,0.9); font-size: 1rem; font-weight: 600;">
      Arrastra los elementos para ordenarlos correctamente
    </div>
  `;
  wrapper.appendChild(headerDiv);

  // Instrucciones
  const instructionsDiv = document.createElement('div');
  instructionsDiv.className = 'ordering-instructions';
  instructionsDiv.textContent = '📝 Arrastra o toca los elementos para ordenarlos correctamente';
  wrapper.appendChild(instructionsDiv);

  // Lista de items
  const list = document.createElement('div');
  list.className = 'ordering-list';
  list.id = 'ordering-list';

  // TAP (mobile): ítem seleccionado para swap
  let selectedItem = null;

  function clearSelectedOrderingItem() {
    if (selectedItem) {
      selectedItem.classList.remove('selected');
      selectedItem = null;
    }
  }

  function swapItems(a, b) {
    if (!a || !b || a === b) return;

    const parent = list;

    const aNext = a.nextSibling;
    const bNext = b.nextSibling;

    // Distintos casos según posición
    if (aNext === b) {
      parent.insertBefore(b, a);
    } else if (bNext === a) {
      parent.insertBefore(a, b);
    } else {
      parent.insertBefore(a, bNext);
      parent.insertBefore(b, aNext);
    }

    // Actualizar numeritos
    updateNumbers();
  }

  // Mezclar items
  const shuffledItems = shuffle([...items]);

  shuffledItems.forEach((item, idx) => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'ordering-item';
    itemDiv.draggable = true;
    itemDiv.dataset.itemId = item.id;
    itemDiv.style.cssText = `
      display: flex;
      align-items: center;
      gap: 1.25rem;
      padding: 1.5rem;
      background: white;
      border: 4px solid #e9ecef;
      border-radius: 20px;
      cursor: grab;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
      user-select: none;
      flex-wrap: wrap;
    `;

    itemDiv.innerHTML = `
      <div class="ordering-handle" style="font-size: 2rem; color: #868e96; flex-shrink: 0;">
        ⋮⋮
      </div>
      <div class="ordering-text" style="flex: 1; font-size: 1.15rem; font-weight: 700; color: #2c3e50; min-width: 150px; word-wrap: break-word;">
        ${item.text}
      </div>
      <div class="ordering-number" style="font-size: 1.4rem; font-weight: 800; color: #9775FA; background: linear-gradient(135deg, #f3f0ff, #e5dbff); width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 16px rgba(151, 117, 250, 0.35); flex-shrink: 0;">
        ${idx + 1}
      </div>
    `;

    // Drag events
    itemDiv.addEventListener('dragstart', (e) => {
      console.log('🖱️ [ORDERING] Inicio arrastre:', item.text);
      itemDiv.classList.add('dragging');
      itemDiv.style.opacity = '0.5';
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.id);
    });

    itemDiv.addEventListener('dragend', () => {
      itemDiv.classList.remove('dragging');
      itemDiv.style.opacity = '1';
    });

    // Drag over en otros items: reordenar en desktop
    itemDiv.addEventListener('dragover', (e) => {
      e.preventDefault();
      const dragging = list.querySelector('.dragging');
      if (!dragging || dragging === itemDiv) return;

      const rect = itemDiv.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;

      if (e.clientY < midpoint) {
        list.insertBefore(dragging, itemDiv);
      } else {
        list.insertBefore(dragging, itemDiv.nextSibling);
      }

      updateNumbers();
    });

    // TAP: seleccionar y hacer swap (mobile)
    itemDiv.addEventListener('click', () => {
      // Si está en medio de un drag, ignorar
      if (itemDiv.classList.contains('dragging')) return;

      // Si no hay nada seleccionado, seleccionar este
      if (!selectedItem) {
        selectedItem = itemDiv;
        itemDiv.classList.add('selected');
        return;
      }

      // Si tocas el mismo, deselecciona
      if (selectedItem === itemDiv) {
        clearSelectedOrderingItem();
        return;
      }

      // Segundo ítem: hacer swap
      const first = selectedItem;
      const second = itemDiv;

      clearSelectedOrderingItem();
      swapItems(first, second);
    });

    list.appendChild(itemDiv);
  });

  wrapper.appendChild(list);

  // Botón verificar
  const btnVerify = document.createElement('button');
  btnVerify.textContent = 'Verificar Orden';
  btnVerify.style.cssText = `
    width: 100%;
    padding: 1.25rem;
    margin-top: 1.5rem;
    background: linear-gradient(135deg, #4DABF7, #74c0fc);
    color: white;
    border: none;
    border-radius: 16px;
    font-size: 1.2rem;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.3s;
    box-shadow: 0 6px 20px rgba(77, 171, 247, 0.3);
  `;

  btnVerify.addEventListener('mouseenter', () => {
    btnVerify.style.transform = 'translateY(-2px)';
    btnVerify.style.boxShadow = '0 8px 24px rgba(77, 171, 247, 0.4)';
  });

  btnVerify.addEventListener('mouseleave', () => {
    btnVerify.style.transform = '';
    btnVerify.style.boxShadow = '0 6px 20px rgba(77, 171, 247, 0.3)';
  });

  btnVerify.addEventListener('click', () => {
    console.log('🔍 [ORDERING] Verificando orden...');

    const currentOrder = Array.from(
      list.querySelectorAll('.ordering-item')
    ).map((el) => el.dataset.itemId);

    console.log('📊 [ORDERING] Orden actual:', currentOrder);
    console.log('✅ [ORDERING] Orden correcto:', correctOrder);

    const isCorrect = currentOrder.every((id, idx) => id === correctOrder[idx]);

    if (isCorrect) {
      console.log('✅ [ORDERING] ¡Orden correcto!');
      playSound('success');

      list.querySelectorAll('.ordering-item').forEach((itemEl) => {
        itemEl.classList.add('correct');
        itemEl.draggable = false;
        itemEl.style.cssText += `
          background: linear-gradient(135deg, #51CF66, #8ce99a) !important;
          border-color: #51CF66 !important;
          animation: celebrate 0.7s ease-out;
          box-shadow: 0 12px 32px rgba(81, 207, 102, 0.5) !important;
          cursor: default !important;
        `;
        itemEl.style.color = 'white';
        const text = itemEl.querySelector('.ordering-text');
        if (text) text.style.color = 'white';
        const number = itemEl.querySelector('.ordering-number');
        if (number) {
          number.style.background = 'white';
          number.style.color = '#51CF66';
        }
      });

      btnVerify.disabled = true;
      btnVerify.style.opacity = '0.5';
      btnVerify.style.cursor = 'not-allowed';

      setTimeout(() => finish(), 1500);
      playSound('complete');
    } else {
      console.log('❌ [ORDERING] Orden incorrecto');
      playSound('error');

      list.style.animation = 'wiggle 0.5s ease-out';
      setTimeout(() => {
        list.style.animation = '';
      }, 500);

      // Mostrar mensaje de error
      const errorMsg = document.createElement('div');
      errorMsg.style.cssText = `
        margin-top: 1rem;
        padding: 1rem;
        background: linear-gradient(135deg, #ff6b6b, #ff8787);
        color: white;
        border-radius: 12px;
        text-align: center;
        font-weight: 700;
        animation: bounce-in 0.5s ease-out;
      `;
      errorMsg.textContent = '❌ El orden no es correcto. Intenta de nuevo.';

      const existing = wrapper.querySelector('.error-msg');
      if (existing) existing.remove();

      errorMsg.className = 'error-msg';
      wrapper.appendChild(errorMsg);

      setTimeout(() => {
        errorMsg.remove();
      }, 3000);
    }
  });

  wrapper.appendChild(btnVerify);
  host.appendChild(wrapper);

  function updateNumbers() {
    const allItems = list.querySelectorAll('.ordering-item');
    allItems.forEach((itemEl, idx) => {
      const numberEl = itemEl.querySelector('.ordering-number');
      if (numberEl) {
        numberEl.textContent = idx + 1;
      }
    });
  }

  function finish() {
    console.log('🏁 [ORDERING] Juego completado');

    wrapper.innerHTML = `
      <div style="text-align: center; padding: 3rem 1.5rem; background: white; border-radius: 20px; box-shadow: 0 8px 24px rgba(0,0,0,0.1);">
        <div style="font-size: 4rem; margin-bottom: 1rem;">🎉</div>
        <h3 style="font-size: 2rem; font-weight: 800; color: #2c3e50; margin-bottom: 1rem;">
          ¡Excelente!
        </h3>
        <div style="font-size: 1.3rem; font-weight: 700; color: #51CF66;">
          Orden correcto
        </div>
      </div>
    `;

    host.dataset.gameComplete = 'true';
    host.dataset.gameScore = '1';
    host.dataset.gameCorrect = items.length;
    host.dataset.gameTotal = items.length;

    console.log('✅ [ORDERING] Marcado como completado');
  }

  console.log('✅ Ordering renderizado');
  host.dataset.gameRendered = 'true';
  return wrapper;
}
