console.log('[core.js] ✅ Módulo cargado');

export function getCSRF() {
  const m = document.cookie.match(/csrftoken=([^;]+)/);
  return m ? m[1] : "";
}

export async function postAnswer(actividadId, itemId, payload = {}) {
  console.log(`[core.js] 💾 Guardando respuesta - Item ${itemId}`, payload);
  const res = await fetch(`/api/actividades/${actividadId}/answer/${itemId}/`, {
    method: "POST",
    headers: { "X-CSRFToken": getCSRF(), "Content-Type": "application/json" },
    body: JSON.stringify({ payload })
  });
  if (!res.ok) {
    console.error('[core.js] ❌ Error guardando respuesta:', res.status);
    throw new Error("Fallo guardando respuesta");
  }
  const data = await res.json();
  console.log('[core.js] ✅ Respuesta guardada:', data);
  return data;
}

export function shuffle(a) {
  console.log('[core.js] 🔀 Mezclando array de', a.length, 'elementos');
  return a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
}

// Función para reproducir sonidos
export function playSound(type) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  switch (type) {
    case 'success':
      // Sonido alegre ascendente
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
      break;

    case 'error':
      // Sonido grave descendente
      oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(150, audioContext.currentTime + 0.15);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
      break;

    case 'complete':
      // Fanfarria de victoria
      const notes = [523.25, 587.33, 659.25, 783.99, 880.00];
      notes.forEach((freq, i) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.setValueAtTime(freq, audioContext.currentTime + i * 0.1);
        gain.gain.setValueAtTime(0.2, audioContext.currentTime + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.1 + 0.3);
        osc.start(audioContext.currentTime + i * 0.1);
        osc.stop(audioContext.currentTime + i * 0.1 + 0.3);
      });
      break;
  }
}

// Header simplificado - sin avatar ni nivel
export function header(root, title, timeStart = 90) {
  console.log('[core.js] 📋 Header simplificado (sin avatar)');
  return {
    setBar: (p) => { },
    bump: () => { }
  };
}

// Verificar que el CSS de games esté cargado
document.addEventListener('DOMContentLoaded', () => {
  console.log('[core.js] 🎨 Verificando carga de CSS...');
  const testDiv = document.createElement('div');
  testDiv.className = 'tr-opt';
  testDiv.style.display = 'none';
  document.body.appendChild(testDiv);

  const styles = window.getComputedStyle(testDiv);
  const borderRadius = styles.borderRadius;

  if (borderRadius && borderRadius !== '0px') {
    console.log('[core.js] ✅ CSS de games.css cargado correctamente');
    console.log('[core.js] 📏 Border radius de .tr-opt:', borderRadius);
  } else {
    console.warn('[core.js] ⚠️ CSS de games.css NO se cargó correctamente');
    console.warn('[core.js] 💡 Verifica que games.css esté en LevelUp/css/games.css');
  }

  document.body.removeChild(testDiv);
});