/* game_builder_helper.js — Builder visual para crear ítems de tipo “quiz”
   Soporta: memory, dragmatch, trivia, classify, ordering, cloze, vf.
   Requiere en cada tarjeta:
     - <select name$="-game_kind">
     - <textarea name$="-game_pairs">  (oculto)
     - <div class="gbuilder"></div>

   El formset debe disparar “formset:item-added” con {detail:{node:card}}.
   Expuesto global: window.GB = { mountOne(card), syncAll(container), syncOne(card) }.
*/
(function () {
  // ---------- helpers DOM ----------
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };

  // ---------- estilos mínimos ----------
  if (!document.getElementById("gbuilder-style")) {
    const css = `
      .gb-k{display:grid;gap:.75rem}
      .gb-row{display:grid;grid-template-columns:1fr 1fr auto;gap:.5rem;align-items:center}
      .gb-row-h{font-weight:700;opacity:.65}
      .gb-card{border:1px dashed #e5e7eb;border-radius:.75rem;padding:.75rem;background:#fafafa}
      .gb-cell-min{width:1%;white-space:nowrap}
      .gb-btn-xs{padding:.25rem .5rem;font-size:.75rem}
      .gb-hint{font-size:.85rem;color:#64748b}
      .gb-bin{background:#f8fafc;border:1px solid #e2e8f0;border-radius:.5rem;padding:.5rem}
      .gb-handle{cursor:ns-resize;user-select:none;padding:0 .4rem;opacity:.6}
    `;
    const st = el("style"); st.id = "gbuilder-style"; st.textContent = css; document.head.appendChild(st);
  }

  // ---------- audio (solo tras gesto del usuario) ----------
  let AC = null, audioReady = false;
  function initAudioOnce() {
    if (audioReady) return;
    function start() {
      try {
        AC = AC || new (window.AudioContext || window.webkitAudioContext)();
        if (AC.state === "suspended") AC.resume();
      } catch { }
      audioReady = true;
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
    }
    window.addEventListener("pointerdown", start, { once: true });
    window.addEventListener("keydown", start, { once: true });
  }
  function sfx(f = 520) {
    if (!audioReady || !AC) return;
    try {
      const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
      o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g).connect(AC.destination); o.start(t); o.stop(t + 0.13);
    } catch { }
  }
  initAudioOnce();

  // ---------- payload helpers ----------
  function getKind(card) {
    return (card.querySelector('select[name$="-game_kind"]')?.value || "").toLowerCase();
  }
  function setPayload(card, payload) {
    const ta = card.querySelector('textarea[name$="-game_pairs"]');
    if (ta) ta.value = JSON.stringify(payload || {}, null, 2);
    updateCounter(card, payload);
  }
  function updateCounter(card, payload) {
    const c = card.querySelector(".gb-counter"); if (!c) return;
    const kind = getKind(card);
    let n = 0, label = "ítems";
    if (kind === "trivia") { n = (payload?.questions || []).length; label = "preguntas"; }
    else if (kind === "classify") { n = (payload?.items || []).length; label = "ítems"; }
    else if (kind === "ordering") { n = (payload?.steps || []).length; label = "pasos"; }
    else if (kind === "cloze") { n = (payload?.answers || []).length; label = "respuestas"; }
    else if (kind === "vf") { n = (payload?.items || []).length; label = "afirmaciones"; }
    else if (kind === "memory" || kind === "dragmatch") { n = (payload?.pairs || []).length; label = "pares"; }
    c.textContent = `${n} ${label}`;
  }
  function baseFor(kind) {
    if (kind === "trivia") return { kind, questions: [] };
    if (kind === "classify") return { kind, categories: [], items: [] };
    if (kind === "ordering") return { kind, steps: [] };
    if (kind === "cloze") return { kind, text: "", answers: [], bank: [] };
    if (kind === "vf") return { kind, items: [] };
    if (kind === "memory" || kind === "dragmatch") return { kind, pairs: [] };
    return { kind };
  }

  // ---------- builders ----------
  // (A) PARES: memory / dragmatch (UI idéntica, distinto "kind")
  function mountPairs(card, root, payload, kind) {
    root.innerHTML = "";
    const wrap = el("div", "gb-card");
    wrap.append(el("div", "gb-row gb-row-h", "<div>Lado A</div><div>Lado B</div><div></div>"));
    const body = el("div", "gb-k"); wrap.appendChild(body);

    function addPair(a = "", b = "") {
      const row = el("div", "gb-row");
      const A = el("input", "form-control"); A.placeholder = "Lado A (texto de la carta)"; A.value = a;
      const B = el("input", "form-control"); B.placeholder = "Lado B (texto de la carta)"; B.value = b;
      const del = el("button", "btn btn-sm btn-outline-danger", "Quitar"); del.type = "button";
      del.addEventListener("click", () => { row.remove(); sfx(330); sync(); });
      row.append(A, B, el("div", "gb-cell-min").appendChild(del).parentNode);
      body.appendChild(row); sfx(660); sync();
    }
    function readPairs() {
      const out = [];
      $$(".gb-row", body).forEach(r => {
        const ins = $$("input", r);
        const a = (ins[0]?.value || "").trim(), b = (ins[1]?.value || "").trim();
        if (a && b) out.push([a, b]);
      });
      return out;
    }
    function sync() { setPayload(card, { kind, pairs: readPairs() }); }

    (payload?.pairs?.length ? payload.pairs : [["", ""], ["", ""]]).forEach(p => addPair(p[0], p[1]));
    const add = el("button", "btn btn-sm btn-outline-primary mt-2", "Agregar par"); add.type = "button";
    add.addEventListener("click", () => addPair());
    root.append(wrap, add);
  }

  // (B) Trivia
  function mountTrivia(card, root, payload) {
    root.innerHTML = "";
    const list = el("div", "gb-k gb-card");
    function addQ(q = "", opts = ["", ""], ans = 0) {
      const box = el("div", "gb-card");
      const qi = el("input", "form-control"); qi.placeholder = "Escribe la pregunta…"; qi.value = q;

      const optsWrap = el("div", "gb-k mt-2");
      function addOpt(text = "", checked = false) {
        const row = el("div", "d-flex align-items-center gap-2");
        const rb = el("input", "form-check-input"); rb.type = "radio"; rb.name = `rb_${Math.random().toString(36).slice(2)}`;
        const inp = el("input", "form-control"); inp.placeholder = "Opción…"; inp.value = text;
        const del = el("button", "btn btn-xs btn-outline-danger", "Quitar"); del.type = "button";
        if (checked) rb.checked = true;
        del.addEventListener("click", () => { if ($$(".d-flex", optsWrap).length > 2) { row.remove(); sfx(330); sync(); } });
        row.append(el("div", "gb-cell-min").appendChild(rb).parentNode, inp, el("div", "gb-cell-min").appendChild(del).parentNode);
        optsWrap.appendChild(row);
      }
      (opts.length ? opts : ["", ""]).forEach((t, i) => addOpt(t, i === ans));
      while ($$(".d-flex", optsWrap).length < 3) addOpt("");

      const addOptBtn = el("button", "btn btn-xs btn-outline-secondary", "＋ opción"); addOptBtn.type = "button";
      addOptBtn.addEventListener("click", () => { if ($$(".d-flex", optsWrap).length < 6) { addOpt(""); sfx(660); sync(); } });
      const delQ = el("button", "btn btn-sm btn-outline-danger", "Quitar pregunta"); delQ.type = "button";
      delQ.addEventListener("click", () => { box.remove(); sfx(330); sync(); });

      box.append(qi, optsWrap, el("div", "d-flex gap-2 mt-2").appendChild(addOptBtn).parentNode.appendChild(delQ).parentNode);
      list.appendChild(box); sync();
    }
    function read() {
      const out = [];
      $$(".gb-card", list).forEach(box => {
        const q = $("input.form-control", box)?.value.trim(); if (!q) return;
        const rows = $$(".d-flex", box); let ans = 0, vi = 0; const opts = [];
        rows.forEach(r => {
          const t = $("input.form-control", r)?.value.trim(); if (!t) return;
          if ($('input[type="radio"]', r)?.checked) ans = vi;
          opts.push(t); vi++;
        });
        if (opts.length >= 2) out.push({ q, opts, ans });
      });
      return out;
    }
    function sync() { setPayload(card, { kind: "trivia", questions: read() }); }

    (payload?.questions?.length ? payload.questions : [{ q: "", opts: ["", ""], ans: 0 }]).forEach(it => addQ(it.q, it.opts, it.ans));
    const addBtn = el("button", "btn btn-sm btn-outline-primary mt-2", "Agregar pregunta"); addBtn.type = "button";
    addBtn.addEventListener("click", () => addQ());
    root.append(list, addBtn);
  }

  // (C) Clasificar
  function mountClassify(card, root, payload) {
    root.innerHTML = "";
    const box = el("div", "gb-card");
    const catsWrap = el("div", "gb-k"), itemsWrap = el("div", "gb-k");

    box.append(
      el("div", "gb-hint mb-1", "Categorías (ej.: <b>Animales</b>, <b>Frutas</b>)"),
      el("div", "gb-bin").appendChild(catsWrap).parentNode,
      el("div", "gb-hint mt-3 mb-1", "Ítems y respuesta (elige la categoría)"),
      el("div", "gb-bin").appendChild(itemsWrap).parentNode
    );

    function addCat(name = "") {
      const r = el("div", "d-flex align-items-center gap-2");
      const i = el("input", "form-control"); i.placeholder = "Nombre de la categoría…"; i.value = name;
      const d = el("button", "btn btn-xs btn-outline-danger", "Quitar"); d.type = "button";
      d.addEventListener("click", () => { r.remove(); sync(); });
      r.append(i, el("div", "gb-cell-min").appendChild(d).parentNode);
      catsWrap.appendChild(r);
    }

    function addItem(text = "", catIdx = 0) {
      const r = el("div", "d-flex align-items-center gap-2");
      const i = el("input", "form-control"); i.placeholder = "Ítem…"; i.value = text;
      const s = el("select", "form-select");
      const d = el("button", "btn btn-xs btn-outline-danger", "Quitar"); d.type = "button";
      d.addEventListener("click", () => { r.remove(); sync(); });
      r.append(i, el("div", "gb-cell-min").appendChild(s).parentNode, el("div", "gb-cell-min").appendChild(d).parentNode);
      itemsWrap.appendChild(r);
      rebuildSel(); s.selectedIndex = Math.max(0, Math.min(catIdx, s.options.length - 1));
    }

    function read() {
      const categories = $$("input.form-control", catsWrap).map(i => i.value.trim()).filter(Boolean);
      const items = [];
      $$(".d-flex", itemsWrap).forEach(r => {
        const t = $("input.form-control", r)?.value.trim();
        const s = $("select", r)?.selectedIndex ?? 0;
        if (t) items.push({ text: t, cat: s });
      });
      return { categories, items };
    }

    function rebuildSel() {
      const cats = $$("input.form-control", catsWrap).map(i => i.value.trim()).filter(Boolean);
      $$("select", itemsWrap).forEach(s => {
        const v = s.selectedIndex;
        s.innerHTML = "";
        cats.forEach((c, i) => s.appendChild(el("option", "", c)).value = i);
        if (s.options.length === 0) s.appendChild(el("option", "", "—"));
        s.selectedIndex = Math.max(0, Math.min(v, s.options.length - 1));
      });
    }

    function sync() {
      const d = read();
      setPayload(card, { kind: "classify", ...d });
      rebuildSel();
    }

    (payload?.categories?.length ? payload.categories : ["", ""]).forEach(addCat);
    (payload?.items?.length ? payload.items : [{ text: "", cat: 0 }]).forEach(it => addItem(it.text, it.cat || 0));

    const addCatBtn = el("button", "btn btn-sm btn-outline-primary mt-2", "Agregar categoría");
    addCatBtn.type = "button"; addCatBtn.onclick = () => { addCat(); sync(); };
    const addItemBtn = el("button", "btn btn-sm btn-outline-primary mt-2", "Agregar ítem");
    addItemBtn.type = "button"; addItemBtn.onclick = () => { addItem(); sync(); };

    root.append(box, addCatBtn, addItemBtn);
    root.addEventListener("input", sync);
  }

  // (D) Ordenar pasos
  function mountOrdering(card, root, payload) {
    root.innerHTML = "";
    const list = el("div", "gb-card");

    function addStep(t = "") {
      const r = el("div", "d-flex align-items-center gap-2");
      const i = el("input", "form-control"); i.placeholder = "Paso…"; i.value = t;
      const up = el("button", "btn btn-xs btn-outline-secondary", "↑");
      const dn = el("button", "btn btn-xs btn-outline-secondary", "↓");
      const del = el("button", "btn btn-xs btn-outline-danger", "Quitar");
      up.type = dn.type = del.type = "button";
      up.onclick = () => { const p = r.previousElementSibling; if (p) { list.insertBefore(r, p); } };
      dn.onclick = () => { const n = r.nextElementSibling; if (n) { list.insertBefore(n, r); } };
      del.onclick = () => { r.remove(); };
      r.append(el("span", "gb-handle", "⋮⋮"), i, up, dn, del);
      list.appendChild(r);
    }
    function read() { return $$("input.form-control", list).map(i => i.value.trim()).filter(Boolean); }
    function sync() { setPayload(card, { kind: "ordering", steps: read() }); }

    (payload?.steps?.length ? payload.steps : ["", ""]).forEach(addStep);
    const addBtn = el("button", "btn btn-sm btn-outline-primary mt-2", "Agregar paso"); addBtn.type = "button";
    addBtn.onclick = () => { addStep(); sync(); };
    root.append(list, addBtn);
    root.addEventListener("input", sync);
  }

  // (E) Cloze
  function mountCloze(card, root, payload) {
    root.innerHTML = "";
    const box = el("div", "gb-card");
    const ta = el("textarea", "form-control"); ta.rows = 4; ta.placeholder = "Escribe el texto con ___ para huecos"; ta.value = payload?.text || "";
    const hint = el("div", "gb-hint mt-1", 'Ej: "La capital de Chile es ___ y la de Perú es ___"');
    const ansWrap = el("div", "gb-k mt-2");

    function addAns(v = "") {
      const r = el("div", "d-flex align-items-center gap-2");
      const i = el("input", "form-control"); i.placeholder = "Respuesta…"; i.value = v;
      const d = el("button", "btn btn-xs btn-outline-danger", "Quitar"); d.type = "button"; d.onclick = () => { r.remove(); sync(); };
      r.append(i, el("div", "gb-cell-min").appendChild(d).parentNode);
      ansWrap.appendChild(r);
    }
    function ensure() {
      const holes = (ta.value.match(/___/g) || []).length;
      const cur = $$("input.form-control", ansWrap).length;
      for (let k = cur; k < holes; k++) addAns("");
      sync();
    }
    function read() { return { text: ta.value || "", answers: $$("input.form-control", ansWrap).map(i => i.value.trim()) }; }
    function sync() { setPayload(card, { kind: "cloze", ...read(), bank: [] }); }

    box.append(ta, hint, el("div", "gb-hint mt-3 mb-1", "Respuestas en orden"), ansWrap);
    (payload?.answers?.length ? payload.answers : [""]).forEach(addAns);

    const b1 = el("button", "btn btn-sm btn-outline-primary mt-2", "Detectar huecos"); b1.type = "button"; b1.onclick = ensure;
    const b2 = el("button", "btn btn-sm btn-outline-primary mt-2", "Agregar respuesta"); b2.type = "button"; b2.onclick = () => { addAns(""); sync(); };
    root.append(box, b1, b2);
    root.addEventListener("input", sync);
  }

  // (F) Verdadero/Falso
  function mountVF(card, root, payload) {
    root.innerHTML = "";
    const list = el("div", "gb-card");
    function addRow(t = "", truth = true) {
      const r = el("div", "d-flex align-items-center gap-2");
      const i = el("input", "form-control"); i.placeholder = "Afirmación…"; i.value = t;
      const s = el("select", "form-select"); s.append(el("option", "", "Verdadero"), el("option", "", "Falso")); s.selectedIndex = truth ? 0 : 1;
      const d = el("button", "btn btn-xs btn-outline-danger", "Quitar"); d.type = "button"; d.onclick = () => { r.remove(); sync(); };
      r.append(i, el("div", "gb-cell-min").appendChild(s).parentNode, el("div", "gb-cell-min").appendChild(d).parentNode);
      list.appendChild(r);
    }
    function read() { const items = []; $$(".d-flex", list).forEach(r => { const t = $("input.form-control", r)?.value.trim(); const truth = $("select", r)?.selectedIndex === 0; if (t) items.push({ text: t, is_true: truth }); }); return items; }
    function sync() { setPayload(card, { kind: "vf", items: read() }); }

    (payload?.items?.length ? payload.items : [{ text: "", is_true: true }]).forEach(i => addRow(i.text, !!i.is_true));
    const addBtn = el("button", "btn btn-sm btn-outline-primary mt-2", "Agregar afirmación"); addBtn.type = "button";
    addBtn.onclick = () => { addRow(); sync(); };
    root.append(list, addBtn);
    root.addEventListener("input", sync);
  }

  // ---------- montaje por tarjeta ----------
  function mountOne(card) {
    if (!card || card.dataset.gbMounted === "1") return;
    const builder = $(".gbuilder", card);
    const hidden = card.querySelector('textarea[name$="-game_pairs"]');
    const kindSel = card.querySelector('select[name$="-game_kind"]');
    if (!builder || !hidden || !kindSel) return;

    function currentPayload() { try { return JSON.parse(hidden.value || "{}"); } catch { return {}; } }

    function render() {
      const kind = (kindSel.value || "").toLowerCase();
      const payload = currentPayload();
      if (!hidden.value.trim()) setPayload(card, baseFor(kind)); // payload base

      if (kind === "trivia") mountTrivia(card, builder, payload);
      else if (kind === "classify") mountClassify(card, builder, payload);
      else if (kind === "ordering") mountOrdering(card, builder, payload);
      else if (kind === "cloze") mountCloze(card, builder, payload);
      else if (kind === "vf") mountVF(card, builder, payload);
      else if (kind === "memory") mountPairs(card, builder, payload, "memory");
      else mountPairs(card, builder, payload, "dragmatch");
    }

    // Plantillas rápidas (botones con .gb-template)
    card.addEventListener("gb:template", (e) => {
      const tpl = (e.detail?.tpl || "").toLowerCase();
      const kind = getKind(card);

      if (kind === "trivia") {
        const bank = {
          mates: [{ q: "7×6=?", opts: ["36", "42", "56"], ans: 1 }],
          ciencias: [{ q: "Fórmula del agua", opts: ["O2", "H2O", "CO2"], ans: 1 }],
          geografia: [{ q: "Capital de Perú", opts: ["Lima", "Quito", "Bogotá"], ans: 0 }],
        };
        setPayload(card, { kind, questions: (bank[tpl] || []) });
      }
      else if (kind === "memory" || kind === "dragmatch") {
        const bank = {
          mates: [["2+3", "5"], ["8-3", "5"]],
          ciencias: [["H2O", "Agua"], ["CO2", "Dióxido de carbono"]],
          geografia: [["Chile", "Santiago"], ["Perú", "Lima"]],
        };
        setPayload(card, { kind, pairs: (bank[tpl] || []) });
      }
      else if (kind === "classify") {
        const b = {
          mates: { categories: ["Pares", "Impares"], items: [{ text: "2", cat: 0 }, { text: "3", cat: 1 }] },
          ciencias: { categories: ["Mamífero", "Ave"], items: [{ text: "Perro", cat: 0 }, { text: "Gorrión", cat: 1 }] },
          geografia: { categories: ["País", "Capital"], items: [{ text: "Chile", cat: 0 }, { text: "Santiago", cat: 1 }] },
        };
        const vv = b[tpl] || { categories: ["Grupo A", "Grupo B"], items: [{ text: "Ítem 1", cat: 0 }] };
        setPayload(card, { kind, ...vv });
      }
      else if (kind === "ordering") {
        const b = {
          mates: ["Leer problema", "Resolver operación", "Revisar resultado"],
          ciencias: ["Hipótesis", "Experimento", "Conclusión"],
          geografia: ["Ubicar país", "Identificar capital", "Comprobar bandera"],
        };
        setPayload(card, { kind, steps: (b[tpl] || []) });
      }
      else if (kind === "cloze") {
        const b = {
          mates: { text: "2 + 3 = ___", answers: ["5"] },
          ciencias: { text: "El agua es ___", answers: ["H2O"] },
          geografia: { text: "La capital de Chile es ___", answers: ["Santiago"] },
        };
        const vv = b[tpl] || { text: "___ es un ejemplo", answers: ["Esto"] };
        setPayload(card, { kind, ...vv, bank: [] });
      }
      else if (kind === "vf") {
        const b = {
          mates: [{ text: "5 es número primo", is_true: false }],
          ciencias: [{ text: "El sol es una estrella", is_true: true }],
          geografia: [{ text: "Lima es capital de Perú", is_true: true }],
        };
        setPayload(card, { kind, items: (b[tpl] || []) });
      }
      render();
    });

    $$(".gb-template", card).forEach(btn => {
      btn.addEventListener("click", () =>
        card.dispatchEvent(new CustomEvent("gb:template", { detail: { tpl: btn.dataset.tpl || "" } }))
      );
    });

    kindSel.addEventListener("change", render);
    render();
    card.dataset.gbMounted = "1";
  }

  // ---------- API pública para el formset ----------
  function syncOne(card) {
    const hidden = card.querySelector('textarea[name$="-game_pairs"]');
    const kind = (card.querySelector('select[name$="-game_kind"]')?.value || "").toLowerCase();
    if (!hidden) return;
    if (!hidden.value.trim()) setPayload(card, baseFor(kind));
  }
  function syncAll(container) {
    (container ? container.querySelectorAll(".item-form") : document.querySelectorAll(".item-form"))
      .forEach(syncOne);
  }

  window.GB = { mountOne, syncAll, syncOne };

  // ---------- montaje inicial + nuevos items ----------
  function init() { $$(".item-form").forEach(mountOne); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  document.addEventListener("formset:item-added", (e) => { if (e.detail?.node) mountOne(e.detail.node); });
})();