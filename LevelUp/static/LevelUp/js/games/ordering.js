// ordering.js — Ordena la secuencia (drag & drop + teclado)
export default async function initOrdering(host, cfg = {}) {
  const norm = (s)=>String(s??'').trim();
  const items = normalizeItems(cfg);
  const correctOrder = normalizeOrder(cfg, items);

  if (!items.length || !correctOrder.length) {
    host.innerHTML = `<div class="alert alert-warning" data-game-rendered>No hay elementos para ordenar.</div>`;
    return false;
  }

  host.innerHTML = "";
  host.dataset.gameComplete = "false";
  host.setAttribute("data-game-rendered","1");

  const wrap = document.createElement("div");
  wrap.className = "lv-card";
  wrap.innerHTML = `
    <div class="lv-header">
      <div class="lv-title">Ordena la secuencia</div>
      <div class="lv-meta"><span class="pill">Pasos: ${items.length}</span></div>
    </div>
    <ol class="ord-list" aria-label="Lista ordenable"></ol>
    <div class="d-flex gap-2 mt-2">
      <button class="btn btn-primary btn-sm" type="button" id="btnCheck">Validar</button>
      <button class="btn btn-outline-secondary btn-sm" type="button" id="btnReset">Reiniciar</button>
    </div>
    <div class="mt-2 small text-muted">Arrastra o usa teclas: ↑/↓ para mover, Enter para seleccionar.</div>
  `;
  host.appendChild(wrap);

  const list = wrap.querySelector(".ord-list");
  const state = { order: shuffle(items.map(i=>i.id)) };
  renderList();

  // --- Drag & drop nativo ---
  let dragLi = null;
  list.addEventListener("dragstart", (e)=>{
    const li = e.target.closest("li"); if (!li) return;
    dragLi = li; li.classList.add("opacity-50");
    e.dataTransfer.setData("text/plain", li.dataset.id);
    e.dataTransfer.effectAllowed = "move";
  });
  list.addEventListener("dragend", ()=>{ dragLi && dragLi.classList.remove("opacity-50"); dragLi=null; });
  list.addEventListener("dragover", (e)=>{ e.preventDefault(); e.dataTransfer.dropEffect="move"; });
  list.addEventListener("drop", (e)=>{
    e.preventDefault();
    const fromId = e.dataTransfer.getData("text/plain");
    const toLi = e.target.closest("li"); if (!toLi || !fromId) return;
    const toId = toLi.dataset.id;
    const a = state.order.indexOf(fromId), b = state.order.indexOf(toId);
    if (a<0 || b<0) return;
    state.order.splice(b,0, ...state.order.splice(a,1));
    renderList();
  });

  // --- Teclado: mover arriba/abajo ---
  list.addEventListener("keydown", (e)=>{
    const li = e.target.closest("li"); if (!li) return;
    const idx = state.order.indexOf(li.dataset.id);
    if (e.key === "ArrowUp" && idx>0) { swap(idx, idx-1); e.preventDefault(); }
    if (e.key === "ArrowDown" && idx<state.order.length-1) { swap(idx, idx+1); e.preventDefault(); }
    function swap(i,j){ const t = state.order[i]; state.order[i]=state.order[j]; state.order[j]=t; renderList(()=>focusId(li.dataset.id)); }
  });

  wrap.querySelector("#btnReset").addEventListener("click", ()=>{
    state.order = shuffle(items.map(i=>i.id)); renderList();
    clearAlert(); markProgress(0, items.length-1);
    host.dataset.gameComplete="false"; host.dataset.gameScore="0";
  });

  wrap.querySelector("#btnCheck").addEventListener("click", ()=>{
    const { correctAdj, totalAdj, exact } = scoreOrdering(state.order, correctOrder);
    const ratio = totalAdj > 0 ? (correctAdj / totalAdj) : (exact ? 1 : 0);
    markProgress(correctAdj, totalAdj);
    showAlert(ratio >= 1 ? "¡Secuencia perfecta! ✅" : `Aciertos de adyacencia: ${correctAdj}/${totalAdj}${exact?' (orden exacto)':''}`, ratio>=1);

    // Señales para play_hud.js
    host.dataset.gameCorrect = String(correctAdj);
    host.dataset.gameTotal   = String(totalAdj);
    host.dataset.gameScore   = String(Math.max(0, Math.min(1, ratio)));
    host.dataset.gameComplete= String(ratio >= 1 ? true : false);

    if (ratio >= 1) addSuccessFlag();
  });

  function renderList(after){
    list.innerHTML = "";
    state.order.forEach(id=>{
      const it = items.find(x=>x.id===id);
      const li = document.createElement("li");
      li.className = "ord-item list-group-item d-flex align-items-center gap-2";
      li.draggable = true;
      li.tabIndex = 0;
      li.dataset.id = id;
      li.innerHTML = `<span class="badge text-bg-light">⇅</span><span>${it.text}</span>`;
      list.appendChild(li);
    });
    if (after) after();
  }
  function focusId(id){ const li=[...list.children].find(li=>li.dataset.id===id); li && li.focus(); }
  function clearAlert(){ const a = wrap.querySelector(".alert"); a && a.remove(); }
  function showAlert(msg, ok){
    clearAlert();
    const div = document.createElement("div");
    div.className = `alert ${ok?'alert-success':'alert-info'} mt-2`;
    div.textContent = msg;
    wrap.appendChild(div);
  }
  function markProgress(c,t){
    host.dataset.gameCorrect = String(c||0);
    host.dataset.gameTotal   = String(t||0);
  }

  function normalizeItems(cfg){
    if (Array.isArray(cfg.items) && cfg.items.length) {
      return cfg.items.map((x,i)=>({ id: String(x.id ?? i+1), text: norm(x.text ?? x) })).filter(x=>x.text);
    }
    return [];
  }
  function normalizeOrder(cfg, items){
    let co = cfg.correct_order || cfg.correctOrder || [];
    if (!Array.isArray(co) || !co.length) co = items.map(x=>x.id);
    return co.map(String);
  }
  function scoreOrdering(order, expected){
    const totalAdj = Math.max(0, expected.length - 1);
    let correctAdj = 0;
    for (let i=0;i<order.length-1;i++){
      const pair = `${order[i]}→${order[i+1]}`;
      const idx = expected.indexOf(order[i]);
      if (idx>=0 && expected[idx+1] === order[i+1]) correctAdj++;
    }
    const exact = order.join("|") === expected.join("|");
    return { correctAdj, totalAdj, exact };
  }
  function shuffle(a){ return a.map(v=>[Math.random(),v]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]); }
  function addSuccessFlag(){
    // Para que HUD lo detecte sin depender del texto
    const ok = document.createElement('div'); ok.className = 'alert alert-success d-none'; ok.textContent = 'OK';
    host.appendChild(ok);
  }

  return true;
}