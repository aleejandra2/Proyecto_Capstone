export default async function initTrivia(host, cfg = {}) {
  const items = normalizeTrivia(cfg);
  if (!items.length) {
    host.innerHTML = `<div class="alert alert-warning" data-game-rendered>No hay preguntas de trivia.</div>`;
    return false;
  }

  const container = document.createElement('div');
  container.setAttribute('data-game-rendered','1');

  items.forEach((q, idx) => {
    const card = document.createElement('div'); card.className = 'tr-card';
    const h = document.createElement('div'); h.className = 'tr-q'; h.textContent = `${idx+1}. ${q.q}`;
    const opts = document.createElement('div'); opts.className = 'tr-opts';

    let answered = false;
    q.opts.forEach((o, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm btn-outline-secondary me-2 mb-2';
      btn.textContent = o;
      btn.addEventListener('click', () => {
        if (i === q.ans) { btn.classList.replace('btn-outline-secondary', 'btn-success'); }
        else            { btn.classList.replace('btn-outline-secondary', 'btn-danger');  }
        answered = true;
        // si todas las preguntas fueron respondidas al menos una vez, marca completado
        const cards = Array.from(container.querySelectorAll('.tr-card'));
        let correct = 0; let answeredCount = 0;
        const detail = [];
        cards.forEach(c => {
          const sel = c.querySelector('.btn-success, .btn-danger');
          if (sel) {
            answeredCount++;
            const ok = sel.classList.contains('btn-success');
            if (ok) correct++;
            const qi = cards.indexOf(c);
            const qq = items[qi]?.q || '';
            const corrIdx = items[qi]?.ans ?? 0;
            const corrText = items[qi]?.opts?.[corrIdx] || '';
            detail.push({ q: qq, selected: sel.textContent, correct: corrText, ok });
          }
        });
        const host = container.closest('.game-host');
        if (host) {
          host.dataset.gameScore = String(correct / Math.max(1, items.length));
          host.dataset.gameCorrect = String(correct);
          host.dataset.gameTotal = String(items.length);
          try { host.dataset.gameDetail = JSON.stringify({ qa: detail }); } catch {}
          if (answeredCount >= items.length) host.dataset.gameComplete = '1';
        }
      });
      opts.appendChild(btn);
    });

    card.append(h, opts); container.appendChild(card);
  });

  host.innerHTML = ''; host.appendChild(container);
  return true;
}

function normalizeTrivia(cfg) {
  // 1) Array de objetos {q, opts, ans}
  if (Array.isArray(cfg.trivia))    return cfg.trivia;
  if (Array.isArray(cfg.questions)) return cfg.questions;
  if (Array.isArray(cfg.items)) {
    // Admite {pregunta, opciones, correcta} o {q,opts,ans}
    const out = cfg.items.map(it => {
      const q   = it.q ?? it.pregunta ?? it.question ?? '';
      let opts  = it.opts ?? it.opciones ?? it.answers ?? [];
      let ans   = it.ans ?? it.correcta ?? it.correctIndex;
      if (typeof opts === 'string') {
        opts = opts.split('|').map(s=>s.trim()).filter(Boolean);
      }
      if (typeof ans === 'string') {
        // "A"/"B"/"1" etc.
        const m = ans.trim().toUpperCase();
        if (/^[A-F]$/.test(m)) ans = m.charCodeAt(0) - 65;
        else ans = parseInt(m,10) || 0;
      }
      return { q, opts, ans: Number(ans) || 0 };
    }).filter(x => x.q && Array.isArray(x.opts) && x.opts.length >= 2);
    if (out.length) return out;
  }

  // 2) Texto con asterisco: "Pregunta? | op1 | op2* | op3"
  const text = cfg.text || cfg.game_pairs || '';
  if (typeof text === 'string') {
    const out = [];
    text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).forEach(line => {
      const parts = line.split('|').map(s=>s.trim()).filter(Boolean);
      if (parts.length < 3) return;
      const q = parts[0];
      const rest = parts.slice(1);
      let ans = 0;
      const opts = rest.map((t,i) => {
        if (/\*$/.test(t)) { ans = i; return t.replace(/\*$/, ''); }
        return t;
      });
      out.push({ q, opts, ans });
    });
    return out;
  }
  return [];
}
