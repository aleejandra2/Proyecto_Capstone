// cloze.js — Rellenar huecos con banco de opciones, drag & drop y SFX
export default async function initCloze(host, cfg = {}) {
  const text = String(cfg.text || cfg.cloze || cfg.game_pairs || "").trim();
  const bank = Array.isArray(cfg.bank) ? cfg.bank : parseBank(cfg.text || cfg.game_pairs || "");
  if (!text) {
    host.innerHTML = `<div class="alert alert-warning" data-game-rendered>Falta el texto con [huecos].</div>`;
    return false;
  }
  const sfx = createSfx(cfg.sfx !== false);

  // parse: [palabra] hueco
  const tokens = []; const holes = [];
  text.split(/(\[[^\]]+\])/g).forEach(tok => {
    if (/^\[[^\]]+\]$/.test(tok)) {
      const ans = tok.slice(1, -1).trim();
      const id = holes.length;
      holes.push(ans);
      tokens.push({ type: "hole", id, ans });
    } else {
      if (tok) tokens.push({ type: "text", text: tok });
    }
  });

  const options = unique(bank.concat(holes)).filter(Boolean);
  shuffle(options);

  host.innerHTML = "";
  host.dataset.gameComplete = "false";
  host.setAttribute("data-game-rendered", "1");

  const wrap = el("div", "cloze-wrap");
  const p = el("p", "cloze-text");
  tokens.forEach(t => {
    if (t.type === "text") p.appendChild(document.createTextNode(t.text));
    else {
      const s = el("span", "cloze-hole", "_____"); s.dataset.id = String(t.id);
      s.dataset.ans = t.ans;
      s.addEventListener("dragover", ev => { ev.preventDefault(); s.classList.add("over"); });
      s.addEventListener("dragleave", () => s.classList.remove("over"));
      s.addEventListener("drop", ev => {
        ev.preventDefault(); s.classList.remove("over");
        const val = ev.dataTransfer.getData("text/plain");
        s.textContent = val; s.dataset.value = val;
        s.classList.add("filled");
        sfx.flip();
        check();
      });
      p.appendChild(s);
    }
  });

  const bankBox = el("div", "cloze-bank");
  options.forEach(opt => {
    const b = el("button", "btn btn-light btn-sm me-2 mb-2", escapeHtml(opt));
    b.type = "button"; b.draggable = true;
    b.addEventListener("dragstart", ev => {
      b.classList.add("dragging"); ev.dataTransfer.setData("text/plain", opt); sfx.flip();
    });
    b.addEventListener("dragend", () => b.classList.remove("dragging"));
    b.addEventListener("click", () => {
      const hole = wrap.querySelector(".cloze-hole:not(.filled)");
      if (hole) { hole.textContent = opt; hole.dataset.value = opt; hole.classList.add("filled"); sfx.flip(); check(); }
    });
    bankBox.appendChild(b);
  });

  const reset = el("button", "btn btn-outline-secondary btn-sm mt-2", "Limpiar");
  reset.type = "button";
  reset.addEventListener("click", () => {
    wrap.querySelectorAll(".cloze-hole").forEach(h => { h.textContent = "_____"; h.dataset.value = ""; h.classList.remove("filled", "ok", "bad"); });
  });

  wrap.appendChild(p);
  wrap.appendChild(el("div", "small text-muted mt-2", "Arrastra o haz clic para completar los espacios."));
  wrap.appendChild(bankBox);
  wrap.appendChild(reset);
  host.appendChild(wrap);

  function check() {
    const holesEls = Array.from(wrap.querySelectorAll(".cloze-hole"));
    let correct = 0;
    holesEls.forEach(h => {
      const ok = (h.dataset.value || "").trim().toLowerCase() === (h.dataset.ans || "").trim().toLowerCase();
      h.classList.toggle("ok", ok);
      h.classList.toggle("bad", h.classList.contains("filled") && !ok);
      if (ok) correct++;
    });
    if (correct === holesEls.length) {
      host.dataset.gameComplete = "true";
      host.dataset.gameCorrect = String(correct);
      host.dataset.gameTotal = String(holesEls.length);
      host.dataset.gameScore = "1";
      sfx.ok(); confetti(host);
    }
  }

  // helpers
  function unique(arr) { return Array.from(new Set(arr)); }
  function parseBank(text) {
    const out = []; (text || "").split(/\r?\n/).forEach(ln => { ln = (ln || "").trim(); if (!ln) return; const p = ln.split("|").map(s => s.trim()); if (p.length >= 2) { out.push(p[0]); out.push(p[1]); } });
    return out;
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
}
