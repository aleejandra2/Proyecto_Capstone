// classify.js — Clasificación con DnD + menú "Enviar a…"
export default async function initClassify(host, cfg = {}) {
  const { bins, items } = getData(cfg);
  if (!bins.length || !items.length) {
    host.innerHTML = `<div class="alert alert-warning" data-game-rendered>Faltan ítems o canastas.</div>`;
    return false;
  }

  const sfx = createSfx(cfg.sfx !== false);

  host.innerHTML = "";
  host.dataset.gameComplete = "false";
  host.setAttribute("data-game-rendered", "1");

  const wrap = el("div", "lv-card classify-board");
  const left = el("div", "classify-pool");
  const right = el("div", "classify-bins");
  wrap.appendChild(left); wrap.appendChild(right);
  host.appendChild(wrap);

  // build bins
  const binEls = bins.map((b, i) => {
    const box = el("div", "classify-bin", `<div class="bin-title">${escapeHtml(b.title)}</div><div class="bin-drop" data-bin="${b.id}"></div>`);
    right.appendChild(box);
    const drop = box.querySelector(".bin-drop");
    drop.addEventListener("dragover", ev => { ev.preventDefault(); drop.classList.add("over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("over"));
    drop.addEventListener("drop", ev => {
      ev.preventDefault(); drop.classList.remove("over");
      const chip = left.querySelector(".classify-chip.dragging") || document.querySelector(".classify-chip.dragging");
      chip && drop.appendChild(chip);
      sfx.flip(); checkPartial();
    });
    return drop;
  });

  // build chips
  shuffle(items.slice()).forEach(it => {
    const chip = el("button", "classify-chip btn btn-light btn-sm", escapeHtml(it.text));
    chip.type = "button"; chip.draggable = true; chip.dataset.id = it.id; chip.dataset.bin = it.bin;
    chip.addEventListener("dragstart", () => { chip.classList.add("dragging"); sfx.flip(); });
    chip.addEventListener("dragend", () => chip.classList.remove("dragging"));
    chip.addEventListener("click", () => {
      // Accesibilidad: menú "Enviar a…"
      const names = bins.map((b, idx) => `${idx + 1}) ${b.title}`).join("\n");
      const pick = window.prompt(`Enviar a…\n${names}\n(Número)`);
      const idx = Number(pick) - 1;
      if (!isNaN(idx) && idx >= 0 && idx < binEls.length) {
        binEls[idx].appendChild(chip); sfx.flip(); checkPartial();
      }
    });
    left.appendChild(chip);
  });

  const checkBtn = el("button", "btn btn-primary btn-sm mt-2", "Corregir");
  left.appendChild(checkBtn);

  checkBtn.addEventListener("click", () => {
    let correct = 0, total = items.length;
    document.querySelectorAll(".bin-drop").forEach(drop => {
      const binId = drop.dataset.bin;
      drop.querySelectorAll(".classify-chip").forEach(ch => {
        const ok = (ch.dataset.bin === binId);
        ch.classList.toggle("ok", ok);
        ch.classList.toggle("bad", !ok);
        if (ok) correct++;
      });
    });
    host.dataset.gameComplete = "true";
    host.dataset.gameCorrect = String(correct);
    host.dataset.gameTotal = String(total);
    host.dataset.gameScore = String((correct / total).toFixed(4));
    if (correct === total) { sfx.ok(); confetti(host); } else sfx.bad();
  });

  function checkPartial() {
    // Pinta solo el porcentaje en título (feedback suave)
    document.querySelectorAll(".classify-bin").forEach(box => {
      const drop = box.querySelector(".bin-drop");
      const binId = drop.dataset.bin;
      const chips = Array.from(drop.querySelectorAll(".classify-chip"));
      if (!chips.length) { box.style.setProperty("--pct", "0%"); return; }
      const ok = chips.filter(c => c.dataset.bin === binId).length;
      const pct = Math.round((ok / chips.length) * 100);
      box.style.setProperty("--pct", pct + "%");
    });
  }

  // helpers
  function getData(cfg) {
    // Preferir estructuras explícitas
    if (Array.isArray(cfg.bins) && Array.isArray(cfg.items) && cfg.bins.length && cfg.items.length) {
      return {
        bins: cfg.bins.map(b => ({ id: String(b.id ?? b.value ?? b.key ?? b.title), title: String(b.title ?? b.name ?? b.id) })),
        items: cfg.items.map((it, idx) => ({ id: String(it.id ?? idx), text: String(it.text ?? it.label ?? it.left ?? it.term), bin: String(it.bin ?? it.to) }))
      };
    }
    // Texto: "item | bin"
    const outBins = new Map(); const outItems = [];
    (String(cfg.text || cfg.game_pairs || "")).split(/\r?\n/).forEach((ln, i) => {
      ln = (ln || "").trim(); if (!ln) return;
      const p = ln.split("|").map(s => s.trim());
      if (p.length >= 2) {
        const item = p[0], binName = p[1];
        if (!outBins.has(binName)) outBins.set(binName, { id: binName, title: binName });
        outItems.push({ id: "i" + i, text: item, bin: binName });
      }
    });
    return { bins: Array.from(outBins.values()), items: outItems };
  }
  function shuffle(a) { return a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]); }
  function el(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
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
      flip() { beep(400, .07, "triangle", .04); }, ok() { beep(760, .10, "sine", .07); }, bad() { beep(180, .18, "sawtooth", .07); }
    };
  }
}
