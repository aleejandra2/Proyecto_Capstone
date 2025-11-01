// memory.js — Memoria con flip 3D, brillo y SFX
export default async function initMemory(host, cfg = {}) {
  const pairs = normalizePairs(cfg);
  if (!pairs.length) {
    host.innerHTML = `<div class="alert alert-warning" data-game-rendered>No hay pares.</div>`;
    return false;
  }

  const sfx = createSfx(cfg.sfx !== false);

  host.innerHTML = "";
  host.dataset.gameComplete = "false";
  host.setAttribute("data-game-rendered", "1");

  const board = el("div", "game-board");
  host.appendChild(board);

  const cards = [];
  pairs.forEach(([a, b], k) => {
    cards.push(makeCard(a, k));
    cards.push(makeCard(b, k));
  });
  shuffle(cards).forEach(c => board.appendChild(c.el));

  let sel = [];
  let solved = 0;

  board.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".game-card");
    if (!btn) return;
    const card = cards.find(c => c.el === btn);
    if (!card || card.solved || card.flipped) return;
    flip(card);
  });

  function flip(card) {
    sfx.flip();
    card.flip(true);
    sel.push(card);
    if (sel.length === 2) {
      const [c1, c2] = sel;
      if (c1.pair === c2.pair) {
        c1.solved = c2.solved = true;
        c1.el.classList.add("ok", "glow-ok");
        c2.el.classList.add("ok", "glow-ok");
        sfx.ok();
        solved++;
        sel = [];
        if (solved === pairs.length) finish();
      } else {
        sfx.bad();
        c1.el.classList.add("glow-bad"); c2.el.classList.add("glow-bad");
        setTimeout(() => { c1.el.classList.remove("glow-bad"); c2.el.classList.remove("glow-bad"); }, 250);
        setTimeout(() => { c1.flip(false); c2.flip(false); sel = []; }, 520);
      }
    }
  }

  function finish() {
    host.dataset.gameComplete = "true";
    host.dataset.gameCorrect = String(pairs.length);
    host.dataset.gameTotal = String(pairs.length);
    host.dataset.gameScore = "1";
    confetti(host); sfx.win();
  }

  // ------- helpers -------
  function makeCard(text, pair) {
    const elBtn = document.createElement("button");
    elBtn.type = "button";
    elBtn.className = "game-card";
    const isImg = isImgToken(text);
    const back = isImg ? `<img src="${isImg}" alt="img" style="max-width:100%;max-height:100%;object-fit:contain">` : escapeHtml(text);
    elBtn.innerHTML = `<span class="front">?</span><span class="back">${back}</span>`;
    let flipped = false;
    const api = {
      el: elBtn, pair, solved: false,
      get flipped() { return flipped; },
      flip(on) { flipped = !!on; elBtn.classList.toggle("flipped", flipped); }
    };
    return api;
  }
  function isImgToken(t) { const s = String(t || "").trim(); if (/^https?:\/\//.test(s)) return s; if (/\.(png|jpg|jpeg|gif|webp)$/i.test(s)) return s; return null; }
  function shuffle(a) { return a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]); }
  function el(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
  function confetti(root) {
    const wrap = el("div", "confetti-wrap"); root.appendChild(wrap);
    for (let k = 0; k < 60; k++) { const p = el("i", "confetti"); p.style.setProperty("--tx", (Math.random() * 200 - 100).toFixed(0)); p.style.setProperty("--d", (0.6 + Math.random() * 0.8).toFixed(2) + "s"); p.style.left = (10 + Math.random() * 80).toFixed(0) + "%"; wrap.appendChild(p); }
    setTimeout(() => wrap.remove(), 1200);
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
    return {
      get enabled() { return enabled; }, set enabled(v) { enabled = !!v; },
      flip() { beep(400, .07, "triangle", .04); },
      ok() { beep(760, .10, "sine", .07); },
      bad() { beep(180, .18, "sawtooth", .07); },
      win() { [660, 880, 990].forEach((f, i) => setTimeout(() => beep(f, .10, "sine", .09), i * 120)); },
    };
  }

  function normalizePairs(cfg) {
    if (Array.isArray(cfg.pairs) && cfg.pairs.length) return cfg.pairs;
    if (Array.isArray(cfg.items) && cfg.items.length) {
      const out = cfg.items.map(it => [it.a || it.left || it.term || "", it.b || it.right || it.def || ""]).filter(p => p[0] && p[1]);
      if (out.length) return out;
    }
    const text = cfg.text || cfg.game_pairs || cfg.pairsRaw || "";
    if (typeof text === "string") {
      return text.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
        .map(ln => ln.split("|").map(s => s.trim())).filter(p => p.length >= 2).map(p => [p[0], p[1]]);
    }
    return [];
  }
}
