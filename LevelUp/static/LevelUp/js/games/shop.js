// shop.js — Selecciona productos, calcula total y vuelto exacto
export default async function initShop(host, cfg = {}) {
  const currency = cfg.currency || "$";
  const products = normalizeProducts(cfg.products);
  const cash     = Number(cfg.cash ?? cfg.efectivo ?? 0);

  if (!products.length || !(cash>0)) {
    host.innerHTML = `<div class="alert alert-warning" data-game-rendered>Configura productos y efectivo entregado.</div>`;
    return false;
  }

  host.innerHTML = ""; host.dataset.gameComplete="false"; host.setAttribute("data-game-rendered","1");

  const wrap = document.createElement("div");
  wrap.className = "lv-card";
  wrap.innerHTML = `
    <div class="lv-header">
      <div class="lv-title">Tiendita</div>
      <div class="lv-meta"><span class="pill">Efectivo: ${currency} ${fmt(cash)}</span></div>
    </div>
    <div class="table-responsive">
      <table class="table table-sm align-middle mb-2">
        <thead><tr><th>Producto</th><th class="text-end">Precio</th><th class="text-center">Cantidad</th><th class="text-end">Subtotal</th></tr></thead>
        <tbody id="rows"></tbody>
        <tfoot><tr><th colspan="3" class="text-end">Total</th><th class="text-end" id="totalCell">${currency} 0,00</th></tr></tfoot>
      </table>
    </div>
    <div class="d-flex gap-2 flex-wrap align-items-center">
      <div><label class="form-label small">Vuelto esperado si pagas con ${currency} ${fmt(cash)}:</label>
        <input type="number" step="0.01" class="form-control form-control-sm d-inline-block" id="changeInput" placeholder="Ingresa el vuelto" style="width:160px;">
      </div>
      <button class="btn btn-primary btn-sm" type="button" id="btnCheck">Validar</button>
      <button class="btn btn-outline-secondary btn-sm" type="button" id="btnReset">Reiniciar</button>
    </div>
    <div class="mt-2 small text-muted">Bonus (interno): menos acciones para llegar al resultado.</div>
  `;
  host.appendChild(wrap);

  const rows = wrap.querySelector("#rows");
  const totalCell = wrap.querySelector("#totalCell");
  const changeInput = wrap.querySelector("#changeInput");
  const state = { qty: Object.fromEntries(products.map(p=>[p.id,0])), actions: 0 };

  products.forEach(p=>{
    const tr = document.createElement("tr"); tr.dataset.id = p.id;
    tr.innerHTML = `
      <td>${p.name}</td>
      <td class="text-end">${currency} ${fmt(p.price)}</td>
      <td class="text-center">
        <div class="input-group input-group-sm" style="max-width:140px;margin:auto;">
          <button class="btn btn-outline-secondary btn-sm act-dec" type="button">−</button>
          <input type="number" class="form-control text-center qty" min="0" value="0">
          <button class="btn btn-outline-secondary btn-sm act-inc" type="button">+</button>
        </div>
      </td>
      <td class="text-end subtotal">${currency} 0,00</td>
    `;
    rows.appendChild(tr);
  });

  rows.addEventListener("click", (e)=>{
    const tr = e.target.closest("tr"); if (!tr) return;
    const id = tr.dataset.id;
    const input = tr.querySelector(".qty");
    if (e.target.closest(".act-inc")) { input.value = String((parseInt(input.value||"0",10)||0)+1); state.actions++; }
    if (e.target.closest(".act-dec")) { input.value = String(Math.max(0,(parseInt(input.value||"0",10)||0)-1)); state.actions++; }
    update();
  });
  rows.addEventListener("input", (e)=>{
    const input = e.target.closest(".qty"); if (!input) return;
    state.actions++; update();
  });

  wrap.querySelector("#btnReset").addEventListener("click", ()=>{
    rows.querySelectorAll(".qty").forEach(i=>i.value="0"); state.actions=0; changeInput.value=""; update(); clearAlert();
    host.dataset.gameComplete="false"; host.dataset.gameScore="0";
  });

  wrap.querySelector("#btnCheck").addEventListener("click", ()=>{
    const total = computeTotal();
    const expectedChange = round2(cash - total);
    const val = Number(changeInput.value ?? NaN);
    const ok = isFinite(val) && round2(val) === expectedChange;
    const ratio = ok ? 1 : 0;
    showAlert(ok ? `¡Correcto! Vuelto: ${currency} ${fmt(expectedChange)} ✅` : `Revisa tu cálculo. El total es ${currency} ${fmt(total)}.`, ok);

    host.dataset.gameDetail  = JSON.stringify({ total, cash, expectedChange, actions: state.actions });
    host.dataset.gameCorrect = String(ok ? 1 : 0);
    host.dataset.gameTotal   = "1";
    host.dataset.gameScore   = String(ratio);
    host.dataset.gameComplete= String(ok);

    if (ok) addSuccessFlag();
  });

  function update(){
    let total = 0;
    rows.querySelectorAll("tr").forEach(tr=>{
      const id = tr.dataset.id;
      const price = products.find(p=>p.id===id)?.price || 0;
      const qty = Math.max(0, parseInt(tr.querySelector(".qty").value||"0",10)||0);
      state.qty[id] = qty;
      const sub = round2(price * qty);
      total += sub;
      tr.querySelector(".subtotal").textContent = `${currency} ${fmt(sub)}`;
    });
    totalCell.textContent = `${currency} ${fmt(round2(total))}`;
  }
  function computeTotal(){
    let t = 0; Object.entries(state.qty).forEach(([id,q])=>{
      const p = products.find(p=>p.id===id); if (p) t += p.price * q;
    }); return round2(t);
  }

  // utils
  function normalizeProducts(a){
    if (!Array.isArray(a)) return [];
    return a.map((x,i)=>({
      id: String(x.id ?? ('p'+(i+1))), name: String(x.name ?? x.nombre ?? 'Producto'), price: Number(x.price ?? x.precio ?? 0)
    })).filter(p=>p.name && p.price>0);
  }
  function round2(n){ return Math.round(n*100)/100; }
  function fmt(n){ return n.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2}); }
  function addSuccessFlag(){ const ok=document.createElement('div'); ok.className='alert alert-success d-none'; ok.textContent='OK'; host.appendChild(ok); }

  // inicial
  update();
}