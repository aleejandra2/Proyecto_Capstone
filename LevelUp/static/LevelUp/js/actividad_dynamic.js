(function () {
    // ========= helpers básicos =========
    const qs = (s, r) => (r || document).querySelector(s);
    const qsa = (s, r) => Array.from((r || document).querySelectorAll(s));
    const el = (tag, cls, html) => {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (html != null) n.innerHTML = html;
        return n;
    };
    const text = (n) => (n?.value || "").trim();

    function setCounter(scope, n, kind) {
        const c = qs(".gb-counter", scope.closest(".item-form") || scope);
        if (c) c.textContent = `${n} ${kind === "trivia" ? "preguntas" : "ítems"}`;
    }

    // ========= serializadores de texto (fallback RAW) =========
    function parsePairs(raw) {
        return (raw || "")
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter(Boolean)
            .map((ln) => ln.split("|").map((s) => s.trim()))
            .filter((p) => p.length >= 2)
            .map((p) => [p[0], p[1]]);
    }
    function serializePairs(pairs) {
        return (pairs || [])
            .map(([a, b]) => `${a} | ${b}`)
            .join("\n");
    }

    function parseTrivia(raw) {
        const out = [];
        (raw || "")
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter(Boolean)
            .forEach((ln) => {
                const parts = ln.split("|").map((s) => s.trim()).filter(Boolean);
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
    function serializeTrivia(items) {
        return (items || [])
            .map((it) =>
                [it.q].concat(
                    it.opts.map((o, i) => (i === it.ans ? o + "*" : o))
                ).join(" | ")
            )
            .join("\n");
    }

    // ========= builders =========
    function mountPairsBuilder(card, builder, rawTA, initialPairs) {
        builder.innerHTML = "";
        const body = el("div", "gb-table");
        const head = el("div", "gb-row gb-row-h", "<div>Columna A</div><div>Columna B</div><div></div>");
        const rowsWrap = el("div", "gb-body");
        body.appendChild(head);
        body.appendChild(rowsWrap);

        function addRow(a = "", b = "") {
            const row = el("div", "gb-row");
            const cA = el("div", "gb-cell");
            const cB = el("div", "gb-cell");
            const cX = el("div", "gb-cell gb-cell-min");
            const iA = el("input", "form-control"); iA.placeholder = "Ej: 2 + 3"; iA.value = a;
            const iB = el("input", "form-control"); iB.placeholder = "Ej: 5"; iB.value = b;
            const delBtn = el("button", "btn btn-sm btn-outline-danger", "Quitar"); delBtn.type = "button";
            delBtn.addEventListener("click", () => { row.remove(); sync(); });
            cA.appendChild(iA); cB.appendChild(iB); cX.appendChild(delBtn);
            row.appendChild(cA); row.appendChild(cB); row.appendChild(cX);
            rowsWrap.appendChild(row);
        }

        const addBtn = el("button", "btn btn-sm btn-outline-primary mt-2", "+ Agregar par"); addBtn.type = "button";
        addBtn.addEventListener("click", () => { addRow(); sync(); });

        function readUI() {
            const pairs = [];
            qsa(".gb-row", rowsWrap).forEach(r => {
                const ins = qsa("input", r);
                const A = text(ins[0]); const B = text(ins[1]);
                if (A && B) pairs.push([A, B]);
            });
            return pairs;
        }
        function sync() {
            const pairs = readUI();
            rawTA.value = serializePairs(pairs);
            setCounter(card, pairs.length, "pairs");
        }

        (initialPairs && initialPairs.length ? initialPairs : [["", ""], ["", ""]]).forEach(p => addRow(p[0], p[1]));
        builder.appendChild(body);
        builder.appendChild(addBtn);
        builder.addEventListener("input", sync);
        sync();
    }

    function mountTriviaBuilder(card, builder, rawTA, initialItems) {
        builder.innerHTML = "";
        const list = el("div", "gb-q-list");
        const addQ = el("button", "btn btn-sm btn-outline-primary mt-2", "+ Agregar pregunta"); addQ.type = "button";

        function addQuestion(q = "", opts = ["", ""], ans = 0) {
            const cardQ = el("div", "gb-q-card");
            const qIn = el("input", "form-control mb-2"); qIn.placeholder = "Escribe la pregunta…"; qIn.value = q;

            const optsWrap = el("div", "gb-opts");
            function addOpt(txt = "", checked = false) {
                const row = el("div", "gb-opt-row");
                const r = el("input", "form-check-input"); r.type = "radio"; if (checked) r.checked = true;
                const inp = el("input", "form-control"); inp.placeholder = "Opción…"; inp.value = txt;
                const del = el("button", "btn btn-xs btn-outline-danger", "Quitar"); del.type = "button";
                del.addEventListener("click", () => {
                    if (qsa(".gb-opt-row", optsWrap).length > 2) { row.remove(); sync(); }
                });
                const c1 = el("div", "gb-cell-min"), c2 = el("div", "gb-cell"), c3 = el("div", "gb-cell-min");
                c1.appendChild(r); c2.appendChild(inp); c3.appendChild(del);
                row.appendChild(c1); row.appendChild(c2); row.appendChild(c3);
                optsWrap.appendChild(row);
            }
            opts.forEach((t, i) => addOpt(t, i === ans));
            while (qsa(".gb-opt-row", optsWrap).length < Math.max(3, opts.length)) addOpt("");

            const addOptBtn = el("button", "btn btn-xs btn-outline-secondary mt-2", "+ opción"); addOptBtn.type = "button";
            addOptBtn.addEventListener("click", () => { if (qsa(".gb-opt-row", optsWrap).length < 6) { addOpt(""); sync(); } });

            const delQ = el("button", "btn btn-sm btn-outline-danger mt-2", "Quitar pregunta"); delQ.type = "button";
            delQ.addEventListener("click", () => { cardQ.remove(); sync(); });

            cardQ.appendChild(qIn);
            cardQ.appendChild(optsWrap);
            const actions = el("div", "d-flex gap-2"); actions.appendChild(addOptBtn); actions.appendChild(delQ);
            cardQ.appendChild(actions);
            list.appendChild(cardQ);
        }

        addQ.addEventListener("click", () => { addQuestion(); sync(); });

        function readUI() {
            const items = [];
            qsa(".gb-q-card", list).forEach((c) => {
                const qVal = text(qs("input.form-control", c));
                if (!qVal) return;
                const opts = []; let ans = 0, idx = 0;
                qsa(".gb-opt-row", c).forEach((row, i) => {
                    const txt = text(qs("input.form-control", row));
                    if (!txt) return;
                    if (qs('input[type="radio"]', row).checked) ans = idx;
                    opts.push(txt); idx++;
                });
                if (opts.length >= 2) items.push({ q: qVal, opts, ans });
            });
            return items;
        }
        function sync() {
            const items = readUI();
            rawTA.value = serializeTrivia(items);
            setCounter(card, items.length, "trivia");
        }

        (initialItems && initialItems.length ? initialItems : [{ q: "", opts: ["", ""], ans: 0 }]).forEach(it => addQuestion(it.q, it.opts, it.ans));
        builder.appendChild(list);
        builder.appendChild(addQ);
        builder.addEventListener("input", sync);
        builder.addEventListener("change", sync);
        sync();
    }

    // UI simple para Verdadero/Falso -> escribe JSON en RAW
    function mountVFBuilder(card, builder, rawTA) {
        builder.innerHTML = "";
        const list = el("div", "gb-vf-list");
        const addBtn = el("button", "btn btn-sm btn-outline-primary mt-2", "+ Agregar afirmación"); addBtn.type = "button";

        function addRow(txtVal = "", val = "true") {
            const row = el("div", "row g-2 align-items-center mb-2");
            const c1 = el("div", "col"); const c2 = el("div", "col-auto"); const c3 = el("div", "col-auto");
            const t = el("input", "form-control"); t.placeholder = "Afirmación…"; t.value = txtVal;
            const sel = el("select", "form-select");
            sel.innerHTML = `<option value="true">Verdadero</option><option value="false">Falso</option>`;
            sel.value = String(val);
            const rm = el("button", "btn btn-sm btn-outline-danger", "Quitar"); rm.type = "button";
            rm.addEventListener("click", () => { row.remove(); sync(); });
            c1.appendChild(t); c2.appendChild(sel); c3.appendChild(rm);
            row.appendChild(c1); row.appendChild(c2); row.appendChild(c3);
            list.appendChild(row);
        }

        function sync() {
            const items = qsa(".row", list).map(r => {
                return { text: text(qs("input", r)), answer: qs("select", r).value === "true" };
            }).filter(x => x.text);
            rawTA.value = JSON.stringify({ kind: "vf", items }, null, 2);
            setCounter(card, items.length, "vf");
        }

        addBtn.addEventListener("click", () => { addRow(); sync(); });
        builder.appendChild(list);
        builder.appendChild(addBtn);
        builder.addEventListener("input", sync);
        builder.addEventListener("change", sync);
        addRow(); addRow();
        sync();
    }

    // UI simple para Ordening -> JSON
    function mountOrderingBuilder(card, builder, rawTA) {
        builder.innerHTML = "";
        const list = el("div", "gb-ord-list");
        const addBtn = el("button", "btn btn-sm btn-outline-primary mt-2", "+ Agregar paso"); addBtn.type = "button";

        function addRow(txtVal = "") {
            const row = el("div", "d-flex gap-2 mb-2 align-items-center");
            const drag = el("span", "badge text-bg-light", "≡");
            const inp = el("input", "form-control"); inp.placeholder = "Paso en orden correcto…"; inp.value = txtVal;
            const rm = el("button", "btn btn-sm btn-outline-danger", "Quitar"); rm.type = "button";
            rm.addEventListener("click", () => { row.remove(); sync(); });
            row.appendChild(drag); row.appendChild(inp); row.appendChild(rm);
            list.appendChild(row);
        }
        function sync() {
            const items = qsa(".d-flex", list).map((r, i) => {
                const id = `s${i + 1}`;
                return { id, texto: text(qs("input", r)) };
            }).filter(x => x.texto);
            rawTA.value = JSON.stringify({
                kind: "ordening",
                items,
                orden_correcto: items.map(x => x.id)
            }, null, 2);
            setCounter(card, items.length, "ordening");
        }

        addBtn.addEventListener("click", () => { addRow(); sync(); });
        builder.appendChild(list);
        builder.appendChild(addBtn);
        builder.addEventListener("input", sync);
        addRow(); addRow();
        sync();
    }

    // Plantillas rápidas para tipos JSON-only
    const JSON_TEMPLATES = {
        classify: {
            kind: "classify",
            categories: ["Frutas", "Verduras"],
            items: [
                { text: "Manzana", category: "Frutas" },
                { text: "Lechuga", category: "Verduras" }
            ]
        },
        cloze: {
            kind: "cloze",
            text: "La capital de Chile es [Santiago] y la moneda es el [peso]."
        },
        laburinth: {
            kind: "laburinth",
            nodes: [
                { id: "start", text: "Inicio", next: ["A", "B"] },
                { id: "A", text: "Puerta roja", next: ["end"] },
                { id: "B", text: "Puerta azul", next: ["end"] },
                { id: "end", text: "Salida" }
            ]
        },
        shop: {
            kind: "shop",
            items: [
                { name: "Lápiz", price: 150 },
                { name: "Cuaderno", price: 1200 }
            ],
            balance: 2000
        }
    };

    function mountTemplateOnly(builder, rawTA, kind) {
        builder.innerHTML = `
      <div class="alert alert-info small">
        Para <strong>${kind}</strong> usa el cuadro de abajo (JSON). 
        <button type="button" class="btn btn-sm btn-outline-primary ms-2" data-act="tpl">Insertar plantilla</button>
      </div>
    `;
        const btn = qs('[data-act="tpl"]', builder);
        btn?.addEventListener("click", () => {
            const tpl = JSON_TEMPLATES[kind];
            if (!tpl) return;
            rawTA.value = JSON.stringify(tpl, null, 2);
        });
    }

    // ========= MONTADOR por ítem =========
    function mountOne(card) {
        const kindSel = qs('[name$="-game_kind"]', card);
        const rawTA = qs('[name$="-game_pairs"]', card);   // usamos este textarea como “contenido”
        const builder = qs(".gbuilder", card);
        const rawBox = qs(".gb-raw", card);

        if (!kindSel || !rawTA || !builder) return;

        function render() {
            const kind = (kindSel.value || "").toLowerCase();

            // oculta RAW si hay UI propia
            rawBox?.classList.add("d-none");
            builder.innerHTML = "";

            if (kind === "memory" || kind === "dragmatch" || kind === "dragandmatch") {
                const initial = parsePairs(rawTA.value);
                mountPairsBuilder(card, builder, rawTA, initial);
            } else if (kind === "trivia") {
                const initial = parseTrivia(rawTA.value);
                mountTriviaBuilder(card, builder, rawTA, initial);
            } else if (kind === "vf") {
                mountVFBuilder(card, builder, rawTA);
            } else if (kind === "ordening" || kind === "ordering") {
                mountOrderingBuilder(card, builder, rawTA);
            } else if (["classify", "cloze", "laburinth", "labyrinth", "shop"].includes(kind)) {
                mountTemplateOnly(builder, rawTA, kind);
                // deja RAW visible para edición
                rawBox?.classList.remove("d-none");
            } else {
                // desconocido -> solo RAW
                builder.innerHTML = `<div class="text-muted">Selecciona el tipo de juego para configurar.</div>`;
                rawBox?.classList.remove("d-none");
            }
        }

        // botones “Pegar en bloque” / “Ver texto” de tu UI
        qs(".gb-import", card)?.addEventListener("click", () => {
            const kind = (kindSel.value || "").toLowerCase();
            const ejemplo = kind === "trivia"
                ? "Pregunta? | Opción1 | Opción2* | Opción3"
                : "A | B";
            const pasted = window.prompt("Pega líneas con el formato:\n" + ejemplo, rawTA.value || "");
            if (pasted != null) { rawTA.value = pasted; render(); }
        });
        qs(".gb-toggle-raw", card)?.addEventListener("click", () => {
            rawBox?.classList.toggle("d-none");
        });

        // Plantillas rápidas “Matemáticas / Ciencias / Geografía”
        qsa(".gb-template", card).forEach((btn) => {
            btn.addEventListener("click", () => {
                const tpl = (btn.dataset.tpl || "").toLowerCase();
                const k = (kindSel.value || "").toLowerCase();
                const banks = {
                    pairs: {
                        mates: `2+3 | 5
7-2 | 5
5×6 | 30
10÷2 | 5
2^3 | 8`,
                        ciencias: `H2O | Agua
CO2 | Dióxido de carbono
NaCl | Sal`,
                        geografia: `Capital de Chile | Santiago
Capital de Perú | Lima
Capital de Argentina | Buenos Aires`
                    },
                    trivia: {
                        mates: `¿Cuánto es 7×6? | 36 | 42* | 56
¿Cuánto es 9+5? | 13 | 14* | 15`,
                        ciencias: `El agua es… | H2O* | O2 | CO2
Planeta rojo | Marte* | Venus | Saturno`,
                        geografia: `Capital de Perú | Lima* | Quito | Bogotá`
                    }
                };
                if (k === "trivia") rawTA.value = banks.trivia[tpl] || "";
                else rawTA.value = banks.pairs[tpl] || "";
                render();
            });
        });

        kindSel.addEventListener("change", render);
        render();
    }

    // ========= init global =========
    function initAll() {
        qsa(".item-form").forEach((card) => {
            if (card.dataset.builderMounted === "1") return;
            mountOne(card);
            card.dataset.builderMounted = "1";
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initAll);
    } else {
        initAll();
    }

    // Cuando el formset agrega un nuevo ítem
    document.addEventListener("formset:item-added", (e) => {
        const node = e.detail?.node;
        if (node) mountOne(node);
    });
})();
