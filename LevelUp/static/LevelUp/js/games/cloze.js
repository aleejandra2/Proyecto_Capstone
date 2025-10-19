// cloze.js — Texto con [[huecos]] y banco de opciones
export default async function initCloze(host, cfg = {}) {
  const norm = (s)=>String(s??'').trim();
  const unaccent = (s)=>norm(s).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

  const text = String(cfg.text ?? "");
  const blanks = cfg.blanks || {};
  if (!text || !Object.keys(blanks).length) {
    host.innerHTML = `<div class="alert alert-warning" data-game-rendered>Falta texto o configuración de huecos.</div>`;
    return false;
  }

  host.innerHTML = "";
  host.dataset.gameComplete = "false";
  host.setAttribute("data-game-rendered","1");

  const wrap = document.createElement("div");
  wrap.className = "lv-card";
  const content = document.createElement("div");
  content.className = "cloze-text";

  // Construye nodos: texto + controles
  const parts = splitCloze(text);
  parts.forEach(p=>{
    if (p.kind === "text") {
      const span = document.createElement("span"); span.textContent = p.value; content.appendChild(span);
    } else {
      const key = p.key;
      const cfgB = blanks[key] || {};
      const opts = Array.isArray(cfgB.options) ? cfgB.options.slice() : null;
      const ans  = String(cfgB.answer ?? "");
      const node = document.createElement(opts && opts.length ? "select" : "input");
      node.className = "form-control d-inline-block mx-1";
      node.style.width = "auto";
      node.dataset.key = key;
      if (opts && opts.length) {
        node.innerHTML = `<option value="">—</option>` + opts.map(o=>`<option value="${esc(o)}">${o}</option>`).join("");
      } else {
        node.type = "text";
        node.placeholder = "Respuesta";
      }
      content.appendChild(node);
    }
  });

  wrap.innerHTML = `
    <div class="lv-header">
      <div class="lv-title">Completa el texto</div>
      <div class="lv-meta"><span class="pill">Huecos: ${Object.keys(blanks).length}</span></div>
    </div>
  `;
  wrap.appendChild(content);
  const actions = document.createElement("div");
  actions.className = "d-flex gap-2 mt-2";
  actions.innerHTML = `
    <button class="btn btn-primary btn-sm" type="button" id="btnCheck">Validar</button>
    <button class="btn btn-outline-secondary btn-sm" type="button" id="btnReset">Reiniciar</button>
  `;
  wrap.appendChild(actions);
  host.appendChild(wrap);

  actions.querySelector("#btnReset").addEventListener("click", ()=>{
    wrap.querySelectorAll("select,input").forEach(x=>{ if (x.tagName==='SELECT') x.selectedIndex = 0; else x.value = ""; });
    clearAlert(); setScore(0, Object.keys(blanks).length, 0); host.dataset.gameComplete="false";
  });

  actions.querySelector("#btnCheck").addEventListener("click", ()=>{
    const nodes = [...wrap.querySelectorAll("select,input")];
    let correct = 0, total = 0;
    const detail = [];

    nodes.forEach(n=>{
      const key = n.dataset.key;
      const cfgB = blanks[key] || {};
      const ans  = String(cfgB.answer ?? "");
      const val  = n.tagName === "SELECT" ? (n.value||"") : (n.value||"");
      if (ans) {
        total++;
        if (unaccent(val) === unaccent(ans)) correct++;
      }
      detail.push({ key, value: val });
    });

    const ratio = total ? (correct/total) : 0;
    setScore(correct, total, ratio);
    showAlert(ratio >= 1 ? "¡Todo correcto! ✅" : `Correctos: ${correct}/${total}`, ratio>=1);

    host.dataset.gameDetail  = JSON.stringify(detail);
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
  function showAlert(msg, ok){ clearAlert(); const d=document.createElement('div'); d.className=`alert ${ok?'alert-success':'alert-info'} mt-2`; d.textContent=msg; wrap.appendChild(d); }
  function clearAlert(){ const a=wrap.querySelector('.alert'); a&&a.remove(); }
  function addSuccessFlag(){ const ok=document.createElement('div'); ok.className='alert alert-success d-none'; ok.textContent='OK'; host.appendChild(ok); }

  function splitCloze(t){
    const out=[]; let last=0; const rx=/\[\[(.+?)\]\]/g; let m;
    while((m=rx.exec(t))){ if(m.index>last) out.push({kind:'text', value:t.slice(last,m.index)}); out.push({kind:'blank', key:m[1]}); last = m.index + m[0].length; }
    if (last < t.length) out.push({kind:'text', value:t.slice(last)});
    return out;
  }
  function esc(s){ return String(s).replace(/"/g,'&quot;'); }
}