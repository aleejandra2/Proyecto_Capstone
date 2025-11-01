// ordering.js — Ordena pasos/cronologías (parcial por adyacencias)
export default async function initOrdering(host, cfg = {}) {
  const items = getItems(cfg);
  if (!items.length) {
    host.innerHTML = `<div class="alert alert-warning" data-game-rendered>No hay elementos para ordenar.</div>`;
    return false;
  }

  const sfx = createSfx(cfg.sfx !== false);

  host.innerHTML = "";
  host.dataset.gameComplete = "false";
  host.setAttribute("data-game-rendered", "1");

  const wrap = el("div", "lv-card ord-wrap");
  const head = el("div", "d-flex align-items-center justify-content-between mb-2");
  const help = el("div", "small text-muted", "Arrastra con la manilla ⠿ o usa ↑/↓ con el foco.");
  const checkBtn = el("button", "btn btn-primary btn-sm", "Verificar");
  head.appendChild(help); head.appendChild(checkBtn);

  const list = el("ul", "ord-list");
  const correctOrder = items.slice(); // referencia
  const shuffled = shuffle(items.slice());
  shuffled.forEach((t, i) => list.appendChild(makeItem(t, i)));

  wrap.appendChild(head);
  wrap.appendChild(list);
  host.appendChild(wrap);

  // DnD
  let dragging = null;
  list.addEventListener("dragstart", (e) => {
    const li = e.target.closest(".ord-item");
    if (!li) return;
    dragging = li;
    sfx.flip();
    li.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  });
  list.addEventListener("dragend", () => { dragging?.classList.remove("dragging"); dragging = null; });
  list.addEventListener("dragover", (e) => {
    e.preventDefault();
    const li = e.target.closest(".ord-item");
    if (!li || !dragging || li === dragging) return;
    const rect = li.getBoundingClientRect();
    const after = (e.clientY - rect.top) / rect.height > .5;
    li.parentNode.insertBefore(dragging, after ? li.nextSibling : li);
  });

  // Teclado mover ↑/↓
  list.addEventListener("keydown", (e) => {
    const li = e.target.closest(".ord-item");
    if (!li) return;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      li.previousElementSibling && li.parentNode.insertBefore(li, li.previousElementSibling);
      sfx.flip();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      li.nextElementSibling && li.parentNode.insertBefore(li.nextElementSibling, li);
      sfx.flip();
    }
  });

  checkBtn.addEventListener("click", () => {
    const curr = Array.from(list.querySelectorAll(".ord-item")).map(li => li.dataset.val);
    // exactos
    let exact = 0;
    for (let i = 0; i < curr.length; i++) if (curr[i] === correctOrder[i]) exact++;
    // adyacencias correctas
    const pos = Object.create(null);
    correctOrder.forEach((v, idx) => pos[v] = idx);
    let adj = 0;
    for (let i = 0; i < curr.length - 1; i++) {
      const a = pos[curr[i]], b = pos[curr[i + 1]];
      if (a != null && b === a + 1) adj++;
    }
    const n = curr.length;
    const score = 0.7 * (exact / n) + 0.3 * (n > 1 ? adj / (n - 1) : 1);

    // pintar feedback
    Array.from(list.children).forEach((li, idx) => {
      li.classList.toggle("ok", li.dataset.val === correctOrder[idx]);
      li.classList.toggle("bad", li.dataset.val !== correctOrder[idx]);
    });

    host.dataset.gameComplete = "true";
    host.dataset.gameCorrect = String(exact);
    host.dataset.gameTotal = String(n);
    host.dataset.gameAdj = String(adj);
    host.dataset.gameScore = String(score.toFixed(4));

    if (exact === n) { sfx.ok(); confetti(host); }
    else sfx.bad();
  });

  function makeItem(text, i) {
    const li = el("li", "ord-item", `
      <span class="ord-handle" title="Arrastrar" aria-hidden="true">⠿</span>
      <span class="ord-text">${escapeHtml(text)}</span>
    `);
    li.tabIndex = 0;
    li.draggable = true;
    li.dataset.val = text;
    return li;
  }

  // helpers
  function getItems(cfg) {
    if (Array.isArray(cfg.order) && cfg.order.length) return cfg.order.map(String);
    if (Array.isArray(cfg.items) && cfg.items.length) return cfg.items.map(String);
    const raw = cfg.text || cfg.game_pairs || "";
    const out = []; (raw || "").split(/\r?\n/).forEach(ln => { ln = (ln || "").trim(); if (ln) out.push(ln); });
    return out;
  }
  function shuffle(a) { return a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]); }
  function el(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
  function confetti(root) { const wrap = el("div", "confetti-wrap"); root.appendChild(wrap); for (let k = 0; k < 70; k++) { const p = el("i", "confetti"); p.style.setProperty("--tx", (Math.random() * 200 - 100).toFixed(0)); p.style.setProperty("--d", (0.6 + Math.random() * 0.8).toFixed(2) + "s"); p.style.left = (10 + Math.random() * 80).toFixed(0) + "%"; wrap.appendChild(p); } setTimeout(() => wrap.remove(), 1200); }
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
      flip() { beep(420, .06, "triangle", .04); }, ok() { beep(820, .10, "sine", .07); }, bad() { beep(180, .18, "sawtooth", .07); }
    };
  }
}
