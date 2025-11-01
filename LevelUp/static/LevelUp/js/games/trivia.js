// trivia.js — Trivia con efectos visuales y SFX
export default async function initTrivia(host, cfg = {}) {
  const qlist = Array.isArray(cfg.trivia) ? cfg.trivia : normalizeText(cfg.text || cfg.game_pairs || "");
  if (!qlist.length) {
    host.innerHTML = `<div class="alert alert-warning" data-game-rendered>No hay preguntas.</div>`;
    return false;
  }

  // --- SFX (WebAudio, sin assets) ---
  const sfx = createSfx(cfg.sfx !== false);

  // --- UI shell ---
  host.innerHTML = "";
  host.dataset.gameComplete = "false";
  host.setAttribute("data-game-rendered", "1");

  const theme = (cfg.theme || "ink").toLowerCase();

  const card = el("div", "lv-card tr-card");
  const header = el("div", "d-flex align-items-center justify-content-between mb-2");
  const prog = el("div", "progress flex-grow-1 me-3", `<div class="progress-bar" style="width:0%"></div>`);
  const timeBox = el("div", "badge text-bg-secondary", `<span class="me-1">⏱</span><span id="tr-timer">--</span>`);
  header.appendChild(prog); header.appendChild(timeBox);

  const qEl = el("div", "tr-q h6 mb-2");
  const opts = el("div", "tr-opts d-flex flex-wrap");

  const toolbar = el("div", "d-flex align-items-center justify-content-between mt-3");
  const livesBox = el("div", "tr-lives");
  const soundBtn = el("button", "btn btn-sm btn-outline-secondary", "🔊");
  soundBtn.type = "button"; soundBtn.title = "Sonido on/off";
  soundBtn.addEventListener("click", () => { sfx.enabled = !sfx.enabled; soundBtn.classList.toggle("opacity-50", !sfx.enabled); });
  toolbar.appendChild(livesBox); toolbar.appendChild(soundBtn);

  card.appendChild(header);
  card.appendChild(qEl);
  card.appendChild(opts);
  card.appendChild(toolbar);
  host.appendChild(card);

  // State
  let i = 0, correct = 0, hearts = typeof cfg.hearts === "number" ? cfg.hearts : 3;
  let t = Math.max(5, Number(cfg.timeLimit || cfg.time_limit || 0) || 0);
  let it = null;

  renderLives();
  next();

  function next() {
    if (i >= qlist.length) return finish();
    const q = qlist[i];
    qEl.textContent = q.q || q.text || `Pregunta ${i + 1}`;
    opts.innerHTML = "";
    const all = (q.opts || q.options || []).map(String);
    const ans = Number(q.ans || q.correct || 0);
    all.forEach((txt, idx) => {
      const b = el("button", "btn btn-light me-2 mb-2 tr-opt", escapeHtml(txt));
      b.type = "button";
      b.addEventListener("click", () => choose(idx, ans, b));
      b.addEventListener("keyup", (ev) => { if (ev.key === "Enter" || ev.key === " ") choose(idx, ans, b); });
      opts.appendChild(b);
    });
    const onKey = (ev) => {
      const n = parseInt(ev.key, 10);
      if (!isNaN(n) && n >= 1 && n <= all.length) {
        const b = opts.children[n - 1]; if (b) b.click();
      }
    };
    document.addEventListener("keydown", onKey, { once: true });

    clearInterval(it);
    if (t > 0) {
      let left = t;
      timeBox.querySelector("#tr-timer").textContent = `${left}s`;
      it = setInterval(() => {
        left--;
        timeBox.querySelector("#tr-timer").textContent = `${Math.max(0, left)}s`;
        if (left <= 0) {
          clearInterval(it);
          shake(card);
          sfx.bad();
          hearts--; renderLives();
          i++; updateProg(); next();
        }
      }, 1000);
    } else {
      timeBox.querySelector("#tr-timer").textContent = "∞";
    }
  }

  function choose(idx, ans, btn) {
    clearInterval(it);
    disableAll();
    if (idx === ans) {
      btn.classList.add("btn-success", "glow-ok");
      sfx.ok();
      correct++;
    } else {
      btn.classList.add("btn-danger", "glow-bad");
      const ok = opts.children[ans]; ok && ok.classList.add("btn-success", "flash");
      sfx.bad();
      hearts--; renderLives();
    }
    i++; updateProg();
    setTimeout(next, 700);
  }

  function disableAll() { opts.querySelectorAll("button").forEach(b => b.disabled = true); }
  function updateProg() {
    const pct = Math.round((i / qlist.length) * 100);
    prog.querySelector(".progress-bar").style.width = pct + "%";
  }
  function renderLives() {
    livesBox.innerHTML = "";
    for (let k = 0; k < Math.max(0, hearts); k++) livesBox.appendChild(el("span", "mx-1", "❤️"));
    for (let k = hearts; k < 3; k++) livesBox.appendChild(el("span", "mx-1 text-muted", "🤍"));
    if (hearts <= 0) { // reinicio parcial
      hearts = typeof cfg.hearts === "number" ? cfg.hearts : 3;
      i = Math.max(0, i - 2); // retrocede 2
    }
  }

  function finish() {
    host.dataset.gameComplete = "true";
    const score = correct / qlist.length;
    host.dataset.gameCorrect = String(correct);
    host.dataset.gameTotal = String(qlist.length);
    host.dataset.gameScore = String(score.toFixed(4));
    sfx.win(); confetti(host);
    card.innerHTML = `
      <div class="text-center py-4">
        <div class="display-6 mb-2">¡Listo!</div>
        <div class="lead mb-3">Aciertos: <b>${correct}</b> / ${qlist.length}</div>
        <div class="progress mb-3"><div class="progress-bar bg-success" style="width:${Math.round(score * 100)}%"></div></div>
        <button type="button" class="btn btn-primary" data-retry>Reintentar</button>
      </div>`;
    card.querySelector("[data-retry]").addEventListener("click", () => { i = 0; correct = 0; updateProg(); next(); });
  }

  // ---------- helpers ----------
  function confetti(root) {
    const wrap = el("div", "confetti-wrap");
    root.appendChild(wrap);
    for (let k = 0; k < 80; k++) {
      const p = el("i", "confetti");
      p.style.setProperty("--tx", (Math.random() * 200 - 100).toFixed(0));
      p.style.setProperty("--d", (0.6 + Math.random() * 0.8).toFixed(2) + "s");
      p.style.left = (10 + Math.random() * 80).toFixed(0) + "%";
      wrap.appendChild(p);
    }
    setTimeout(() => wrap.remove(), 1200);
  }
  function shake(node) { node.classList.add("shake"); setTimeout(() => node.classList.remove("shake"), 300); }
  function el(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
  function normalizeText(text) {
    const out = []; (text || "").split(/\r?\n/).forEach(ln => {
      ln = (ln || "").trim(); if (!ln) return;
      const parts = ln.split("|").map(s => (s || "").trim()).filter(Boolean);
      if (parts.length < 3) return;
      let ans = 0; const q = parts[0], opts = parts.slice(1).map((t, i) => { if (/\*$/.test(t)) { ans = i; return t.replace(/\*$/, "").trim(); } return t; });
      out.push({ q, opts, ans });
    }); return out;
  }
  function createSfx(enabled = true) {
    let ctx = null;
    function beep(freq = 440, dur = 0.12, type = "sine", gain = 0.05) {
      if (!enabled) return;
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.value = freq; g.gain.value = gain;
        o.connect(g); g.connect(ctx.destination);
        o.start(); o.stop(ctx.currentTime + dur);
      } catch { }
    }
    const api = {
      get enabled() { return enabled; }, set enabled(v) { enabled = !!v; },
      ok() { beep(760, .10, "sine", .07); },
      bad() { beep(180, .18, "sawtooth", .07); },
      win() { [660, 880, 990].forEach((f, i) => setTimeout(() => beep(f, .10, "sine", .09), i * 120)); },
    };
    return api;
  }
}
