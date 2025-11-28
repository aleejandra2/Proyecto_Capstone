(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const el = (t, c, h) => {
    const n = document.createElement(t);
    if (c) n.className = c;
    if (h != null) n.innerHTML = h;
    return n;
  };

  function setPayload(card, payload) {
    const ta = card.querySelector('textarea[name$="-game_pairs"]');
    if (!ta) return;
    ta.value = JSON.stringify(payload || {}, null, 2);
    ta.dispatchEvent(new Event("change", { bubbles: true }));
    updateCounter(card, payload);
  }

  function kindOf(card) {
    const sel = card.querySelector('select[name$="-item_kind"]');
    return (sel?.value || "trivia").toLowerCase();
  }

  function updateCounter(card, payload) {
    const c = $(".gb-counter", card);
    if (!c) return;
    const k = kindOf(card);

    let n = 0;
    let label = "ítems";

    if (k === "trivia") {
      n = (payload?.questions || []).length;
      label = n === 1 ? "pregunta" : "preguntas";
    } else if (k === "vf") {
      n = (payload?.items || []).length;
      label = n === 1 ? "afirmación" : "afirmaciones";
    } else if (k === "ordering") {
      n = (payload?.steps || []).length;
      label = n === 1 ? "paso" : "pasos";
    } else if (k === "classify") {
      n = (payload?.items || []).length;
      label = n === 1 ? "ítem" : "ítems";
    } else if (k === "cloze") {
      // Cloze: usar blanks (nuevo) o answers (antiguo) como respaldo
      const blanksObj = payload?.blanks || payload?.answers || {};
      n =
        blanksObj && typeof blanksObj === "object"
          ? Object.keys(blanksObj).length
          : 0;
      label = n === 1 ? "hueco" : "huecos";
    } else {
      n = (payload?.pairs || []).length;
      label = n === 1 ? "par" : "pares";
    }

    c.textContent = `${n} ${label}`;
  }

  // ========== PARES (Memory/DragMatch) ==========
  function mountPairs(card, root, payload, kind) {
    root.innerHTML = `
      <div class="alert alert-info small mb-3">
        <strong>💡 Instrucciones:</strong> Crea pares de cartas que el estudiante deberá emparejar.
        Por ejemplo: "Perro - Animal", "2+3 - 5", "Chile - Santiago"
      </div>`;

    const list = el("div", "gb-pairs-list");

    function addPair(a = "", b = "") {
      const row = el("div", "gb-pair-row mb-2");
      row.innerHTML = `
        <div class="row g-2">
          <div class="col">
            <input type="text" class="form-control" placeholder="Lado A (ej: Perro)" value="${a}">
          </div>
          <div class="col">
            <input type="text" class="form-control" placeholder="Lado B (ej: Animal)" value="${b}">
          </div>
          <div class="col-auto">
            <button type="button" class="btn btn-outline-danger btn-remove-pair">✕</button>
          </div>
        </div>`;

      row.querySelector(".btn-remove-pair").onclick = () => {
        row.remove();
        sync();
      };
      list.appendChild(row);
    }

    function read() {
      const out = [];
      $$(".gb-pair-row", list).forEach((r) => {
        const ins = $$("input", r);
        const a = (ins[0]?.value || "").trim();
        const b = (ins[1]?.value || "").trim();
        if (a && b) out.push([a, b]);
      });
      return out;
    }

    function sync() {
      setPayload(card, { kind, pairs: read() });
    }

    const existing = payload?.pairs || [];
    if (existing.length === 0) {
      addPair("Gato", "Animal");
      addPair("2+2", "4");
    } else {
      existing.forEach((p) => addPair(p[0], p[1]));
    }

    const addBtn = el(
      "button",
      "btn btn-outline-primary btn-sm mt-2",
      "➕ Agregar par",
    );
    addBtn.type = "button";
    addBtn.onclick = () => {
      addPair();
      sync();
    };

    root.append(list, addBtn);
    root.addEventListener("input", sync);
    sync();
  }

  // ========== TRIVIA ==========
  function mountTrivia(card, root, payload) {
    root.innerHTML = `
      <div class="alert alert-info small mb-3">
        <strong>💡 Instrucciones:</strong> Crea preguntas de opción múltiple. 
        Marca la respuesta correcta con el botón ✓
      </div>`;

    const list = el("div", "gb-trivia-list");

    function addQ(q = "", opts = ["", "", ""], ans = 0) {
      const box = el("div", "card mb-3 p-3 gb-trivia-item");

      const qInput = el("input", "form-control mb-2");
      qInput.placeholder = "Escribe tu pregunta aquí...";
      qInput.value = q;

      const optsWrap = el("div", "gb-opts-list");
      const groupName = `q_${Date.now()}_${Math.random()}`;

      function addOpt(text = "", checked = false) {
        const row = el("div", "input-group mb-2");
        row.innerHTML = `
          <span class="input-group-text">
            <input type="radio" name="${groupName}" class="form-check-input mt-0" ${checked ? "checked" : ""}>
          </span>
          <input type="text" class="form-control" placeholder="Opción..." value="${text}">
          <button type="button" class="btn btn-outline-danger btn-remove-opt">✕</button>`;

        row.querySelector(".btn-remove-opt").onclick = () => {
          if ($$(".input-group", optsWrap).length > 2) {
            row.remove();
            sync();
          } else alert("Debe haber al menos 2 opciones");
        };

        optsWrap.appendChild(row);
      }

      if (opts.length === 0) {
        addOpt("", true);
        addOpt("");
        addOpt("");
      } else {
        opts.forEach((t, i) => addOpt(t, i === ans));
      }

      const toolbar = el("div", "d-flex gap-2 mt-2");

      const addOptBtn = el(
        "button",
        "btn btn-sm btn-outline-secondary",
        "➕ Agregar opción",
      );
      addOptBtn.type = "button";
      addOptBtn.onclick = () => {
        if ($$(".input-group", optsWrap).length < 6) {
          addOpt("");
          sync();
        } else alert("Máximo 6 opciones por pregunta");
      };

      const delQBtn = el(
        "button",
        "btn btn-sm btn-outline-danger",
        "🗑 Eliminar pregunta",
      );
      delQBtn.type = "button";
      delQBtn.onclick = () => {
        if (confirm("¿Eliminar esta pregunta?")) {
          box.remove();
          sync();
        }
      };

      toolbar.append(addOptBtn, delQBtn);
      box.append(qInput, optsWrap, toolbar);
      list.appendChild(box);
    }

    function read() {
      const out = [];
      $$(".gb-trivia-item", list).forEach((box) => {
        const q = $("input.form-control", box)?.value.trim();
        if (!q) return;

        const rows = $$(".input-group", box);
        let ans = 0;
        const opts = [];

        rows.forEach((r) => {
          const t = $("input.form-control", r)?.value.trim();
          if (!t) return;
          if ($('input[type="radio"]', r)?.checked) ans = opts.length;
          opts.push(t);
        });

        if (opts.length >= 2) out.push({ q, opts, ans });
      });
      return out;
    }

    function sync() {
      setPayload(card, { kind: "trivia", questions: read() });
    }

    const existing = payload?.questions || [];
    if (existing.length === 0) {
      addQ("¿Cuánto es 5 + 3?", ["6", "8", "10"], 1);
    } else {
      existing.forEach((it) => addQ(it.q, it.opts, it.ans));
    }

    const addBtn = el(
      "button",
      "btn btn-outline-primary btn-sm mt-3",
      "➕ Agregar pregunta",
    );
    addBtn.type = "button";
    addBtn.onclick = () => {
      addQ();
      sync();
    };

    root.append(list, addBtn);
    root.addEventListener("input", sync);
    root.addEventListener("change", sync);
    sync();
  }

  // ========== VERDADERO/FALSO ==========
  function mountVF(card, root, payload) {
    root.innerHTML = `
      <div class="alert alert-info small mb-3">
        <strong>💡 Instrucciones:</strong> Escribe afirmaciones y marca si son verdaderas o falsas.
      </div>`;

    const list = el("div", "gb-vf-list");

    function addRow(text = "", truth = true) {
      const row = el("div", "card mb-2 p-2");
      row.innerHTML = `
        <div class="row g-2 align-items-center">
          <div class="col">
            <input type="text" class="form-control" placeholder="Escribe una afirmación..." value="${text}">
          </div>
          <div class="col-auto">
            <select class="form-select" style="width: 140px;">
              <option value="true" ${truth ? "selected" : ""}>✓ Verdadero</option>
              <option value="false" ${!truth ? "selected" : ""}>✗ Falso</option>
            </select>
          </div>
          <div class="col-auto">
            <button type="button" class="btn btn-outline-danger btn-sm btn-remove-vf">✕</button>
          </div>
        </div>`;

      row.querySelector(".btn-remove-vf").onclick = () => {
        row.remove();
        sync();
      };
      list.appendChild(row);
    }

    function read() {
      const items = [];
      $$(".card", list).forEach((r) => {
        const t = $("input", r)?.value.trim();
        const val = $("select", r)?.value === "true";
        if (t) items.push({ text: t, is_true: val });
      });
      return items;
    }

    function sync() {
      setPayload(card, { kind: "vf", items: read() });
    }

    const existing = payload?.items || [];
    if (existing.length === 0) {
      addRow("Los pingüinos son aves", true);
      addRow("El Sol gira alrededor de la Tierra", false);
    } else {
      existing.forEach((it) => addRow(it.text, !!it.is_true));
    }

    const addBtn = el(
      "button",
      "btn btn-outline-primary btn-sm mt-2",
      "➕ Agregar afirmación",
    );
    addBtn.type = "button";
    addBtn.onclick = () => {
      addRow();
      sync();
    };

    root.append(list, addBtn);
    root.addEventListener("input", sync);
    root.addEventListener("change", sync);
    sync();
  }

  // ========== ORDENAR SECUENCIA ==========
  function mountOrdering(card, root, payload) {
    root.innerHTML = `
      <div class="alert alert-info small mb-3">
        <strong>💡 Instrucciones:</strong> Escribe los pasos en el orden correcto. 
        Puedes arrastrar ☰ para reordenar.
      </div>`;

    const list = el("div", "gb-ordering-list");

    function addStep(t = "") {
      const row = el("div", "card mb-2 p-2 gb-order-item");
      row.draggable = true;
      row.innerHTML = `
        <div class="d-flex align-items-center gap-2">
          <span class="gb-handle" style="cursor: move; user-select: none;">☰</span>
          <input type="text" class="form-control" placeholder="Escribe un paso..." value="${t}">
          <button type="button" class="btn btn-outline-danger btn-sm btn-remove-step">✕</button>
        </div>`;

      row.querySelector(".btn-remove-step").onclick = () => {
        if ($$(".gb-order-item", list).length > 2) {
          row.remove();
          sync();
        } else alert("Debe haber al menos 2 pasos");
      };

      // Drag & Drop
      row.addEventListener("dragstart", () => {
        row.classList.add("dragging");
        setTimeout(() => (row.style.opacity = "0.5"), 0);
      });

      row.addEventListener("dragend", () => {
        row.classList.remove("dragging");
        row.style.opacity = "";
        sync();
      });

      list.appendChild(row);
    }

    // DnD en la lista
    list.addEventListener("dragover", (e) => {
      e.preventDefault();
      const dragging = $(".dragging", list);
      const afterElement = getDragAfterElement(list, e.clientY);
      if (afterElement == null) {
        list.appendChild(dragging);
      } else {
        list.insertBefore(dragging, afterElement);
      }
    });

    function getDragAfterElement(container, y) {
      const draggableElements = [
        ...container.querySelectorAll(".gb-order-item:not(.dragging)"),
      ];
      return draggableElements.reduce(
        (closest, child) => {
          const box = child.getBoundingClientRect();
          const offset = y - box.top - box.height / 2;
          if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
          } else {
            return closest;
          }
        },
        { offset: Number.NEGATIVE_INFINITY },
      ).element;
    }

    function read() {
      return $$("input", list)
        .map((i) => i.value.trim())
        .filter(Boolean);
    }

    function sync() {
      setPayload(card, { kind: "ordering", steps: read() });
    }

    const existing = payload?.steps || [];
    if (existing.length === 0) {
      addStep("Observación del problema");
      addStep("Formulación de hipótesis");
      addStep("Experimentación");
      addStep("Conclusión");
    } else {
      existing.forEach(addStep);
    }

    const addBtn = el(
      "button",
      "btn btn-outline-primary btn-sm mt-2",
      "➕ Agregar paso",
    );
    addBtn.type = "button";
    addBtn.onclick = () => {
      addStep();
      sync();
    };

    root.append(list, addBtn);
    root.addEventListener("input", sync);
    sync();
  }

  // ========== CLASIFICAR ==========
  function mountClassify(card, root, payload) {
    root.innerHTML = `
      <div class="alert alert-info small mb-3">
        <strong>💡 Instrucciones:</strong> Crea categorías y asigna elementos a cada una.
      </div>`;

    const wrap = el("div");

    // Categorías
    const catsSection = el("div", "mb-4");
    catsSection.innerHTML = `<h6 class="mb-2">Categorías</h6>`;
    const catsList = el("div", "gb-cats-list");

    function addCat(id = "", label = "") {
      const row = el("div", "input-group mb-2");
      const catId = id || `cat_${Date.now()}_${Math.random()}`;
      row.dataset.catId = catId;
      row.innerHTML = `
        <span class="input-group-text">📦</span>
        <input type="text" class="form-control cat-input" placeholder="Nombre de categoría..." value="${label}">
        <button type="button" class="btn btn-outline-danger btn-remove-cat">✕</button>`;

      row.querySelector(".btn-remove-cat").onclick = () => {
        if ($$(".cat-input", catsList).length > 2) {
          // Eliminar items asociados a esta categoría
          $$(".card", itemsList).forEach((itemRow) => {
            const sel = $(".item-cat", itemRow);
            if (sel && sel.dataset.binId === catId) {
              sel.value = "";
              sel.dataset.binId = "";
            }
          });
          row.remove();
          sync();
        } else alert("Debe haber al menos 2 categorías");
      };

      catsList.appendChild(row);
      return catId;
    }

    const addCatBtn = el(
      "button",
      "btn btn-sm btn-outline-secondary mt-2",
      "➕ Agregar categoría",
    );
    addCatBtn.type = "button";
    addCatBtn.onclick = () => {
      addCat("", "");
      updateItemSelects();
      sync();
    };

    catsSection.append(catsList, addCatBtn);

    // Elementos
    const itemsSection = el("div");
    itemsSection.innerHTML = `<h6 class="mb-2 mt-3">Elementos a clasificar</h6>`;
    const itemsList = el("div", "gb-items-list");

    function addItem(text = "", binId = "") {
      const row = el("div", "card mb-2 p-2");
      row.innerHTML = `
        <div class="row g-2 align-items-center">
          <div class="col">
            <input type="text" class="form-control item-text" placeholder="Elemento..." value="${text}">
          </div>
          <div class="col-auto">
            <select class="form-select item-cat" style="width: 180px;">
              <option value="">Seleccionar categoría...</option>
            </select>
          </div>
          <div class="col-auto">
            <button type="button" class="btn btn-outline-danger btn-sm btn-remove-item">✕</button>
          </div>
        </div>`;

      row.querySelector(".btn-remove-item").onclick = () => {
        row.remove();
        sync();
      };

      const sel = row.querySelector(".item-cat");
      sel.dataset.binId = binId;

      itemsList.appendChild(row);
      updateItemSelects();

      // Restaurar selección después de poblar
      if (binId) {
        sel.value = binId;
        sel.dataset.binId = binId;
      }
    }

    function updateItemSelects() {
      const catRows = $$(".input-group", catsList);

      $$(".item-cat", itemsList).forEach((sel) => {
        const currentBinId = sel.dataset.binId || "";

        sel.innerHTML =
          `<option value="">Seleccionar categoría...</option>` +
          catRows
            .map((row) => {
              const catId = row.dataset.catId;
              const catName =
                $(".cat-input", row)?.value.trim() || "Sin nombre";
              return `<option value="${catId}">${catName}</option>`;
            })
            .join("");

        if (currentBinId) {
          sel.value = currentBinId;
        }

        // Guardar selección al cambiar
        sel.onchange = () => {
          sel.dataset.binId = sel.value;
          sync();
        };
      });
    }

    const addItemBtn = el(
      "button",
      "btn btn-sm btn-outline-primary mt-2",
      "➕ Agregar elemento",
    );
    addItemBtn.type = "button";
    addItemBtn.onclick = () => {
      addItem();
      sync();
    };

    itemsSection.append(itemsList, addItemBtn);

    function read() {
      const cats = [];
      $$(".input-group", catsList).forEach((row) => {
        const id = row.dataset.catId;
        const title = $(".cat-input", row)?.value.trim();
        if (title) {
          cats.push({ id, title });
        }
      });

      const items = [];
      $$(".card", itemsList).forEach((row, i) => {
        const text = $(".item-text", row)?.value.trim();
        const sel = $(".item-cat", row);
        const binId = sel?.dataset.binId || sel?.value;

        if (text && binId && cats.some((c) => c.id === binId)) {
          items.push({
            id: `item_${Date.now()}_${i}`,
            text,
            bin: binId,
          });
        }
      });

      return { bins: cats, items };
    }

    function sync() {
      updateItemSelects();
      const data = read();
      setPayload(card, { kind: "classify", bins: data.bins, items: data.items });
    }

    // Cargar existentes
    const existing = payload?.bins || [];
    const existingItems = payload?.items || [];

    if (existing.length === 0) {
      const cat1 = addCat("", "Animales");
      const cat2 = addCat("", "Plantas");
      addItem("Perro", cat1);
      addItem("Rosa", cat2);
    } else {
      const catMap = {};
      existing.forEach((c) => {
        const oldId = c.id;
        const newId = addCat(oldId, c.title || c.label || c.name);
        catMap[oldId] = newId;
      });

      existingItems.forEach((it) => {
        const mappedBinId = catMap[it.bin] || it.bin;
        addItem(it.text, mappedBinId);
      });
    }

    wrap.append(catsSection, itemsSection);
    root.appendChild(wrap);
    root.addEventListener("input", sync);
    updateItemSelects();
    sync();
  }

  // ========== LABERINTO ==========
  function mountLabyrinth(card, root, payload) {
    root.innerHTML = `
      <div class="alert alert-info small mb-3">
        <strong>💡 Instrucciones:</strong> Crea puertas con preguntas. El estudiante debe responder correctamente para avanzar.
      </div>`;

    const list = el("div", "gb-labyrinth-list");

    function addDoor(question = "", correctAnswer = "", wrongAnswers = ["", ""]) {
      const box = el("div", "card mb-3 p-3");

      box.innerHTML = `
        <div class="mb-2">
          <label class="form-label small fw-bold">🚪 Pregunta de la puerta</label>
          <input type="text" class="form-control door-question" placeholder="¿Cuál es la capital de Chile?" value="${question}">
        </div>
        
        <div class="mb-2">
          <label class="form-label small fw-bold">✅ Respuesta correcta</label>
          <input type="text" class="form-control door-correct" placeholder="Santiago" value="${correctAnswer}">
        </div>
        
        <div class="mb-2">
          <label class="form-label small fw-bold">❌ Respuestas incorrectas</label>
          <div class="door-wrong-list"></div>
          <button type="button" class="btn btn-sm btn-outline-secondary mt-2 btn-add-wrong">➕ Agregar incorrecta</button>
        </div>
        
        <div class="text-end">
          <button type="button" class="btn btn-sm btn-outline-danger btn-remove-door">🗑 Eliminar puerta</button>
        </div>`;

      const wrongList = box.querySelector(".door-wrong-list");

      function addWrong(text = "") {
        const row = el("div", "input-group mb-2");
        row.innerHTML = `
          <input type="text" class="form-control door-wrong" placeholder="Respuesta incorrecta..." value="${text}">
          <button type="button" class="btn btn-outline-danger btn-remove-wrong">✕</button>`;

        row.querySelector(".btn-remove-wrong").onclick = () => {
          if ($$(".door-wrong", wrongList).length > 1) {
            row.remove();
            sync();
          } else alert("Debe haber al menos 1 respuesta incorrecta");
        };

        wrongList.appendChild(row);
      }

      wrongAnswers.forEach((w) => addWrong(w));
      if (wrongAnswers.length === 0) {
        addWrong("");
        addWrong("");
      }

      box.querySelector(".btn-add-wrong").onclick = () => {
        if ($$(".door-wrong", wrongList).length < 5) {
          addWrong();
          sync();
        } else alert("Máximo 5 respuestas incorrectas");
      };

      box.querySelector(".btn-remove-door").onclick = () => {
        if (confirm("¿Eliminar esta puerta?")) {
          box.remove();
          sync();
        }
      };

      list.appendChild(box);
    }

    function read() {
      const doors = [];
      $$(".card", list).forEach((box, i) => {
        const question = $(".door-question", box)?.value.trim();
        const correct = $(".door-correct", box)?.value.trim();
        const wrong = $$(".door-wrong", box)
          .map((inp) => inp.value.trim())
          .filter(Boolean);

        if (question && correct && wrong.length > 0) {
          doors.push({
            id: `door_${i + 1}`,
            question,
            correctAnswer: correct,
            wrongAnswers: wrong,
          });
        }
      });
      return doors;
    }

    function sync() {
      const doors = read();
      setPayload(card, { kind: "labyrinth", doors });
    }

    const existing = payload?.doors || [];
    if (existing.length === 0) {
      addDoor("¿Cuál es la capital de Chile?", "Santiago", [
        "Valparaíso",
        "Concepción",
      ]);
      addDoor("¿Cuánto es 5 + 3?", "8", ["6", "10", "11"]);
    } else {
      existing.forEach((d) => addDoor(d.question, d.correctAnswer, d.wrongAnswers));
    }

    const addBtn = el(
      "button",
      "btn btn-outline-primary btn-sm mt-3",
      "➕ Agregar puerta",
    );
    addBtn.type = "button";
    addBtn.onclick = () => {
      addDoor();
      sync();
    };

    root.append(list, addBtn);
    root.addEventListener("input", sync);
    sync();
  }

  // ========== TIENDA ==========
  function mountShop(card, root, payload) {
    root.innerHTML = `
      <div class="alert alert-info small mb-3">
        <strong>💡 Instrucciones:</strong> Crea productos con precios. El estudiante debe calcular el total.
      </div>`;

    const list = el("div", "gb-shop-list");

    function addProduct(name = "", price = 0) {
      const row = el("div", "card mb-2 p-2");
      row.innerHTML = `
        <div class="row g-2 align-items-center">
          <div class="col">
            <input type="text" class="form-control product-name" placeholder="Nombre del producto" value="${name}">
          </div>
          <div class="col-auto">
            <div class="input-group" style="width: 150px;">
              <span class="input-group-text">$</span>
              <input type="number" class="form-control product-price" min="1" value="${price || 100}">
            </div>
          </div>
          <div class="col-auto">
            <button type="button" class="btn btn-outline-danger btn-sm btn-remove-product">✕</button>
          </div>
        </div>`;

      row.querySelector(".btn-remove-product").onclick = () => {
        if ($$(".card", list).length > 2) {
          row.remove();
          sync();
        } else alert("Debe haber al menos 2 productos");
      };

      list.appendChild(row);
    }

    function read() {
      const products = [];
      $$(".card", list).forEach((row, i) => {
        const name = $(".product-name", row)?.value.trim();
        const price = parseInt($(".product-price", row)?.value) || 0;

        if (name && price > 0) {
          products.push({ id: `prod_${i + 1}`, name, price });
        }
      });
      return products;
    }

    function sync() {
      const products = read();
      const budget = parseInt($("#shop-budget", root)?.value) || 1000;
      setPayload(card, { kind: "shop", products, budget });
    }

    const existing = payload?.products || [];
    const budget = payload?.budget || 1000;

    // Campo de presupuesto
    const budgetDiv = el("div", "mb-3");
    budgetDiv.innerHTML = `
      <label class="form-label fw-bold">💰 Presupuesto del estudiante</label>
      <div class="input-group" style="max-width: 200px;">
        <span class="input-group-text">$</span>
        <input type="number" id="shop-budget" class="form-control" min="100" value="${budget}">
      </div>
      <div class="form-text">El estudiante debe comprar productos sin exceder este monto</div>`;

    if (existing.length === 0) {
      addProduct("Manzana", 500);
      addProduct("Pan", 300);
      addProduct("Leche", 800);
    } else {
      existing.forEach((p) => addProduct(p.name, p.price));
    }

    const addBtn = el(
      "button",
      "btn btn-outline-primary btn-sm mt-2",
      "➕ Agregar producto",
    );
    addBtn.type = "button";
    addBtn.onclick = () => {
      addProduct();
      sync();
    };

    root.append(
      budgetDiv,
      el("h6", "mb-2", "Productos disponibles"),
      list,
      addBtn,
    );
    root.addEventListener("input", sync);
    sync();
  }

  // ========== COMPLETAR ESPACIOS (CLOZE) ==========
function mountCloze(card, root, payload) {
  // Instrucciones
  root.innerHTML = `
    <div class="alert alert-info small mb-3">
      <strong>💡 Instrucciones:</strong> Escribe el texto y marca las palabras que serán espacios en blanco.
      Haz doble clic sobre una palabra para convertirla en espacio.
    </div>`;

  const textArea = el("textarea", "form-control mb-3");
  textArea.rows = 4;
  textArea.placeholder =
    "Escribe tu texto aquí. Ejemplo:\nLa capital de Chile es Santiago.\nEl océano más grande es el Pacífico.";

  const preview = el("div", "card p-3 mb-3 bg-light");
  preview.innerHTML =
    '<small class="text-muted">Vista previa: (doble clic para marcar espacios)</small><div class="cloze-preview mt-2"></div>';

  const blanksSection = el("div", "mb-3");
  blanksSection.innerHTML = `<h6 class="mb-2">Espacios en blanco detectados:</h6>`;
  const blanksList = el("div", "gb-blanks-list small text-muted");
  blanksSection.appendChild(blanksList);

  // Caja para distractores
  const distractorsBox = el("div", "mb-3");
  const distractorsLabel = el("label", "form-label fw-bold", "Distractores adicionales (opcional)");
  const distractorsHint = el(
  "div",
  "form-text mb-1",
  "Escribe palabras o números separados por punto y coma (;). Puedes usar coma como decimal. Ej: 3,5; 2,75; 10; 0,5"
  );

  const distractorsInput = el("textarea", "form-control form-control-sm");
  distractorsInput.rows = 2;
  distractorsInput.placeholder = "Ejemplo: Roma, París, Lima, Atlántico, Índico";

  distractorsBox.appendChild(distractorsLabel);
  distractorsBox.appendChild(distractorsHint);
  distractorsBox.appendChild(distractorsInput);

  // Estado actual (cuando se edita)
  let currentBlanks = payload?.blanks || payload?.answers || {};
  let currentTextWithPlaceholders = payload?.text || "";
  const savedDistractors = Array.isArray(payload?.distractors)
    ? payload.distractors
    : [];

  function updatePreview() {
    const text = textArea.value || "";
    const previewDiv = preview.querySelector(".cloze-preview");
    const words = text.split(/(\s+)/);

    previewDiv.innerHTML = "";
    blanksList.innerHTML = "";

    // cuántas veces debe marcarse cada respuesta
    const counters = {};
    if (currentBlanks && typeof currentBlanks === "object") {
      Object.keys(currentBlanks).forEach((id) => {
        const ans = (currentBlanks[id]?.answer || "").trim();
        if (!ans) return;
        counters[ans] = (counters[ans] || 0) + 1;
      });
    }

    words.forEach((word) => {
      // espacios reales (saltos, etc.)
      if (/^\s+$/.test(word)) {
        previewDiv.appendChild(document.createTextNode(word));
        return;
      }

      const span = el("span", "cloze-word");
      span.textContent = word;
      span.style.cssText =
        "cursor: pointer; padding: 4px 8px; border-radius: 8px; margin:2px; display:inline-block;";

      // restaurar marcados según respuestas guardadas
      if (counters[word] > 0) {
        counters[word] -= 1;
        span.classList.add("marked");
        span.style.backgroundColor = "#ffc107";
        span.style.fontWeight = "bold";
      }

      // doble clic para marcar / desmarcar espacio
      span.ondblclick = () => {
        span.classList.toggle("marked");
        if (span.classList.contains("marked")) {
          span.style.backgroundColor = "#ffc107";
          span.style.fontWeight = "bold";
        } else {
          span.style.backgroundColor = "";
          span.style.fontWeight = "";
        }
        sync();
      };

      previewDiv.appendChild(span);
    });

    const marked = $$(".cloze-word.marked", previewDiv);
    if (marked.length === 0) {
      blanksList.innerHTML =
        "<em>Haz doble clic en las palabras para marcarlas como espacios</em>";
    } else {
      blanksList.innerHTML =
        `<strong>${marked.length} espacios:</strong> ` +
        marked.map((s) => s.textContent).join(", ");
    }
  }

  function sync() {
    const previewDiv = preview.querySelector(".cloze-preview");
    const marked = $$(".cloze-word.marked", previewDiv);
    const blanks = {};

    let textWithBlanks = textArea.value || "";

    // Reemplazar cada palabra marcada por [[n]]
    marked.forEach((span, i) => {
      const word = span.textContent;
      const key = String(i + 1);
      blanks[key] = { answer: word }; 
      // reemplaza solo la primera ocurrencia
      textWithBlanks = textWithBlanks.replace(word, `[[${key}]]`);
    });

    // Construir banco: respuestas correctas + distractores escritos por el docente
    const answers = Object.values(blanks)
      .map((b) => (b.answer || "").trim())
      .filter(Boolean);

    const answerSet = new Set(answers);

    // Ahora los distractores se separan por punto y coma (;) o salto de línea
    const extraRaw = (distractorsInput.value || "")
      .split(/;|\n/)
      .map((w) => w.trim())
      .filter(Boolean);


    // quitar duplicados y evitar repetir respuestas correctas
    const extraUnique = [...new Set(extraRaw)].filter(
      (w) => !answerSet.has(w)
    );

    const bank = [...new Set([...answers, ...extraUnique])];

    currentBlanks = blanks;
    currentTextWithPlaceholders = textWithBlanks;

    setPayload(card, {
      kind: "cloze",
      text: textWithBlanks,
      blanks,
      bank,             // usado por cloze.js
      distractors: extraUnique, // para poder volver a editarlos en el builder
    });

    updatePreview();
  }

  // Cargar existente
  if (currentTextWithPlaceholders) {
    // Reemplazar [[n]] por la respuesta guardada para mostrar texto plano
    textArea.value = currentTextWithPlaceholders.replace(
      /\[\[(\d+)\]\]/g,
      (match, num) => currentBlanks[num]?.answer || "___",
    );
  } else {
    textArea.value =
      "La capital de Chile es Santiago.\nEl océano más grande es el Pacífico.";
  }

  if (savedDistractors.length) {
    distractorsInput.value = savedDistractors.join("; ");
  }

  textArea.addEventListener("input", () => {
    // Si cambia el texto, se pierde el mapeo anterior de blanks
    currentBlanks = {};
    currentTextWithPlaceholders = "";
    sync()
  });

  // cuando cambian los distractores, solo se vuelve a calcular el banco
  distractorsInput.addEventListener("input", () => {
    sync();
  });

  // Añadir al DOM (se respeta el bloque de instrucciones inicial)
  root.append(textArea, preview, blanksSection, distractorsBox);
  updatePreview();
}

  // ========== MONTADOR PRINCIPAL ==========
  function mountOne(card) {
    if (card.dataset.gbMounted === "1") return;

    const builder = $(".gbuilder", card);
    const kindSel = card.querySelector('select[name$="-item_kind"]');
    const ta = card.querySelector('textarea[name$="-game_pairs"]');

    if (!builder || !kindSel || !ta) return;

    function current() {
      try {
        return JSON.parse(ta.value || "{}");
      } catch {
        return {};
      }
    }

    function render() {
      const k = (kindSel.value || "trivia").toLowerCase();
      const payload = current();

      builder.style.border = "1px solid #dee2e6";
      builder.style.borderRadius = "8px";
      builder.style.padding = "16px";
      builder.style.backgroundColor = "#f8f9fa";

      if (k === "trivia") mountTrivia(card, builder, payload);
      else if (k === "vf") mountVF(card, builder, payload);
      else if (k === "ordering") mountOrdering(card, builder, payload);
      else if (k === "classify") mountClassify(card, builder, payload);
      else if (k === "cloze") mountCloze(card, builder, payload);
      else if (k === "memory" || k === "dragmatch" || k === "dragandmatch") {
        mountPairs(card, builder, payload, k);
      } else {
        builder.innerHTML =
          '<div class="text-muted text-center py-4">Selecciona un tipo de actividad</div>';
      }
    }

    kindSel.addEventListener("change", render);
    render();
    card.dataset.gbMounted = "1";
  }

  // ========== INICIALIZACIÓN ==========
  function init() {
    $$(".item-form").forEach(mountOne);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  document.addEventListener("formset:item-added", (e) => {
    if (e.detail?.node) mountOne(e.detail.node);
  });
})();