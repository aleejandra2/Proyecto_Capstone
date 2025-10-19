// labyrinth.js — Avanza eligiendo la puerta correcta (3 errores = reinicio)
export default async function initLabyrinth(host, cfg = {}) {
  const steps = normalizeSteps(cfg.steps);
  if (!steps.length) {
    host.innerHTML = `<div class="alert alert-warning" data-game-rendered>No hay pasos del laberinto.</div>`;
    return false;
  }

  host.innerHTML = ""; host.dataset.gameComplete="false"; host.setAttribute("data-game-rendered","1");

  const wrap = document.createElement("div");
  wrap.className = "lv-card";
  wrap.innerHTML = `
    <div class="lv-header">
      <div class="lv-title">Laberinto de puertas</div>
      <div class="lv-meta">
        <span class="pill">Pasos: ${steps.length}</span>
        <span class="pill">Errores permitidos: 3</span>
      </div>
    </div>
    <div id="lbContent"></div>
    <div class="mt-2 small text-muted">Elige la puerta correcta para avanzar. Con 3 errores vuelves al inicio.</div>
  `;
  host.appendChild(wrap);

  const content = wrap.querySelector("#lbContent");
  const state = { idx: 0, wrong: 0, correctCount: 0 };
  render();

  function render(){
    const s = steps[state.idx];
    content.innerHTML = `
      <div class="border rounded p-3">
        <div class="d-flex justify-content-between align-items-center">
          <div><b>Paso ${state.idx+1} / ${steps.length}</b></div>
          <div>❌ ${state.wrong} / 3</div>
        </div>
        <div class="mt-2">${s.q}</div>
        <div class="d-flex gap-2 flex-wrap mt-2">
          ${s.opts.map((t,i)=>`<button type="button" class="btn btn-light door" data-i="${i}">🚪 ${t}</button>`).join("")}
        </div>
      </div>
    `;
  }

  content.addEventListener("click", (e)=>{
    const btn = e.target.closest(".door"); if(!btn) return;
    const pick = parseInt(btn.dataset.i,10);
    const s = steps[state.idx];
    if (pick === s.ans) {
      state.correctCount++;
      state.idx++;
      if (state.idx >= steps.length) {
        // Ganó
        const correct = state.correctCount, total = steps.length;
        const ratio = correct/total;
        host.dataset.gameCorrect = String(correct);
        host.dataset.gameTotal   = String(total);
        host.dataset.gameScore   = String(Math.max(0,Math.min(1,ratio)));
        host.dataset.gameComplete= "true";
        content.innerHTML = `<div class="alert alert-success">¡Saliste del laberinto! ✅</div>`;
        addSuccessFlag();
        return;
      }
      render();
    } else {
      state.wrong++;
      btn.classList.add("btn-danger");
      setTimeout(()=>btn.classList.remove("btn-danger"), 400);
      if (state.wrong >= 3) {
        state.idx = 0; state.wrong = 0; state.correctCount = 0;
        content.innerHTML = `<div class="alert alert-warning">Reiniciaste el recorrido. ¡Intenta de nuevo!</div>`;
        setTimeout(render, 700);
      }
    }
  });

  function normalizeSteps(a){
    if (!Array.isArray(a)) return [];
    return a.map(x=>{
      let q = String(x.q ?? x.pregunta ?? "");
      let opts = x.opts ?? x.options ?? [];
      let ans = Number(x.ans ?? x.answer ?? 0);
      if (typeof opts === "string") opts = opts.split("|").map(s=>s.trim()).filter(Boolean);
      if (typeof ans === "string") ans = parseInt(ans,10) || 0;
      return { q, opts, ans: Math.max(0, Math.min(opts.length-1, ans)) };
    }).filter(s=>s.q && Array.isArray(s.opts) && s.opts.length >= 2);
  }
  function addSuccessFlag(){ const ok=document.createElement('div'); ok.className='alert alert-success d-none'; ok.textContent='OK'; host.appendChild(ok); }
}