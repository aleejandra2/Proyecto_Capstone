// dragmatch.js — Arrastrar y soltar con resaltado y SFX
export default async function initDragMatch(host, cfg = {}) {
  const pairs = normalizePairs(cfg);
  if (!pairs.length) {
    host.innerHTML = `<div class="alert alert-warning" data-game-rendered>Faltan pares para arrastrar.</div>`;
    return false;
  }
  const sfx = createSfx(cfg.sfx !== false);

  host.innerHTML = "";
  host.dataset.gameComplete = "false";
  host.setAttribute("data-game-rendered", "1");

  const wrap = el("div", "lv-card");
  const board = el("div", "dm-board");
  wrap.appendChild(board);
  host.appendChild(wrap);

  const leftCol = el("div", "dm-col");
  const rightCol = el("div", "dm-col");
  board.appendChild(leftCol); board.appendChild(rightCol);

  // build targets on right
  const targets = pairs.map(([, b], idx) => {
    const t = el("div", "dm-target", `<div class="dm-slot" data-idx="${idx}"></div><div class="dm-label">${escapeHtml(b)}</div>`);
    rightCol.appendChild(t);
    return t.querySelector(".dm-slot");
  });

  // build draggable chips from left
  const chips = shuffle(pairs.map(([a, _b], idx) => ({ txt: a, idx })));
  chips.forEach(ch => {
    const c = el("button", "dm-chip btn btn-light btn-sm", escapeHtml(ch.txt));
    c.type = "button"; c.draggable = true; c.dataset.idx = ch.idx;
    c.addEventListener("dragstart", ev => {
      c.classList.add("dragging"); sfx.flip();
      ev.dataTransfer.setData("text/plain", ch.idx);
      setTimeout(() => c.classList.add("opacity-75"), 0);
    });
    c.addEventListener("dragend", () => { c.classList.remove("dragging", "opacity-75"); });
    leftCol.appendChild(c);
  });

  // DnD handlers for slots
  targets.forEach(slot => {
    slot.addEventListener("dragover", (ev) => { ev.preventDefault(); slot.classList.add("dm-slot-over"); });
    slot.addEventListener("dragleave", () => slot.classList.remove("dm-slot-over"));
    slot.addEventListener("drop", (ev) => {
      ev.preventDefault();
      slot.classList.remove("dm-slot-over");
      const idx = Number(ev.dataTransfer.getData("text/plain") || "-1");
      const chip = leftCol.querySelector(`.dm-chip.dragging`) || leftCol.querySelector(`.dm-chip[data-idx="${idx}"]`);
      if (!chip) return;
      snap(chip, slot, idx);
    });
  });

  // Allow returning chips
  leftCol.addEventListener("dragover", ev => { ev.preventDefault(); });
  leftCol.addEventListener("drop", ev => {
    ev.preventDefault();
    const chip = board.querySelector(".dm-chip.dragging");
    chip && leftCol.appendChild(chip);
  });

  function snap(chip, slot, idx) {
    if (slot.querySelector(".dm-chip")) { // one per slot
      shake(slot); sfx.bad(); return;
    }
    slot.appendChild(chip);
    chip.classList.add("dm-chip-in");
    setTimeout(() => chip.classList.remove("dm-chip-in"), 400);
    checkSolved();
  }

  function checkSolved() {
    const placed = Array.from(board.querySelectorAll(".dm-slot")).filter(s => s.querySelector(".dm-chip")).length;
    if (placed < pairs.length) return;
    // scoring
    let correct = 0;
    Array.from(board.querySelectorAll(".dm-slot")).forEach((slot, idx) => {
      const chip = slot.querySelector(".dm-chip");
      const ok = chip && Number(chip.dataset.idx) === idx;
      slot.classList.toggle("ok", !!ok);
      if (ok) correct++;
    });
    host.dataset.gameComplete = "true";
    host.dataset.gameCorrect = String(correct);
    host.dataset.gameTotal = String(pairs.length);
    host.dataset.gameScore = String((correct / pairs.length).toFixed(4));
    if (correct === pairs.length) { sfx.ok(); confetti(host); }
    else sfx.bad();
  }

  function el(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
  function shuffle(a) { return a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]); }
  function confetti(root) { const wrap = el("div", "confetti-wrap"); root.appendChild(wrap); for (let k = 0; k < 60; k++) { const p = el("i", "confetti"); p.style.setProperty("--tx", (Math.random() * 200 - 100).toFixed(0)); p.style.setProperty("--d", (0.6 + Math.random() * 0.8).toFixed(2) + "s"); p.style.left = (10 + Math.random() * 80).toFixed(0) + "%"; wrap.appendChild(p); } setTimeout(() => wrap.remove(), 1200); }
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
    };
  }
  function normalizePairs(cfg) {
    if (Array.isArray(cfg.pairs) && cfg.pairs.length) return cfg.pairs;
    const text = cfg.text || cfg.game_pairs || ""; const out = [];
    (text || "").split(/\r?\n/).forEach(ln => { ln = (ln || "").trim(); if (!ln) return; const p = ln.split("|").map(s => s.trim()); if (p.length >= 2) out.push([p[0], p[1]]); });
    return out;
  }
}
