// labyrinth.js — Pasillo con puertas (vidas + checkpoints)
export default async function initLabyrinth(host, cfg = {}) {
  const steps = getSteps(cfg);
  if (!steps.length) {
    host.innerHTML = `<div class="alert alert-warning" data-game-rendered>Faltan pasos del laberinto.</div>`;
    return false;
  }

  const sfx = createSfx(cfg.sfx !== false);
  const heartsMax = Number.isFinite(cfg.hearts) ? cfg.hearts : 3;
  const checkpointEvery = Math.max(1, Number(cfg.checkpointEvery || 3));
  const timeLimit = Math.max(0, Number(cfg.timeLimit || 0) || 0);

  host.innerHTML = "";
  host.dataset.gameComplete = "false";
  host.setAttribute("data-game-rendered", "1");

  const wrap = el("div", "lab-wrap lv-card");
  const header = el("div", "lab-header d-flex align-items-center justify-content-between mb-2");
  const lives = el("div", "lab-lives", "");
  const prog = el("div", "progress flex-grow-1 mx-3", "<div class='progress-bar' style='width:0%'></div>");
  const timer = el("div", "badge text-bg-secondary", "⏱ <span id='lab-t'>∞</span>");
  header.appendChild(lives); header.appendChild(prog); header.appendChild(timer);

  const hint = el("div", "lab-hint h6 mb-3");
  const doors = el("div", "lab-doors");
  wrap.appendChild(header); wrap.appendChild(hint); wrap.appendChild(doors);
  host.appendChild(wrap);

  let i = 0, hearts = heartsMax, lastCheckpoint = 0, it = null;

  renderLives(); renderStep(); updateTimer();

  doors.addEventListener("click", (e) => {
    const btn = e.target.closest(".lab-door");
    if (!btn) return;
    choose(Number(btn.dataset.idx) || 0);
  });
  document.addEventListener("keydown", (e) => {
    const n = parseInt(e.key, 10);
    if (!isNaN(n) && n >= 1 && n <= 4) choose(n - 1);
  });

  function renderStep() {
    const s = steps[i];
    hint.textContent = s.q || s.text || `Paso ${i + 1}`;
    doors.innerHTML = "";
    (s.opts || s.options || []).forEach((txt, idx) => {
      const b = el("button", "lab-door", `<span class="lab-door-label">${escapeHtml(txt)}</span><span class="lab-door-icon">🚪</span>`);
      b.type = "button"; b.dataset.idx = String(idx);
      doors.appendChild(b);
    });
    updateProg();
  }

  function choose(idx) {
    clearInterval(it);
    const s = steps[i];
    const ans = Number(s.ans || s.correct || 0);
    const btn = doors.children[idx]; if (!btn) return;
    if (idx === ans) {
      btn.classList.add("ok", "glow-ok");
      sfx.ok();
      i++;
      if (i >= steps.length) return finish();
      setTimeout(() => { renderStep(); updateTimer(); }, 480);
    } else {
      btn.classList.add("bad", "glow-bad");
      sfx.bad();
      hearts--; renderLives();
      if (hearts <= 0) {
        // reinicio parcial
        i = Math.max(0, Math.floor((i) / checkpointEvery) * checkpointEvery);
        hearts = heartsMax;
      }
      setTimeout(() => { renderStep(); updateTimer(); }, 520);
    }
  }

  function updateProg() { prog.querySelector(".progress-bar").style.width = Math.round((i / steps.length) * 100) + "%"; }
  function renderLives() { lives.innerHTML = "❤️".repeat(hearts) + "🤍".repeat(Math.max(0, heartsMax - hearts)); }
  function updateTimer() {
    clearInterval(it);
    if (!timeLimit) { timer.querySelector("#lab-t").textContent = "∞"; return; }
    let left = timeLimit; timer.querySelector("#lab-t").textContent = `${left}s`;
    it = setInterval(() => { left--; timer.querySelector("#lab-t").textContent = `${Math.max(0, left)}s`; if (left <= 0) { clearInterval(it); hearts--; renderLives(); setTimeout(() => { renderStep(); updateTimer(); }, 100); } }, 1000);
  }
  function finish() {
    host.dataset.gameComplete = "true";
    host.dataset.gameCorrect = String(steps.length);
    host.dataset.gameTotal = String(steps.length);
    host.dataset.gameScore = "1";
    confetti(host); sfx.win();
    wrap.insertAdjacentHTML("beforeend", `<div class="text-center mt-3 lead">¡Saliste del laberinto! 🎉</div>`);
  }

  // helpers
  function getSteps(cfg) {
    if (Array.isArray(cfg.steps) && cfg.steps.length) return cfg.steps;
    // Fallback: texto estilo Trivia
    const out = []; (String(cfg.text || cfg.game_pairs || "")).split(/\r?\n/).forEach(ln => {
      ln = (ln || "").trim(); if (!ln) return;
      const parts = ln.split("|").map(s => s.trim()).filter(Boolean);
      if (parts.length >= 3) {
        const q = parts[0]; let ans = 0;
        const opts = parts.slice(1).map((t, i) => { if (/\*$/.test(t)) { ans = i; return t.replace(/\*$/, "").trim(); } return t; });
        out.push({ q, opts, ans });
      }
    });
    return out;
  }
  function el(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
  function confetti(root) { const wrap = el("div", "confetti-wrap"); root.appendChild(wrap); for (let k = 0; k < 80; k++) { const p = el("i", "confetti"); p.style.setProperty("--tx", (Math.random() * 200 - 100).toFixed(0)); p.style.setProperty("--d", (0.6 + Math.random() * 0.8).toFixed(2) + "s"); p.style.left = (10 + Math.random() * 80).toFixed(0) + "%"; wrap.appendChild(p); } setTimeout(() => wrap.remove(), 1200); }
  function createSfx(enabled = true) {
    let ctx = null;
    function beep(freq = 440, dur = 0.12, type = "sine", gain = 0.05) {
      if (!enabled) return;
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.value = freq; g.gain.value = gain; o.connect(g); g.connect(ctx.destination);
        o.start(); o.stop(ctx.currentTime + dur);
      } catch { }
    }
    return {
      get enabled() { return enabled; }, set enabled(v) { enabled = !!v; },
      ok() { beep(760, .10, "sine", .07); }, bad() { beep(180, .18, "sawtooth", .07); }, win() { [660, 880, 990].forEach((f, i) => setTimeout(() => beep(f, .10, "sine", .09), i * 120)); }
    };
  }
}
