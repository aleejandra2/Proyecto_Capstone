/* Constructor visual de ítems (JSON-first, con validación de vacíos) */
(function () {
  // ------------ helpers ------------
  const qs = (s, r) => (r || document).querySelector(s);
  const qsa = (s, r) => Array.from((r || document).querySelectorAll(s));
  const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
  const strip = (s) => (s || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  function normKind(v) {
    const s = strip((v || "").toLowerCase().trim());
    if (s.includes("drag") && s.includes("match")) return "dragmatch";
    if (s === "dragandmatch") return "dragmatch";
    if (s.includes("memoria")) return "dragmatch";
    if (s.includes("clasific")) return "classify";
    if (s.includes("cloze") || s.includes("completar") || s.includes("espacio")) return "cloze";
    if (s.includes("orden") || s === "ordening") return "ordering";
    if (s === "vf" || s.includes("verdadero") || s.includes("falso")) return "vf";
    if (s.includes("laberinto")) return "labyrinth";
    if (s.includes("tiend") || s.includes("precio") || s === "shop") return "shop";
    if (s.includes("trivia")) return "trivia";
    return s;
  }
  function getKindFromSelect(sel) {
    if (!sel) return "";
    const opt = sel.options[sel.selectedIndex];
    const raw = (opt?.dataset?.kind) || sel.dataset?.kind || sel.value || opt?.text || "";
    return normKind(raw);
  }
  function setCounter(container, n, label) {
    const wrap = container.closest(".item-form") || container;
    const c = qs(".gb-counter", wrap);
    if (c) c.textContent = `${n} ${label}`;
  }
  const hideRaw = ta => { if (ta) { ta.classList.add("d-none"); ta.style.display = "none"; } };
  const showRaw = ta => { if (ta) { ta.classList.remove("d-none"); ta.style.display = ""; } };
  const tryJSON = t => { try { return JSON.parse(t); } catch { return null; } };

  // ================ CONSTRUCTORES UI ================
  function mountPairsUI(container, textarea, pairsInit) {
    container.innerHTML = "";
    const table = el("div", "gb-table");
    table.appendChild(el("div", "gb-row gb-row-h", "<div>Columna A</div><div>Columna B</div><div></div>"));

    function addRow(a = "", b = "") {
      const row = el("div", "gb-row");
      const i1 = el("input", "form-control"); i1.placeholder = "Ej: 2+3"; i1.value = a;
      const i2 = el("input", "form-control"); i2.placeholder = "Ej: 5"; i2.value = b;
      const del = el("button", "btn btn-sm btn-outline-danger", "Quitar"); del.type = "button";
      del.addEventListener("click", () => { row.remove(); sync(); });
      row.appendChild(el("div", "gb-cell")).appendChild(i1);
      row.appendChild(el("div", "gb-cell")).appendChild(i2);
      row.appendChild(el("div", "gb-cell gb-cell-min")).appendChild(del);
      table.appendChild(row);
    }
    (pairsInit?.length ? pairsInit : [["", ""], ["", ""]]).forEach(p => addRow(p[0], p[1]));

    const btnAdd = el("button", "btn btn-sm btn-outline-primary mt-2", "Agregar par"); btnAdd.type = "button";
    btnAdd.addEventListener("click", () => { addRow(); sync(); });

    container.appendChild(table);
    container.appendChild(btnAdd);

    function read() {
      const out = []; qsa(".gb-row:not(.gb-row-h)", table).forEach(r => {
        const [a, b] = qsa("input", r).map(x => (x.value || "").trim());
        if (a && b) out.push([a, b]);
      }); return out;
    }
    function sync() {
      const pairs = read();
      if (pairs.length > 0) {
        textarea.value = JSON.stringify({ kind: "dragmatch", pairs }, null, 2);
      } else {
        textarea.value = ""; // --> backend mostrará error
      }
      setCounter(container, pairs.length, "pares");
    }
    table.addEventListener("input", sync);
    sync();
  }

  function mountTriviaUI(container, textarea, itemsInit) {
    container.innerHTML = ""; const list = el("div", "gb-q-list");
    function addQ(q = "", opts = ["", "", ""], ans = 0) {
      const card = el("div", "gb-q-card");
      const qIn = el("input", "form-control"); qIn.placeholder = "Escribe la pregunta…"; qIn.value = q;
      const optsWrap = el("div", "gb-opts");
      function addOpt(text = "", checked = false) {
        const row = el("div", "gb-opt-row");
        const radio = el("input", "form-check-input"); radio.type = "radio"; if (checked) radio.checked = true;
        const inp = el("input", "form-control"); inp.placeholder = "Opción…"; inp.value = text;
        const del = el("button", "btn btn-sm btn-outline-danger", "Quitar"); del.type = "button";
        del.addEventListener("click", () => { if (qsa(".gb-opt-row", optsWrap).length > 2) { row.remove(); sync(); } });
        row.appendChild(el("div", "gb-cell-min")).appendChild(radio);
        row.appendChild(el("div", "gb-cell")).appendChild(inp);
        row.appendChild(el("div", "gb-cell-min")).appendChild(del);
        optsWrap.appendChild(row);
      }
      opts.forEach((t, i) => addOpt(t, i === ans));
      while (qsa(".gb-opt-row", optsWrap).length < Math.max(3, opts.length)) addOpt("");

      const addBtn = el("button", "btn btn-xs btn-outline-secondary", "+ opción"); addBtn.type = "button";
      addBtn.addEventListener("click", () => { if (qsa(".gb-opt-row", optsWrap).length < 6) { addOpt(""); sync(); } });
      const delQ = el("button", "btn btn-sm btn-outline-danger", "Quitar pregunta"); delQ.type = "button";
      delQ.addEventListener("click", () => { card.remove(); sync(); });

      card.appendChild(el("div", "mb-2")).appendChild(qIn);
      card.appendChild(optsWrap);
      const actions = el("div", "d-flex gap-2 mt-2"); actions.appendChild(addBtn); actions.appendChild(delQ);
      card.appendChild(actions); list.appendChild(card);
    }
    (itemsInit?.length ? itemsInit : [{ q: "", opts: ["", "", ""], ans: 0 }]).forEach(it => addQ(it.q, it.opts, it.ans));
    const btnAdd = el("button", "btn btn-sm btn-outline-primary mt-2", "Agregar pregunta"); btnAdd.type = "button";
    btnAdd.addEventListener("click", () => { addQ(); sync(); });

    container.appendChild(list); container.appendChild(btnAdd);

    function read() {
      const items = []; qsa(".gb-q-card", list).forEach(card => {
        const qv = (qs("input.form-control", card)?.value || "").trim(); if (!qv) return;
        const opts = []; let ans = 0, idx = 0;
        qsa(".gb-opt-row", card).forEach(r => {
          const txt = (qs("input.form-control", r)?.value || "").trim(); if (!txt) return;
          if (qs('input[type="radio"]', r)?.checked) ans = idx;
          opts.push(txt); idx++;
        });
        if (opts.length >= 2) items.push({ q: qv, opts, ans });
      }); return items;
    }
    function sync() {
      const questions = read();
      if (questions.length > 0) {
        textarea.value = JSON.stringify({ kind: "trivia", questions }, null, 2);
      } else {
        textarea.value = "";
      }
      setCounter(container, questions.length, "preguntas");
    }
    list.addEventListener("input", sync);
    list.addEventListener("change", sync);
    sync();
  }

  function mountClassifyUI(container, textarea, initial) {
    container.innerHTML = "";
    const catsList = el("div", "gb-list"), itemsList = el("div", "gb-list");

    function addCat(name = "") {
      const row = el("div", "gb-row");
      const inp = el("input", "form-control"); inp.placeholder = "Nombre de la categoría…"; inp.value = name;
      const del = el("button", "btn btn-sm btn-outline-danger", "Quitar"); del.type = "button";
      del.addEventListener("click", () => { row.remove(); sync(); });
      row.appendChild(el("div", "gb-cell")).appendChild(inp);
      row.appendChild(el("div", "gb-cell-min")).appendChild(del);
      catsList.appendChild(row);
    }
    function addItem(text = "", catIdx = 0) {
      const row = el("div", "gb-row");
      const txt = el("input", "form-control"); txt.placeholder = "Ítem…"; txt.value = text;
      const sel = el("select", "form-select");
      const del = el("button", "btn btn-sm btn-outline-danger", "Quitar"); del.type = "button";
      del.addEventListener("click", () => { row.remove(); sync(); });
      row.appendChild(el("div", "gb-cell")).appendChild(txt);
      row.appendChild(el("div", "gb-cell")).appendChild(sel);
      row.appendChild(el("div", "gb-cell-min")).appendChild(del);
      itemsList.appendChild(row);
      function refresh() {
        const names = qsa(".gb-list .gb-row input", catsList).map(i => (i.value || "").trim()).filter(Boolean);
        sel.innerHTML = ""; names.forEach((n, i) => { const o = el("option", "", n || ("Categoría " + (i + 1))); o.value = i; sel.appendChild(o); });
        sel.value = Math.max(0, Math.min(catIdx, names.length - 1));
      }
      row._refresh = refresh; refresh();
    }

    (initial?.categories?.length ? initial.categories : ["", ""]).forEach(addCat);
    (initial?.items?.length ? initial.items : [{ text: "", cat: 0 }]).forEach(it => addItem(it.text, it.cat ?? 0));

    const wrap = el("div", "");
    wrap.appendChild(el("div", "fw-semibold mb-2", "Categorías"));
    wrap.appendChild(catsList);
    const btnAddCat = el("button", "btn btn-sm btn-outline-primary mt-2", "Agregar categoría"); btnAddCat.type = "button";
    btnAddCat.addEventListener("click", () => { addCat(""); qsa(".gb-row", itemsList).forEach(r => r._refresh?.()); sync(); });
    wrap.appendChild(btnAddCat);

    const wrap2 = el("div", "mt-3");
    wrap2.appendChild(el("div", "fw-semibold mb-2", "Ítems"));
    wrap2.appendChild(itemsList);
    const btnAddItem = el("button", "btn btn-sm btn-outline-primary mt-2", "Agregar ítem"); btnAddItem.type = "button";
    btnAddItem.addEventListener("click", () => { addItem(""); sync(); });
    wrap2.appendChild(btnAddItem);

    container.appendChild(wrap);
    container.appendChild(wrap2);

    function readItems() {
      return qsa(".gb-row", itemsList).map(r => {
        const txt = (qs("input", r)?.value || "").trim(); if (!txt) return null;
        const cat = parseInt(qs("select", r)?.value || "0", 10) || 0;
        return { text: txt, cat };
      }).filter(Boolean);
    }
    function sync() {
      const categories = qsa(".gb-row input", catsList).map(i => (i.value || "").trim()).filter(Boolean);
      const items = readItems();
      if (categories.length >= 2 && items.length > 0) {
        textarea.value = JSON.stringify({ kind: "classify", categories, items }, null, 2);
      } else {
        textarea.value = "";
      }
      setCounter(container, items.length, "ítems");
    }
    container.addEventListener("input", sync);
    container.addEventListener("change", () => { qsa(".gb-row", itemsList).forEach(r => r._refresh?.()); sync(); });
    sync();
  }

  function mountClozeUI(container, textarea, initial) {
    container.innerHTML = "";
    const t = el("textarea", "form-control"); t.rows = 4; t.placeholder = "Escribe el texto y marca huecos con ___";
    t.value = initial?.text || "";
    const list = el("div", "gb-list"); const bank = el("input", "form-control"); bank.placeholder = "Banco (coma)"; bank.value = (initial?.bank || []).join(", ");

    function holes(str) { return (str.match(/___/g) || []).length; }
    function ensure(n) {
      const cur = qsa(".gb-row", list).length;
      if (n > cur) { for (let i = cur; i < n; i++) { const r = el("div", "gb-row"); const inp = el("input", "form-control"); inp.placeholder = `Respuesta ${i + 1}`; r.appendChild(el("div", "gb-cell")).appendChild(inp); list.appendChild(r); } }
      else if (n < cur) { for (let i = cur; i > n; i--) { const r = qsa(".gb-row", list).pop(); r && r.remove(); } }
    }
    (initial?.answers || []).forEach((a, i) => { ensure(i + 1); const inp = qsa(".gb-row input", list)[i]; if (inp) inp.value = a; });

    container.appendChild(el("div", "fw-semibold mb-2", "Texto base")); container.appendChild(t);
    container.appendChild(el("div", "fw-semibold mt-3 mb-2", "Respuestas (en orden)")); container.appendChild(list);
    container.appendChild(el("div", "fw-semibold mt-3 mb-2", "Banco (opcional)")); container.appendChild(bank);

    function readAns() { return qsa(".gb-row input", list).map(i => (i.value || "").trim()); }
    function sync() {
      const n = holes(t.value); ensure(n);
      const answers = readAns().slice(0, n);
      const b = (bank.value || "").split(",").map(s => s.trim()).filter(Boolean);
      if (t.value.trim() && n > 0) {
        textarea.value = JSON.stringify({ kind: "cloze", text: t.value || "", answers, bank: b }, null, 2);
      } else {
        textarea.value = "";
      }
      setCounter(container, n, "huecos");
    }
    t.addEventListener("input", sync); list.addEventListener("input", sync); bank.addEventListener("input", sync);
    sync();
  }

  function mountOrderingUI(container, textarea, stepsInit) {
    container.innerHTML = ""; const list = el("div", "gb-list");
    function addStep(text = "") {
      const r = el("div", "gb-row");
      const inp = el("input", "form-control"); inp.placeholder = "Paso…"; inp.value = text;
      const del = el("button", "btn btn-sm btn-outline-danger", "Quitar"); del.type = "button";
      del.addEventListener("click", () => { r.remove(); sync(); });
      r.appendChild(el("div", "gb-cell")).appendChild(inp);
      r.appendChild(el("div", "gb-cell-min")).appendChild(del);
      list.appendChild(r);
    }
    (stepsInit?.length ? stepsInit : ["", ""]).forEach(addStep);
    const addBtn = el("button", "btn btn-sm btn-outline-primary mt-2", "Agregar paso"); addBtn.type = "button";
    addBtn.addEventListener("click", () => { addStep(""); sync(); });
    container.appendChild(list); container.appendChild(addBtn);

    function read() { return qsa(".gb-row input", list).map(i => (i.value || "").trim()).filter(Boolean); }
    function sync() {
      const steps = read();
      if (steps.length >= 2) {
        textarea.value = JSON.stringify({ kind: "ordering", steps }, null, 2);
      } else {
        textarea.value = "";
      }
      setCounter(container, steps.length, "pasos");
    }
    list.addEventListener("input", sync); sync();
  }

  function mountVFUI(container, textarea, itemsInit) {
    container.innerHTML = ""; const list = el("div", "gb-list");
    function addRow(text = "", isTrue = true) {
      const r = el("div", "gb-row");
      const inp = el("input", "form-control"); inp.placeholder = "Afirmación…"; inp.value = text;
      const sel = el("select", "form-select"); sel.innerHTML = '<option value="true">Verdadero</option><option value="false">Falso</option>'; sel.value = isTrue ? "true" : "false";
      const del = el("button", "btn btn-sm btn-outline-danger", "Quitar"); del.type = "button"; del.addEventListener("click", () => { r.remove(); sync(); });
      r.appendChild(el("div", "gb-cell")).appendChild(inp);
      r.appendChild(el("div", "gb-cell-min")).appendChild(sel);
      r.appendChild(el("div", "gb-cell-min")).appendChild(del);
      list.appendChild(r);
    }
    (itemsInit?.length ? itemsInit : [{ text: "", is_true: true }]).forEach(it => addRow(it.text, !!it.is_true));
    const addBtn = el("button", "btn btn-sm btn-outline-primary mt-2", "Agregar afirmación"); addBtn.type = "button";
    addBtn.addEventListener("click", () => { addRow(""); sync(); });
    container.appendChild(list); container.appendChild(addBtn);

    function read() {
      return qsa(".gb-row", list).map(r => {
        const txt = (qs("input", r)?.value || "").trim(); if (!txt) return null;
        const v = qs("select", r)?.value === "true"; return { text: txt, is_true: v };
      }).filter(Boolean);
    }
    function sync() {
      const items = read();
      if (items.length > 0) {
        textarea.value = JSON.stringify({ kind: "vf", items }, null, 2);
      } else {
        textarea.value = "";
      }
      setCounter(container, items.length, "afirmaciones");
    }
    list.addEventListener("input", sync); list.addEventListener("change", sync); sync();
  }

  function mountLabyrinthUI(container, textarea, stepsInit) {
    container.innerHTML = ""; const list = el("div", "gb-q-list");
    function addStep(prompt = "", options = ["", ""], ans = 0) {
      const card = el("div", "gb-q-card");
      const pr = el("input", "form-control"); pr.placeholder = "Pista/Consigna…"; pr.value = prompt;
      const optsWrap = el("div", "gb-opts");
      function addOpt(text = "", checked = false) {
        const row = el("div", "gb-opt-row");
        const radio = el("input", "form-check-input"); radio.type = "radio"; if (checked) radio.checked = true;
        const inp = el("input", "form-control"); inp.placeholder = "Opción…"; inp.value = text;
        const del = el("button", "btn btn-sm btn-outline-danger", "Quitar"); del.type = "button";
        del.addEventListener("click", () => { if (qsa(".gb-opt-row", optsWrap).length > 2) { row.remove(); sync(); } });
        row.appendChild(el("div", "gb-cell-min")).appendChild(radio);
        row.appendChild(el("div", "gb-cell")).appendChild(inp);
        row.appendChild(el("div", "gb-cell-min")).appendChild(del);
        optsWrap.appendChild(row);
      }
      options.forEach((t, i) => addOpt(t, i === ans));
      while (qsa(".gb-opt-row", optsWrap).length < Math.max(3, options.length)) addOpt("");

      const addBtn = el("button", "btn btn-xs btn-outline-secondary", "+ opción"); addBtn.type = "button";
      addBtn.addEventListener("click", () => { if (qsa(".gb-opt-row", optsWrap).length < 6) { addOpt(""); sync(); } });
      const delQ = el("button", "btn btn-sm btn-outline-danger", "Quitar paso"); delQ.type = "button"; delQ.addEventListener("click", () => { card.remove(); sync(); });

      card.appendChild(el("div", "mb-2")).appendChild(pr);
      card.appendChild(optsWrap);
      const actions = el("div", "d-flex gap-2 mt-2"); actions.appendChild(addBtn); actions.appendChild(delQ);
      card.appendChild(actions); list.appendChild(card);
    }
    (stepsInit?.length ? stepsInit : [{ prompt: "", options: ["", ""], ans: 0 }]).forEach(s => addStep(s.prompt, s.options, s.ans));
    const btnAdd = el("button", "btn btn-sm btn-outline-primary mt-2", "Agregar paso"); btnAdd.type = "button";
    btnAdd.addEventListener("click", () => { addStep(); sync(); });
    container.appendChild(list); container.appendChild(btnAdd);

    function read() {
      return qsa(".gb-q-card", list).map(card => {
        const prompt = (qs("input.form-control", card)?.value || "").trim();
        const opts = []; let ans = 0, idx = 0;
        qsa(".gb-opt-row", card).forEach(r => {
          const txt = (qs("input.form-control", r)?.value || "").trim(); if (!txt) return;
          if (qs('input[type="radio"]', r)?.checked) ans = idx;
          opts.push(txt); idx++;
        });
        if (!prompt || opts.length < 2) return null;
        return { prompt, options: opts, ans };
      }).filter(Boolean);
    }
    function sync() {
      const steps = read();
      if (steps.length > 0) {
        textarea.value = JSON.stringify({ kind: "labyrinth", steps }, null, 2);
      } else {
        textarea.value = "";
      }
      setCounter(container, steps.length, "pasos");
    }
    list.addEventListener("input", sync); list.addEventListener("change", sync); sync();
  }

  function mountShopUI(container, textarea, productsInit) {
    container.innerHTML = ""; const list = el("div", "gb-list");
    function addProd(name = "", price = "") {
      const r = el("div", "gb-row");
      const n = el("input", "form-control"); n.placeholder = "Producto…"; n.value = name;
      const p = el("input", "form-control"); p.placeholder = "Precio"; p.value = price;
      const del = el("button", "btn btn-sm btn-outline-danger", "Quitar"); del.type = "button"; del.addEventListener("click", () => { r.remove(); sync(); });
      r.appendChild(el("div", "gb-cell")).appendChild(n);
      r.appendChild(el("div", "gb-cell-min")).appendChild(p);
      r.appendChild(el("div", "gb-cell-min")).appendChild(del);
      list.appendChild(r);
    }
    (productsInit?.length ? productsInit : [{ name: "", price: "" }]).forEach(p => addProd(p.name, p.price));
    const addBtn = el("button", "btn btn-sm btn-outline-primary mt-2", "Agregar producto"); addBtn.type = "button";
    addBtn.addEventListener("click", () => { addProd(); sync(); });
    container.appendChild(list); container.appendChild(addBtn);

    function read() {
      return qsa(".gb-row", list).map(r => {
        const name = (qs("input", r)?.value || "").trim();
        const price = parseFloat(qsa("input", r)[1]?.value);
        if (!name || isNaN(price)) return null;
        return { name, price };
      }).filter(Boolean);
    }
    function sync() {
      const products = read();
      if (products.length > 0) {
        textarea.value = JSON.stringify({ kind: "shop", products }, null, 2);
      } else {
        textarea.value = "";
      }
      setCounter(container, products.length, "productos");
    }
    list.addEventListener("input", sync); sync();
  }

  // ================ MONTAJE & API GLOBAL ================
  function applyTemplate(kind, textarea, key) {
    const TPL = {
      dragmatch: { mates: [["2+3", "5"], ["7-2", "5"]], ciencias: [["H2O", "Agua"], ["CO2", "Dióxido de carbono"]] },
      trivia: { mates: [{ q: "¿7×6?", opts: ["36", "42", "56"], ans: 1 }] },
      classify: { mates: { categories: ["Frutas", "Juguetes", "Transporte"], items: [{ text: "Banana", cat: 0 }, { text: "Pelota", cat: 1 }, { text: "Auto", cat: 2 }] } },
      cloze: { mates: { text: "El sol se ___ y la ___ calienta.", answers: ["eleva", "luz"], bank: ["luz", "eleva", "cielo"] } },
      ordering: { mates: ["Elegir juego", "Buscar", "Jugar", "Guardar"] },
      vf: { mates: [{ text: "5+5=10", is_true: true }, { text: "3×6=20", is_true: false }] },
      labyrinth: { mates: [{ prompt: "3×4=?", options: ["7", "12", "14"], ans: 1 }] },
      shop: { mates: [{ name: "Cuaderno", price: 299.9 }, { name: "Lápiz", price: 120 }] }
    };
    const tpl = TPL[kind]?.[key];
    if (!tpl) return;
    let payload = null;
    switch (kind) {
      case "dragmatch": payload = { kind, pairs: tpl }; break;
      case "trivia": payload = { kind, questions: tpl }; break;
      case "classify": payload = { kind, categories: tpl.categories, items: tpl.items }; break;
      case "cloze": payload = { kind, text: tpl.text, answers: tpl.answers, bank: tpl.bank }; break;
      case "ordering": payload = { kind, steps: tpl }; break;
      case "vf": payload = { kind, items: tpl }; break;
      case "labyrinth": payload = { kind, steps: tpl }; break;
      case "shop": payload = { kind, products: tpl }; break;
    }
    if (payload) textarea.value = JSON.stringify(payload, null, 2);
  }

  function mountBuilder(card) {
    const builder = card.querySelector(".gbuilder");
    const kindSel = card.querySelector('[name$="-game_kind"]');
    const textarea = card.querySelector('[name$="-game_pairs"]');
    if (!builder || !kindSel || !textarea) return false;

    // toggle “editar como texto”
    const btn = card.querySelector(".gb-toggle-raw");
    btn?.addEventListener("click", (e) => {
      e.preventDefault();
      const hidden = textarea.style.display === "none" || textarea.classList.contains("d-none");
      if (hidden) { showRaw(textarea); btn.textContent = "Ocultar texto"; }
      else { hideRaw(textarea); btn.textContent = "Editar como texto"; }
    });
    hideRaw(textarea);

    function render() {
      const kind = getKindFromSelect(kindSel);
      const data = textarea.value?.trim() ? tryJSON(textarea.value) : null;
      if (!kind) {
        builder.innerHTML = '<div class="text-muted">Selecciona el tipo de juego para configurar.</div>';
        return;
      }
      switch (kind) {
        case "dragmatch": mountPairsUI(builder, textarea, data?.pairs || null); break;
        case "trivia": mountTriviaUI(builder, textarea, data?.questions || null); break;
        case "classify": mountClassifyUI(builder, textarea, data || null); break;
        case "cloze": mountClozeUI(builder, textarea, data || null); break;
        case "ordering": mountOrderingUI(builder, textarea, data?.steps || null); break;
        case "vf": mountVFUI(builder, textarea, data?.items || null); break;
        case "labyrinth": mountLabyrinthUI(builder, textarea, data?.steps || null); break;
        case "shop": mountShopUI(builder, textarea, data?.products || null); break;
        default:
          builder.innerHTML = '<div class="text-muted">Selecciona el tipo de juego para configurar.</div>';
      }
    }

    qsa(".gb-template", card).forEach(btn => {
      btn.addEventListener("click", () => {
        const kind = getKindFromSelect(kindSel);
        applyTemplate(kind, textarea, btn.dataset.tpl);
        render();
      });
    });

    kindSel.addEventListener("change", render);
    render();
    return true;
  }

  function initAll() {
    qsa(".item-form").forEach(card => {
      if (card.dataset.gbMounted === "1") return;
      if (mountBuilder(card)) card.dataset.gbMounted = "1";
    });
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", initAll); }
  else { initAll(); }

  document.addEventListener("formset:item-added", e => {
    const node = e.detail?.node; if (node) mountBuilder(node);
  });

  // API global para que el formset fuerce la sincronización antes de enviar
  window.GB = window.GB || {};
  window.GB.syncOne = function (card) {
    const ta = card.querySelector('[name$="-game_pairs"]');
    const builder = card.querySelector(".gbuilder");
    if (!ta || !builder) return;
    const any = builder.querySelector("input,textarea,select");
    if (any) any.dispatchEvent(new Event("input", { bubbles: true }));
  };
})();
