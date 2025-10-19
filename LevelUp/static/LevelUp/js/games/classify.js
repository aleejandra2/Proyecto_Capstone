// classify.js — Arrastra fichas a canastas (o clic para asignar)
export default async function initClassify(host, cfg = {}) {
  const items = normItems(cfg.items);
  const bins  = normBins(cfg.bins);
  const answers = cfg.answers || cfg.solutions || {};
  if (!items.length || !bins.length) {
    host.innerHTML = `<div class="alert alert-warning" data-game-rendered>Faltan ítems o canastas.</div>`;
    return false;
  }

  host.innerHTML = "";
  host.dataset.gameComplete = "false";
  host.setAttribute("data-game-rendered","1");

  const wrap = document.createElement("div");
  wrap.className = "lv-card";
  wrap.innerHTML = `
    <div class="lv-header">
      <div class="lv-title">Clasifica en canastas</div>
      <div class="lv-meta"><span class="pill">Ítems: ${items.length}</span><span class="pill">Canastas: ${bins.length}</span></div>
    </div>
    <div class="row g-3">
      <div class="col-lg-4">
        <div class="border rounded p-2" aria-label="Banco de fichas" id="pool"></div>
      </div>
      <div class="col-lg-8">
        <div class="row g-2" id="bins"></div>
      </div>
    </div>
    <div class="d-flex gap-2 mt-2">
      <button class="btn btn-primary btn-sm" type="button" id="btnCheck">Validar</button>
      <button class="btn btn-outline-secondary btn-sm" type="button" id="btnReset">Reiniciar</button>
    </div>
  `;
  host.appendChild(wrap);

  const pool = wrap.querySelector("#pool");
  const binsEl = wrap.querySelector("#bins");

  // Render bins
  bins.forEach(b=>{
    const col = document.createElement("div"); col.className = "col-12 col-md-6";
    col.innerHTML = `
      <div class="border rounded p-2 bin" data-id="${b.id}" tabindex="0">
        <div class="fw-bold mb-1">${b.label}</div>
        <div class="bin-drop min-vh-25" style="min-height:72px;"></div>
      </div>`;
    binsEl.appendChild(col);
  });

  // Render items (chips)
  items.forEach(it=>{
    const chip = makeChip(it);
    pool.appendChild(chip);
  });

  // Drag & drop delegación
  host.addEventListener("dragstart", (e)=>{
    const chip = e.target.closest(".cf-chip"); if(!chip) return;
    e.dataTransfer.setData("text/plain", chip.dataset.id);
    e.dataTransfer.effectAllowed = "move";
    setTimeout(()=>chip.classList.add("opacity-50"),0);
  });
  host.addEventListener("dragend", (e)=>{
    const chip = e.target.closest(".cf-chip"); if(!chip) return;
    chip.classList.remove("opacity-50");
  });
  host.addEventListener("dragover", (e)=>{
    if (e.target.closest(".bin-drop") || e.target.id === "pool") { e.preventDefault(); }
  });
  host.addEventListener("drop", (e)=>{
    const id = e.dataTransfer.getData("text/plain");
    const chip = host.querySelector(`.cf-chip[data-id="${css(id)}"]`);
    const dest = e.target.closest(".bin-drop") || (e.target.id === "pool" ? pool : null);
    if (chip && dest) dest.appendChild(chip);
  });

  // Accesibilidad: clic → menú “Enviar a…”
  host.addEventListener("click", (e)=>{
    const chip = e.target.closest(".cf-chip"); if (!chip) return;
    const menu = document.createElement("div");
    menu.className = "dropdown-menu show";
    menu.style.position = "absolute"; menu.style.zIndex = 10;
    const rect = chip.getBoundingClientRect();
    menu.style.left = rect.left+"px"; menu.style.top = (rect.bottom+4)+"px";
    menu.innerHTML = `<button class="dropdown-item" data-to="pool">Devolver al banco</button>` +
      bins.map(b=>`<button class="dropdown-item" data-to="${b.id}">${b.label}</button>`).join("");
    document.body.appendChild(menu);
    const close = ()=>menu.remove();
    setTimeout(()=>document.addEventListener("click", close, {once:true}), 0);
    menu.addEventListener("click",(ev)=>{
      const to = ev.target.dataset.to; if(!to) return;
      if (to === "pool") pool.appendChild(chip);
      else { const drop = host.querySelector(`.bin[data-id="${css(to)}"] .bin-drop`); drop && drop.appendChild(chip); }
      close();
    });
  });

  // Botones
  wrap.querySelector("#btnReset").addEventListener("click", ()=>{
    [...host.querySelectorAll(".cf-chip")].forEach(ch=>pool.appendChild(ch));
    clearAlert(); setScore(0, items.length, 0); host.dataset.gameComplete="false";
  });

  wrap.querySelector("#btnCheck").addEventListener("click", ()=>{
    const placed = {};
    bins.forEach(b=>{
      const drop = host.querySelector(`.bin[data-id="${css(b.id)}"] .bin-drop`);
      const chips = [...drop.querySelectorAll(".cf-chip")];
      chips.forEach(ch => placed[ch.dataset.id] = b.id);
    });
    let correct = 0;
    items.forEach(it=>{
      const exp = String(answers[it.id] ?? "");
      const got = String(placed[it.id] ?? "");
      if (exp && got && exp === got) correct++;
    });
    const total = items.length;
    const ratio = total ? correct/total : 0;
    setScore(correct, total, ratio);
    showAlert(ratio >= 1 ? "¡Todo correcto! ✅" : `Correctos: ${correct}/${total}`, ratio>=1);

    // Señales
    host.dataset.gameCorrect = String(correct);
    host.dataset.gameTotal   = String(total);
    host.dataset.gameScore   = String(Math.max(0, Math.min(1, ratio)));
    host.dataset.gameComplete= String(ratio >= 1 ? true : false);

    if (ratio >= 1) addSuccessFlag();
  });

  function setScore(c,t,r){
    host.dataset.gameCorrect = String(c||0);
    host.dataset.gameTotal   = String(t||0);
    host.dataset.gameScore   = String(Math.max(0, Math.min(1, r||0)));
  }
  function showAlert(msg, ok){
    clearAlert();
    const div = document.createElement("div"); div.className = `alert ${ok?'alert-success':'alert-info'} mt-2`; div.textContent = msg;
    wrap.appendChild(div);
  }
  function clearAlert(){ const a = wrap.querySelector(".alert"); a && a.remove(); }
  function addSuccessFlag(){ const ok = document.createElement('div'); ok.className='alert alert-success d-none'; ok.textContent='OK'; host.appendChild(ok); }

  function makeChip(it){
    const el = document.createElement("button");
    el.type="button"; el.className="cf-chip btn btn-light btn-sm me-2 mb-2"; el.draggable = true;
    el.dataset.id = it.id; el.textContent = it.text;
    return el;
  }
  function normItems(a){
    return Array.isArray(a) ? a.map((x,i)=>({id:String(x.id??i+1), text:String(x.text??x??'')})).filter(x=>x.text) : [];
  }
  function normBins(a){
    return Array.isArray(a) ? a.map((x,i)=>({id:String(x.id??('b'+(i+1))), label:String(x.label??x??'')})).filter(x=>x.label) : [];
  }
  function css(s){ return String(s).replace(/"/g,'\\"'); }
}