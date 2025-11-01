// vf.js — V/F con justificación opcional
export default async function initVF(host, cfg = {}) {
  const qlist = getQuestions(cfg);
  if (!qlist.length) {
    host.innerHTML = `<div class="alert alert-warning" data-game-rendered>No hay afirmaciones V/F.</div>`;
    return false;
  }

  const sfx = createSfx(cfg.sfx !== false);

  host.innerHTML = "";
  host.dataset.gameComplete = "false";
  host.setAttribute("data-game-rendered", "1");

  const card = el("div", "lv-card vf-card");
  const head = el("div", "d-flex align-items-center justify-content-between mb-2");
  const prog = el("div", "progress flex-grow-1 me-3", "<div class='progress-bar' style='width:0%'></div>");
  const time = el("div", "badge text-bg-secondary", "⏱ <span id='vf-time'>∞</span>");
  head.appendChild(prog); head.appendChild(time);

  const stmt = el("div", "vf-stmt h6 mb-2");
  const btns = el("div", "d-flex gap-2 mb-2");
  const bTrue = el("button", "btn btn-success btn-lg flex-fill", "Verdadero");
  const bFalse = el("button", "btn btn-danger  btn-lg flex-fill", "Falso");
  bTrue.type = "button"; bFalse.type = "button";
  btns.appendChild(bTrue); btns.appendChild(bFalse);

  const just = el("textarea", "form-control vf-just", ""); just.rows = 2; just.placeholder = "(Opcional) Justifica en una frase…";
  const hint = el("div", "small text-muted mt-1", "La justificación no afecta la corrección automática, pero se guarda para revisión.");

  card.appendChild(head); card.appendChild(stmt); card.appendChild(btns); card.appendChild(just); card.appendChild(hint);
  host.appendChild(card);

  let i = 0, okCount = 0, it = null, limit = Math.max(0, Number(cfg.timeLimit || 0) || 0);

  render(); updateTimer();

  bTrue.addEventListener("click", () => choose(true));
  bFalse.addEventListener("click", () => choose(false));
  document.addEventListener("keydown", (e) => { if (e.key.toLowerCase() === "v") bTrue.click(); if (e.key.toLowerCase() === "f") bFalse.click(); });

  function render() {
    if (i >= qlist.length) return finish();
    const q = qlist[i];
    stmt.textContent = q.text;
    just.value = "";
    btns.querySelectorAll("button").forEach(b => { b.disabled = false; b.classList.remove("glow-ok", "glow-bad"); });
    updateProg();
  }
  function choose(ans) {
    btns.querySelectorAll("button").forEach(b => b.disabled = true);
    clearInterval(it);
    const q = qlist[i];
    const correct = !!q.ans === !!ans;
    (ans ? bTrue : bFalse).classList.add(correct ? "glow-ok" : "glow-bad");
    if (correct) { okCount++; sfx.ok(); } else sfx.bad();
    // guardar justificación (si existe) — disponible para submit externo si quieres leer dataset
    host.dispatchEvent(new CustomEvent("vf:answer", { detail: { index: i, text: q.text, ans, correct, justification: just.value.trim() } }));
    setTimeout(() => { i++; render(); updateTimer(); }, 650);
  }
  function finish() {
    host.dataset.gameComplete = "true";
    host.dataset.gameCorrect = String(okCount);
    host.dataset.gameTotal = String(qlist.length);
    host.dataset.gameScore = String((okCount / qlist.length).toFixed(4));
    confetti(host); sfx.win();
    card.innerHTML += `<div class="text-center mt-3"><div class="lead">Aciertos: <b>${okCount}</b> / ${qlist.length}</div></div>`;
  }
  function updateProg() { prog.querySelector(".progress-bar").style.width = Math.round((i / qlist.length) * 100) + "%"; }
  function updateTimer() {
    clearInterval(it);
    if (!limit) { time.querySelector("#vf-time").textContent = "∞"; return; }
    let left = limit; time.querySelector("#vf-time").textContent = `${left}s`;
    it = setInterval(() => { left--; time.querySelector("#vf-time").textContent = `${Math.max(0, left)}s`; if (left <= 0) { clearInterval(it); choose(null); } }, 1000);
  }

  // helpers
  function getQuestions(cfg) {
    if (Array.isArray(cfg.items) && cfg.items.length) {
      return cfg.items.map(it => ({ text: String(it.text ?? it.q ?? it.statement), ans: parseBool(it.ans ?? it.answer) }));
    }
    const out = []; (String(cfg.text || cfg.game_pairs || "")).split(/\r?\n/).forEach(ln => {
      ln = (ln || "").trim(); if (!ln) return;
      const p = ln.split("|").map(s => s.trim());
      // "Texto | V" o "Texto | F"
      if (p.length >= 2) out.push({ text: p[0], ans: parseBool(p[1]) });
    });
    return out;
  }
  function parseBool(t) { const s = String(t || "").trim().toLowerCase(); return ["v", "verdadero", "true", "t", "1", "sí", "si"].includes(s); }
  function el(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function confetti(root) { const wrap = el("div", "confetti-wrap"); root.appendChild(wrap); for (let k = 0; k < 60; k++) { const p = el("i", "confetti"); p.style.setProperty("--tx", (Math.random() * 200 - 100).toFixed(0)); p.style.setProperty("--d", (0.6 + Math.random() * 0.8).toFixed(2) + "s"); p.style.left = (10 + Math.random() * 80).toFixed(0) + "%"; wrap.appendChild(p); } setTimeout(() => wrap.remove(), 1200); }
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
