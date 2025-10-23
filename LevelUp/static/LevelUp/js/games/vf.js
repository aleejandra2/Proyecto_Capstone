// vf.js — V/F con justificación opcional (auto-corrección V/F)
export default async function initVF(host, cfg = {}) {
  const items = normalizeItems(cfg.items);
  if (!items.length) {
    host.innerHTML = `<div class="alert alert-warning" data-game-rendered>No hay afirmaciones.</div>`;
    return false;
  }

  host.innerHTML = ""; host.dataset.gameComplete="false"; host.setAttribute("data-game-rendered","1");

  const wrap = document.createElement("div");
  wrap.className = "lv-card";
  wrap.innerHTML = `
    <div class="lv-header">
      <div class="lv-title">Verdadero / Falso</div>
      <div class="lv-meta"><span class="pill">Ítems: ${items.length}</span></div>
    </div>
  `;
  const list = document.createElement("div"); wrap.appendChild(list);

  items.forEach((it, idx)=>{
    const card = document.createElement("div"); card.className = "border rounded p-2 mb-2";
    card.innerHTML = `
      <div class="fw-bold">${idx+1}. ${it.text}</div>
      <div class="btn-group mt-1" role="group" aria-label="Selecciona verdadero o falso">
        <button type="button" class="btn btn-outline-success btn-sm vf-true">Verdadero</button>
        <button type="button" class="btn btn-outline-danger btn-sm vf-false">Falso</button>
      </div>
      <div class="mt-2">
        <label class="form-label small">Justificación (opcional)</label>
        <textarea class="form-control form-control-sm vf-why" rows="2" placeholder="Escribe tu razonamiento..."></textarea>
      </div>
    `;
    card.dataset.index = String(idx);
    list.appendChild(card);
  });

  const actions = document.createElement("div");
  actions.className = "d-flex gap-2 mt-2";
  actions.innerHTML = `
    <button class="btn btn-primary btn-sm" type="button" id="btnCheck">Validar</button>
    <button class="btn btn-outline-secondary btn-sm" type="button" id="btnReset">Reiniciar</button>
  `;
  wrap.appendChild(actions);
  host.appendChild(wrap);

  // Interacciones
  list.addEventListener("click", (e)=>{
    const card = e.target.closest(".border.rounded"); if(!card) return;
    const tBtn = e.target.closest(".vf-true"); const fBtn = e.target.closest(".vf-false");
    if (tBtn || fBtn) {
      card.dataset.sel = tBtn ? "true" : "false";
      card.querySelector(".vf-true").classList.toggle("btn-success", !!tBtn);
      card.querySelector(".vf-false").classList.toggle("btn-danger", !!fBtn);
      card.querySelector(".vf-true").classList.toggle("btn-outline-success", !tBtn);
      card.querySelector(".vf-false").classList.toggle("btn-outline-danger", !fBtn);
    }
  });

  actions.querySelector("#btnReset").addEventListener("click", ()=>{
    list.querySelectorAll(".border.rounded").forEach(c=>{
      delete c.dataset.sel;
      c.querySelector(".vf-true").className = "btn btn-outline-success btn-sm vf-true";
      c.querySelector(".vf-false").className = "btn btn-outline-danger btn-sm vf-false";
      c.querySelector(".vf-why").value = "";
    });
    clearAlert(); setScore(0, items.length, 0); host.dataset.gameComplete="false";
  });

  actions.querySelector("#btnCheck").addEventListener("click", ()=>{
    let correct = 0; const total = items.length; const detail = [];
    list.querySelectorAll(".border.rounded").forEach((c, i)=>{
      const sel = c.dataset.sel ?? "";
      const why = c.querySelector(".vf-why").value || "";
      const exp = String(items[i].answer);
      if (sel && exp && String(sel) === exp) correct++;
      detail.push({ q: items[i].text, selected: sel, expected: exp, why });
    });
    const ratio = total ? correct/total : 0;
    setScore(correct, total, ratio);
    showAlert(ratio >= 1 ? "¡Excelente! ✅" : `Correctos: ${correct}/${total}`, ratio>=1);

    host.dataset.gameDetail  = JSON.stringify(detail);
    host.dataset.gameCorrect = String(correct);
    host.dataset.gameTotal   = String(total);
    host.dataset.gameScore   = String(Math.max(0, Math.min(1, ratio)));
    host.dataset.gameComplete= String(ratio >= 1 ? true : false);

    if (ratio >= 1) addSuccessFlag();
  });

  function normalizeItems(a){
    if (!Array.isArray(a)) return [];
    return a.map(x=>{
      const text = String(x.text ?? x.statement ?? "");
      let ans = x.answer; // true/false o "V"/"F"
      if (typeof ans === "string") ans = /^v(er(d(adero)?)?)?$/i.test(ans) ? true : false;
      return { text, answer: String(ans) };
    }).filter(x=>x.text);
  }

  function setScore(c,t,r){ host.dataset.gameCorrect=String(c||0); host.dataset.gameTotal=String(t||0); host.dataset.gameScore=String(Math.max(0,Math.min(1,r||0))); }
  function showAlert(msg, ok){ clearAlert(); const d=document.createElement('div'); d.className=`alert ${ok?'alert-success':'alert-info'} mt-2`; d.textContent=msg; wrap.appendChild(d); }
  function clearAlert(){ const a=wrap.querySelector('.alert'); a&&a.remove(); }
  function addSuccessFlag(){ const ok=document.createElement('div'); ok.className='alert alert-success d-none'; ok.textContent='OK'; host.appendChild(ok); }
}