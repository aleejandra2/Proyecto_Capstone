// shop.js — Carrito simple con monedas/billetes, total y vuelto
export default async function initShop(host, cfg = {}) {
  const currency = String(cfg.currency || "$");
  const products = getProducts(cfg);
  const denoms = (cfg.accepted_denoms || cfg.denoms || [50, 100, 200, 500, 1000]).map(Number).sort((a, b) => a - b);
  const wallet = Number(cfg.cash || 1000);

  if (!products.length) {
    host.innerHTML = `<div class="alert alert-warning" data-game-rendered>No hay productos configurados.</div>`;
    return false;
  }

  const sfx = createSfx(cfg.sfx !== false);

  host.innerHTML = "";
  host.dataset.gameComplete = "false";
  host.setAttribute("data-game-rendered", "1");

  const wrap = el("div", "lv-card shop");
  const header = el("div", "shop-header d-flex align-items-center justify-content-between mb-2");
  const walletBox = el("div", "wallet", `💰 Monedero: <strong>${fmt(wallet)}</strong>`);
  const meta = el("div", "small text-muted", `<span class="steps">Pasos: <b>0</b></span>`);
  header.appendChild(walletBox); header.appendChild(meta);

  const prods = el("div", "products");
  products.forEach(p => {
    const card = el("div", "product", `
      <div class="pic">${escapeHtml(p.emoji || "🛒")}</div>
      <div class="name">${escapeHtml(p.name)}</div>
      <div class="price">${fmt(p.price)}</div>
      <div class="qty">
        <button class="dec" type="button">−</button>
        <span class="qv">0</span>
        <button class="inc" type="button">+</button>
      </div>
    `);
    card.dataset.id = p.id; card.dataset.price = String(p.price);
    card.querySelector(".inc").addEventListener("click", () => changeQty(card, +1));
    card.querySelector(".dec").addEventListener("click", () => changeQty(card, -1));
    prods.appendChild(card);
  });

  const cart = el("div", "cart", `<ul class="lines"></ul><div class="totals">
    <div>Subtotal: <span class="subtotal">${fmt(0)}</span></div>
    <div>Impuestos: <span class="tax">${fmt(0)}</span></div>
    <div class="total">TOTAL: <strong class="grand">${fmt(0)}</strong></div>
  </div>`);

  const pay = el("div", "pay", "");
  const coins = el("div", "coins");
  denoms.forEach(v => {
    const b = el("button", "coin", fmt(v));
    b.type = "button"; b.dataset.val = String(v);
    b.addEventListener("click", () => { given += v; steps++; sfx.flip(); updatePay(); });
    coins.appendChild(b);
  });
  const givenBox = el("div", "given", `Entregado: <strong class="given-val">${fmt(0)}</strong>`);
  const changeBox = el("div", "change", `Vuelto esperado: <strong class="change-val">${fmt(0)}</strong>`);
  const confirm = el("button", "btn btn-primary confirm", "Confirmar");
  confirm.type = "button";
  pay.appendChild(coins); pay.appendChild(givenBox); pay.appendChild(changeBox); pay.appendChild(confirm);

  wrap.appendChild(header); wrap.appendChild(prods); wrap.appendChild(cart); wrap.appendChild(pay);
  host.appendChild(wrap);

  let steps = 0, given = 0;

  confirm.addEventListener("click", () => {
    const total = getTotal();
    if (given < total) { sfx.bad(); shake(confirm); return; }
    const change = round2(given - total);
    // éxito si el vuelto coincide con operación exacta
    host.dataset.gameComplete = "true";
    host.dataset.gameCorrect = "1";
    host.dataset.gameTotal = "1";
    // Puntaje con penalización por pasos
    const base = Number(cfg.scoring?.base ?? 100);
    const pen = Number(cfg.scoring?.step_penalty ?? 3);
    const score = Math.max(base - (steps * pen), 0);
    host.dataset.gameScore = String((score / base).toFixed(4));
    sfx.ok(); confetti(host);
    confirm.insertAdjacentHTML("afterend", `<div class="small text-muted mt-2">Vuelto: <b>${fmt(change)}</b> — Pasos: <b>${steps}</b></div>`);
  });

  function changeQty(card, delta) {
    const q = Math.max(0, Number(card.querySelector(".qv").textContent) + delta);
    card.querySelector(".qv").textContent = String(q);
    steps++; sfx.flip();
    renderCart(); updatePay();
  }
  function renderCart() {
    const ul = cart.querySelector(".lines");
    ul.innerHTML = "";
    products.forEach(p => {
      const q = getQty(p.id); if (!q) return;
      ul.appendChild(el("li", "", `${escapeHtml(p.name)} ×${q} <span class="line-right">${fmt(q * p.price)}</span>`));
    });
    const total = getTotal();
    cart.querySelector(".subtotal").textContent = fmt(total);
    cart.querySelector(".tax").textContent = fmt(0);
    cart.querySelector(".grand").textContent = fmt(total);
  }
  function updatePay() {
    // tope monedero (opcional)
    if (given > wallet) given = wallet;
    givenBox.querySelector(".given-val").textContent = fmt(given);
    const change = Math.max(0, round2(given - getTotal()));
    changeBox.querySelector(".change-val").textContent = fmt(change);
    meta.querySelector(".steps b").textContent = String(steps);
  }
  function getQty(id) {
    const card = prods.querySelector(`.product[data-id="${id}"]`);
    return Number(card?.querySelector(".qv").textContent || 0);
  }
  function getTotal() {
    return round2(products.reduce((acc, p) => acc + getQty(p.id) * p.price, 0));
  }

  // helpers
  function getProducts(cfg) {
    if (Array.isArray(cfg.products) && cfg.products.length) return cfg.products.map(p => ({ id: String(p.id), name: String(p.name), price: Number(p.price), emoji: p.emoji }));
    // Fallback simple desde texto: "Nombre | precio"
    const out = []; (String(cfg.text || cfg.game_pairs || "")).split(/\r?\n/).forEach((ln, i) => {
      ln = (ln || "").trim(); if (!ln) return; const p = ln.split("|").map(s => s.trim());
      if (p.length >= 2) out.push({ id: "p" + i, name: p[0], price: Number(p[1]) || 0, emoji: "🛒" });
    });
    return out;
  }
  function el(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
  function fmt(n) { return currency + " " + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function round2(n) { return Math.round(n * 100) / 100; }
  function shake(n) { n.classList.add("shake"); setTimeout(() => n.classList.remove("shake"), 260); }
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
      flip() { beep(400, .07, "triangle", .04); }, ok() { beep(760, .10, "sine", .07); }, bad() { beep(180, .18, "sawtooth", .07); }, win() { [660, 880, 990].forEach((f, i) => setTimeout(() => beep(f, .10, "sine", .09), i * 120)); }
    };
  }
}
