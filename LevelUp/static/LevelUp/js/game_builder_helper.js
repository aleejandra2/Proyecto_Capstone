(function () {
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  // ------- Parsers/serializers -------
  function parsePairs(text) {
    return (text || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean)
      .map(ln => ln.split("|").map(s => s.trim()))
      .filter(p => p.length >= 2).map(p => [p[0], p[1]]);
  }
  function parseTrivia(text) {
    const out = [];
    (text || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean).forEach(ln => {
      const parts = ln.split("|").map(s => s.trim()).filter(Boolean);
      if (parts.length < 3) return;
      const q = parts[0];
      const optsRaw = parts.slice(1);
      let ans = 0;
      const opts = optsRaw.map((o, i) => {
        if (/\*$/.test(o)) ans = i;
        return o.replace(/\*$/, "");
      });
      out.push({ q, opts, ans });
    });
    return out;
  }
  function serializePairs(pairs) { return pairs.map(([a,b]) => `${a} | ${b}`).join("\n"); }
  function serializeTrivia(items) {
    return items.map(it => [it.q].concat(it.opts.map((o,i)=> i===it.ans ? o+"*" : o)).join(" | ")).join("\n");
  }

  // ------- UI helpers -------
  function makeEl(tag, cls, html) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (html != null) el.innerHTML = html;
    return el;
  }
  function updateCounter(container, count, kind) {
    const wrap = container.closest(".item-form") || container;
    const c = qs(".gb-counter", wrap);
    if (!c) return;
    const label = (kind === "trivia") ? "preguntas" : "pares";
    c.textContent = `${count} ${label}`;
  }

  function mountPairsUI(container, textarea, initialPairs) {
    container.innerHTML = "";
    const head = makeEl("div", "gb-head", `<strong>Pares</strong> <span class="text-muted">Ingresa ambos lados</span>`);
    const body = makeEl("div", "gb-body");
    const table = makeEl("div", "gb-table", `
      <div class="gb-row gb-row-h"><div>Columna A</div><div>Columna B</div><div></div></div>
    `);
    table.appendChild(body);

    function addRow(a="", b="") {
      const row = makeEl("div", "gb-row");
      const i1 = makeEl("input", "form-control"); i1.placeholder = "Ej: 2+3"; i1.value = a;
      const i2 = makeEl("input", "form-control"); i2.placeholder = "Ej: 5";   i2.value = b;
      const del = makeEl("button", "btn btn-sm btn-outline-danger", "Quitar"); del.type = "button";
      del.addEventListener("click", ()=>{ row.remove(); sync(); });
      row.appendChild(makeEl("div","gb-cell")).appendChild(i1);
      row.appendChild(makeEl("div","gb-cell")).appendChild(i2);
      row.appendChild(makeEl("div","gb-cell gb-cell-min")).appendChild(del);
      body.appendChild(row);
    }

    const btnAdd = makeEl("button", "btn btn-sm btn-outline-primary", "Agregar par");
    btnAdd.type = "button";
    btnAdd.addEventListener("click", ()=>{ addRow(); sync(); });

    function readUI() {
      const pairs = [];
      qsa(".gb-body .gb-row", table).forEach(r => {
        const ins = qsa("input", r);
        const a = (ins[0]?.value || "").trim();
        const b = (ins[1]?.value || "").trim();
        if (a && b) pairs.push([a,b]);
      });
      return pairs;
    }
    function sync() {
      const pairs = readUI();
      textarea.value = serializePairs(pairs);
      updateCounter(container, pairs.length, "pairs");
    }

    (initialPairs.length ? initialPairs : [["",""], ["",""]]).forEach(p => addRow(p[0], p[1]));
    container.appendChild(head);
    container.appendChild(table);
    container.appendChild(makeEl("div","mt-2")).appendChild(btnAdd);
    container.addEventListener("input", sync);
    sync();
  }

  function mountTriviaUI(container, textarea, initialItems) {
    container.innerHTML = "";
    const list = makeEl("div","gb-q-list");
    const btnAddQ = makeEl("button","btn btn-sm btn-outline-primary","Agregar pregunta"); btnAddQ.type="button";

    function addQuestion(q="", opts=["",""], ans=0) {
      const card = makeEl("div","gb-q-card");
      const qIn = makeEl("input","form-control"); qIn.placeholder="Escribe la pregunta…"; qIn.value=q;

      const optsWrap = makeEl("div","gb-opts");
      function addOpt(text="", checked=false) {
        const row = makeEl("div","gb-opt-row");
        const radio = makeEl("input","form-check-input"); radio.type="radio";
        const inp = makeEl("input","form-control"); inp.placeholder="Opción…"; inp.value=text;
        const del = makeEl("button","btn btn-sm btn-outline-danger","Quitar"); del.type="button";
        del.addEventListener("click",()=>{ if(qsa(".gb-opt-row",optsWrap).length>2){ row.remove(); sync(); }});
        if (checked) radio.checked = true;
        row.appendChild(makeEl("div","gb-cell-min")).appendChild(radio);
        row.appendChild(makeEl("div","gb-cell")).appendChild(inp);
        row.appendChild(makeEl("div","gb-cell-min")).appendChild(del);
        optsWrap.appendChild(row);
      }

      opts.forEach((t,i)=> addOpt(t, i===ans));
      while (qsa(".gb-opt-row", optsWrap).length < Math.max(3, opts.length)) addOpt("");

      const addOptBtn = makeEl("button","btn btn-xs btn-outline-secondary","+ opción"); addOptBtn.type="button";
      addOptBtn.addEventListener("click", ()=>{ if(qsa(".gb-opt-row",optsWrap).length<6){ addOpt(""); sync(); }});
      const delQ = makeEl("button","btn btn-sm btn-outline-danger","Quitar pregunta"); delQ.type="button";
      delQ.addEventListener("click",()=>{ card.remove(); sync(); });

      card.appendChild(makeEl("div","mb-2")).appendChild(qIn);
      card.appendChild(optsWrap);
      const actions = makeEl("div","d-flex gap-2 mt-2");
      actions.appendChild(addOptBtn); actions.appendChild(delQ);
      card.appendChild(actions);
      list.appendChild(card);
    }

    btnAddQ.addEventListener("click",()=>{ addQuestion(); sync(); });

    function readUI() {
      const items = [];
      qsa(".gb-q-card", list).forEach(card=>{
        const qVal = (qs("input.form-control",card)?.value || "").trim();
        if (!qVal) return;
        const opts=[]; let ans=0, idx=0;
        qsa(".gb-opt-row", card).forEach((row,i)=>{
          const txt = (qs("input.form-control",row)?.value || "").trim();
          if (!txt) return;
          if (qs('input[type="radio"]',row)?.checked) ans = idx;
          opts.push(txt); idx++;
        });
        if (opts.length>=2) items.push({ q:qVal, opts, ans });
      });
      return items;
    }
    function sync(){
      const items = readUI();
      textarea.value = serializeTrivia(items);
      updateCounter(container, items.length, "trivia");
    }

    (initialItems.length ? initialItems : [{q:"",opts:["",""],ans:0}]).forEach(it=> addQuestion(it.q,it.opts,it.ans));
    container.appendChild(list);
    container.appendChild(makeEl("div","mt-2")).appendChild(btnAddQ);
    list.addEventListener("input", sync);
    list.addEventListener("change", sync);
    sync();
  }

  function applyTemplate(kind, textarea, tpl) {
    const banks = {
      pairs: {
        mates: `2+3 | 5
7-2 | 5
5×6 | 30
10÷2 | 5
2^3 | 8`,
        ciencias: `H2O | Agua
CO2 | Dióxido de carbono
NaCl | Sal
Fotosíntesis | Proceso de las plantas
Herbívoro | Animal que come plantas`,
        geografia: `Capital de Chile | Santiago
Capital de Perú | Lima
Capital de Argentina | Buenos Aires
Capital de Bolivia | Sucre`
      },
      trivia: {
        mates: `¿Cuánto es 7×6? | 36 | 42* | 56
¿Cuánto es 9+5? | 13 | 14* | 15
¿Mitad de 100? | 40 | 50* | 60`,
        ciencias: `El agua es… | H2O* | O2 | CO2
Planeta rojo | Marte* | Venus | Saturno
Fase de la luna | Nueva | Llena* | Cuarto`,
        geografia: `Capital de Perú | Lima* | Quito | Bogotá
País de Santiago | Chile* | Perú | Bolivia
Continente de Egipto | África* | Asia | Europa`
      }
    };
    if (kind === "memory" || kind === "dragmatch") {
      textarea.value = banks.pairs[tpl] || "";
    } else if (kind === "trivia") {
      textarea.value = banks.trivia[tpl] || "";
    }
  }

  function mountBuilder(itemCard) {
    const builder = itemCard.querySelector(".gbuilder");
    const kindSel = itemCard.querySelector('[name$="-game_kind"]');
    const pairsTA = itemCard.querySelector('[name$="-game_pairs"]');
    const rawBox  = itemCard.querySelector(".gb-raw");
    if (!builder || !kindSel || !pairsTA) return false;

    function render(){
      const kind = (kindSel.value || "").toLowerCase();
      // 🔒 Solo ocultamos el RAW cuando efectivamente montamos UI:
      if (rawBox) rawBox.classList.add("d-none");

      if (kind === "memory" || kind === "dragmatch") {
        const initial = parsePairs(pairsTA.value);
        mountPairsUI(builder, pairsTA, initial);
      } else if (kind === "trivia") {
        const initial = parseTrivia(pairsTA.value);
        mountTriviaUI(builder, pairsTA, initial);
      } else {
        // Si no hay tipo, mostramos RAW para no bloquear al usuario
        if (rawBox) rawBox.classList.remove("d-none");
        builder.innerHTML = `<div class="text-muted">Selecciona el tipo de juego para configurar.</div>`;
      }
    }

    // Botones extra (si existen)
    itemCard.querySelector(".gb-import")?.addEventListener("click", ()=>{
      const kind = (kindSel.value || "").toLowerCase();
      const sample = kind === "trivia" ? "Pregunta? | Opción1 | Opción2* | Opción3" : "A | B";
      const pasted = window.prompt("Pega líneas con el formato:\n" + sample, pairsTA.value || "");
      if (pasted != null) { pairsTA.value = pasted; render(); }
    });
    itemCard.querySelector(".gb-toggle-raw")?.addEventListener("click", ()=>{
      rawBox?.classList.toggle("d-none");
    });
    qsa(".gb-template", itemCard).forEach(btn=>{
      btn.addEventListener("click", ()=>{
        applyTemplate((kindSel.value || "").toLowerCase(), pairsTA, btn.dataset.tpl);
        render();
      });
    });

    kindSel.addEventListener("change", render);
    render();
    return true;
  }

  // Montar existentes
  function initAll() {
    qsa(".item-form").forEach(form=>{
      // Si ya hay builder montado, saltar
      if (form.dataset.gbMounted === "1") return;
      const ok = mountBuilder(form);
      if (ok) form.dataset.gbMounted = "1";
    });
  }

  // 1) Al cargar
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }

  // 2) Si tu script de formset dispara un evento custom, lo escuchamos:
  document.addEventListener("formset:item-added", e=>{
    const node = e.detail?.node;
    if (node) mountBuilder(node);
  });

  // 3) Si no dispara, usamos MutationObserver (fallback)
  const container = document.getElementById("items-container");
  if (container && "MutationObserver" in window) {
    const mo = new MutationObserver((muts)=>{
      muts.forEach(m=>{
        m.addedNodes?.forEach(n=>{
          if (n.nodeType===1 && n.classList.contains("item-form")) {
            mountBuilder(n);
          }
        });
      });
    });
    mo.observe(container, { childList: true });
  }
})();
