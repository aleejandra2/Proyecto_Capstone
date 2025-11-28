// static/LevelUp/js/actividad_formset.js

(function () {
    const byId = (id) => document.getElementById(id);
    const qs = (sel, root = document) => root.querySelector(sel);
    const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

    // máximo de ítems en modo minijuego
    let maxGameItems = 3;

    function currentMode() {
        const sel = byId("id_tipo");
        return sel && sel.value === "game" ? "game" : "quiz";
    }

    function countVisible(container) {
        return qsa(".item-form:not([data-deleted='1'])", container).length;
    }

    // === Opciones por modo ===
    function setKindOptions(selectEl, mode) {
        if (!selectEl) return;

        const QUIZ = [
            ["dragmatch", "Drag & Match"],
            ["memory", "Memoria (pares)"],
            ["trivia", "Trivia (opción múltiple)"],
            ["vf", "Verdadero / Falso"],
            ["classify", "Clasificar en categorías"],
            ["cloze", "Completar (cloze)"],
            ["ordering", "Ordenar pasos"],
            // ["labyrinth", "Laberinto de puertas"],
            // ["shop", "Tienda (precios)"],
        ];
        const GAME = [
            ["trivia", "Pregunta (múltiple)"],
        ];

        const options = mode === "game" ? GAME : QUIZ;
        const cur = selectEl.value;

        selectEl.innerHTML = options.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");

        if (options.some(([v]) => v === cur)) {
            selectEl.value = cur;
        } else {
            selectEl.value = mode === "game" ? "trivia" : "dragmatch";
        }
    }

    function normalizeCardForMode(card, mode) {
        const selectKind = qs("select[name$='-item_kind']", card);
        setKindOptions(selectKind, mode);
    }

    function renumberCards(container) {
        qsa(".item-form:not([data-deleted='1'])", container).forEach((card, i) => {
            const h = qs(".h6", card);
            if (h) h.textContent = `Ítem #${i + 1}`;
        });
    }

    function updateTotalForms(container) {
        const total = byId("id_items-TOTAL_FORMS");
        if (!total) return;
        const allCards = qsa(".item-form", container);
        total.value = allCards.length;
        console.log(`📊 TOTAL_FORMS actualizado a: ${allCards.length}`);
    }

    // UI para modo minijuego (instrucciones y botón deshabilitado)
    function updateGameModeUI(mode, container) {
        const help = byId("game-mode-help");
        const addBtn = byId("btn-add-item");

        const visibles = container ? countVisible(container) : 0;

        if (help) {
            const spans = help.querySelectorAll('[data-role="game-max-enemies"]');
            spans.forEach(s => s.textContent = String(maxGameItems));
        }

        if (mode === "game") {
            if (help) help.classList.remove("d-none");
            if (addBtn) {
                addBtn.disabled = visibles >= maxGameItems;
                addBtn.title = visibles >= maxGameItems
                    ? `Ya creaste los ${maxGameItems} ítems (uno por cada enemigo).`
                    : "";
            }
        } else {
            if (help) help.classList.add("d-none");
            if (addBtn) {
                addBtn.disabled = false;
                addBtn.title = "";
            }
        }
    }

    // === DELETE seguro ===
    function markDeleted(card, container, itemId = null) {
        const del = qs("input[name$='-DELETE']", card);
        if (del) {
            del.value = "1";
            del.checked = true;
        }
        card.dataset.deleted = "1";

        const body = qs(".card-body", card);
        if (body) {
            body.innerHTML = `<div class="alert alert-warning mb-0">🗑 Ítem ${itemId ? `#${itemId} ` : ""}marcado para eliminar.</div>`;
        }
        card.classList.add("opacity-50");

        qsa("input, select, textarea, button", card).forEach(el => {
            if (!el.name?.endsWith("-DELETE")) el.disabled = true;
        });

        renumberCards(container);
        updateGameModeUI(currentMode(), container);
        console.log(`🗑 Ítem ${itemId || 'nuevo'} marcado para eliminación`);
    }

    function bindRemove(card, container) {
        const btn = qs(".btn-remove-card", card);
        if (!btn) return;

        btn.addEventListener("click", () => {
            let itemId = null, index = null;
            const anyInput = qs("input[name^='items-']", card);
            if (anyInput) {
                const m = anyInput.name.match(/items-(\d+)-/);
                if (m) index = m[1];
            }
            if (index != null) {
                const idInput = document.querySelector(`input[name="items-${index}-id"]`);
                if (idInput && idInput.value && idInput.value.trim() !== "" && idInput.value !== "None") {
                    itemId = idInput.value.trim();
                }
            }

            const hasId = !!itemId;

            if (!confirm(`¿Eliminar ítem${hasId ? ` #${itemId}` : ""}? Esta acción no se puede deshacer.`)) return;

            if (hasId) {
                // Eliminar del servidor vía AJAX
                const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || "";
                fetch(`/actividades/item/${itemId}/eliminar/`, {
                    method: "POST",
                    headers: { "X-CSRFToken": csrfToken, "Content-Type": "application/json" }
                })
                    .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
                    .then(data => {
                        if (!data.ok) throw new Error(data.error || "Fallo servidor");
                        console.log(`✅ Ítem #${itemId} eliminado del servidor`);
                        markDeleted(card, container, itemId);
                    })
                    .catch(err => {
                        console.error("❌ Error eliminando ítem:", err);
                        alert(`Error al eliminar ítem #${itemId}: ${err.message}`);
                    });
            } else {
                // Ítem nuevo: solo marcar DELETE
                markDeleted(card, container, null);
            }
        });
    }

    // === Plantilla base JSON ===
    function initTextareaTemplate(card, kind) {
        const ta = qs("textarea[name$='-game_pairs']", card) || qs("textarea[name$='-datos']", card);
        if (!ta) return;

        // Si ya tiene contenido JSON válido, no sobrescribir
        const current = ta.value.trim();
        if (current) {
            try {
                const parsed = JSON.parse(current);
                if (parsed && typeof parsed === 'object') {
                    console.log(`📝 Textarea ya tiene datos válidos, no sobrescribir`);
                    return;
                }
            } catch (e) {
                // JSON inválido, crear nuevo
            }
        }

        const base = { kind };
        if (kind === "trivia") base.questions = [];
        else if (kind === "memory" || kind === "dragmatch") base.pairs = [];
        else if (kind === "vf") base.items = [];
        else if (kind === "ordering") base.steps = [];
        else if (kind === "classify") { base.bins = []; base.items = []; }
        // else if (kind === "labyrinth") base.doors = [];
        // else if (kind === "shop") { base.products = []; base.budget = 1000; }
        else if (kind === "cloze") base.text = "";

        ta.value = JSON.stringify(base, null, 2);
        console.log(`📝 Plantilla JSON creada para kind="${kind}"`);
    }

    function bindKind(card) {
        const sel = qs("select[name$='-item_kind']", card);
        if (!sel) return;
        const mode = currentMode();
        setKindOptions(sel, mode);

        // Plantilla al cargar (solo si está vacío)
        initTextareaTemplate(card, sel.value);

        // Y cuando cambie
        sel.addEventListener("change", () => {
            const ta = qs("textarea[name$='-game_pairs']", card);
            if (ta) {
                // Al cambiar kind, crear nueva plantilla
                ta.value = "";
                initTextareaTemplate(card, sel.value);
            }
            try { window.GB && window.GB.mount && window.GB.mount(card); } catch (e) { /* noop */ }
        });
    }

    function bindBuilder(card) {
        try { window.GB && window.GB.mount && window.GB.mount(card); } catch (e) { /* noop */ }
    }

    function wireCard(card, container) {
        bindRemove(card, container);
        bindKind(card);
        normalizeCardForMode(card, currentMode());
        bindBuilder(card);
    }

    function nextIndex() {
        const total = byId("id_items-TOTAL_FORMS");
        return total ? parseInt(total.value || "0", 10) : 0;
    }

    // === Agregar ítem ===
    function addItem(container, mode, forceKind = null) {
        // Límite específico para minijuego
        if (mode === "game") {
            const visibles = countVisible(container);
            if (visibles >= maxGameItems) {
                alert(`Este minijuego tiene ${maxGameItems} enemigos.\nYa creaste un ítem por cada enemigo, no puedes agregar más.`);
                updateGameModeUI(mode, container);
                return;
            }
        }

        const tpl = byId("empty-form-template");
        if (!tpl) {
            console.error("❌ No se encontró #empty-form-template");
            return;
        }

        const idx = nextIndex();
        const html = tpl.innerHTML.replaceAll("__prefix__", idx);

        const frag = document.createElement("div");
        frag.innerHTML = html.trim();
        const card = frag.firstElementChild;
        if (!card) return;

        // Actualizar TOTAL_FORMS antes de insertar
        const total = byId("id_items-TOTAL_FORMS");
        if (total) {
            total.value = idx + 1;
            console.log(`➕ TOTAL_FORMS incrementado: ${idx} → ${idx + 1}`);
        }

        container.appendChild(card);

        // Configurar defaults
        const kindSel = qs(`select[name="items-${idx}-item_kind"]`, card);
        setKindOptions(kindSel, mode);
        if (forceKind && kindSel) kindSel.value = forceKind;

        // Plantilla JSON inicial
        initTextareaTemplate(card, (kindSel && kindSel.value) || "trivia");

        wireCard(card, container);
        renumberCards(container);
        updateGameModeUI(mode, container);

        document.dispatchEvent(new CustomEvent("formset:item-added", { detail: { node: card, index: idx } }));
        console.log(`✅ Ítem #${idx + 1} agregado correctamente`);
    }

    function normalizeAll(container) {
        const mode = currentMode();
        qsa(".item-form:not([data-deleted='1'])", container).forEach(card => {
            normalizeCardForMode(card, mode);
        });
        renumberCards(container);
        updateTotalForms(container);
    }

    // === Validación antes de submit ===
    function validateBeforeSubmit(form, container) {
        let hasErrors = false;
        const items = qsa(".item-form:not([data-deleted='1'])", container);

        console.log("\n🔍 Validando formulario antes de enviar:");
        console.log(`   Total ítems visibles: ${items.length}`);

        items.forEach((card, i) => {
            const enun = qs("textarea[name$='-enunciado']", card);
            const punt = qs("input[name$='-puntaje']", card);
            const payload = qs("textarea[name$='-game_pairs']", card);

            const enunVal = enun ? enun.value.trim() : "";
            const puntVal = punt ? punt.value.trim() : "";
            const payVal = payload ? payload.value.trim() : "";

            const tieneContenido = !!(payVal || enunVal || puntVal);

            console.log(`   Ítem ${i + 1}:`);
            console.log(`      Enunciado: ${enunVal.length} chars`);
            console.log(`      Puntaje: ${puntVal}`);
            console.log(`      Payload: ${payVal.length} chars`);
            console.log(`      Tiene contenido: ${tieneContenido}`);

            if (tieneContenido) {
                if (!enunVal) {
                    console.warn(`      ⚠️ Falta enunciado`);
                    if (enun) {
                        enun.classList.add('is-invalid');
                        let errDiv = enun.nextElementSibling;
                        if (!errDiv || !errDiv.classList.contains('invalid-feedback')) {
                            errDiv = document.createElement('div');
                            errDiv.className = 'invalid-feedback d-block';
                            enun.parentNode.insertBefore(errDiv, enun.nextSibling);
                        }
                        errDiv.textContent = 'El enunciado es obligatorio cuando el ítem tiene contenido.';
                    }
                    hasErrors = true;
                }
                if (!puntVal || isNaN(Number(puntVal))) {
                    console.warn(`      ⚠️ Falta puntaje válido`);
                    if (punt) {
                        punt.classList.add('is-invalid');
                        let errDiv = punt.nextElementSibling;
                        if (!errDiv || !errDiv.classList.contains('invalid-feedback')) {
                            errDiv = document.createElement('div');
                            errDiv.className = 'invalid-feedback d-block';
                            punt.parentNode.insertBefore(errDiv, punt.nextSibling);
                        }
                        errDiv.textContent = 'El puntaje es obligatorio cuando el ítem tiene contenido.';
                    }
                    hasErrors = true;
                }
            }
        });

        return !hasErrors;
    }

    // === Inicialización ===
    document.addEventListener("DOMContentLoaded", () => {
        const container = byId("items-container");
        if (!container) {
            console.warn("⚠️ No se encontró #items-container");
            return;
        }

        console.log("🚀 Inicializando formset...");

        // Leer máximo de ítems desde el data-attribute (si existe)
        const root = byId("items-formset");
        if (root) {
            const fromData = parseInt(root.dataset.gameMaxItems || "3", 10);
            if (!isNaN(fromData) && fromData > 0) {
                maxGameItems = fromData;
            }
        }

        // Reset DELETE y cablear tarjetas existentes
        qsa(".item-form", container).forEach((card, i) => {
            const del = qs("input[name$='-DELETE']", card);
            if (del) {
                del.value = "";
                del.checked = false;
            }
            delete card.dataset.deleted;

            // Log IDs existentes
            const anyInput = qs("input[name^='items-']", card);
            if (anyInput) {
                const m = anyInput.name.match(/items-(\d+)-/);
                if (m) {
                    const index = m[1];
                    const idInput = qs(`input[name="items-${index}-id"]`, card);
                    if (idInput && idInput.value) {
                        console.log(`📦 Ítem ${i + 1} (ID: ${idInput.value}) cargado`);
                    }
                }
            }

            wireCard(card, container);
        });

        normalizeAll(container);

        // Si ya está en modo "game" y no hay ítems visibles, crear 3 por defecto
        if (currentMode() === "game" && !qsa(".item-form:not([data-deleted='1'])", container).length) {
            addItem(container, "game", "trivia");
            addItem(container, "game", "trivia");
            addItem(container, "game", "trivia");
        }

        updateGameModeUI(currentMode(), container);

        const tipoSel = byId("id_tipo");
        if (tipoSel) {
            tipoSel.addEventListener("change", () => {
                const mode = currentMode();
                normalizeAll(container);

                if (mode === "game") {
                    const visibles = qsa(".item-form:not([data-deleted='1'])", container);
                    if (!visibles.length) {
                        // 3 preguntas, una para cada enemigo
                        addItem(container, "game", "trivia");
                        addItem(container, "game", "trivia");
                        addItem(container, "game", "trivia");
                    }
                }
                updateGameModeUI(mode, container);
            });
        }

        const btnAdd = byId("btn-add-item");
        if (btnAdd) btnAdd.addEventListener("click", () => addItem(container, currentMode()));

        // Validación y debug al enviar
        const form = byId("actividad-form");
        if (form) {
            form.addEventListener("submit", (e) => {
                const items = qsa(".item-form:not([data-deleted='1'])", container);
                const totalForms = byId("id_items-TOTAL_FORMS");

                console.log("\n📤 Enviando formulario:");
                console.log(`   TOTAL_FORMS: ${totalForms ? totalForms.value : 'N/A'}`);
                console.log(`   Ítems visibles: ${items.length}`);
                console.log(`   Ítems totales (incluye eliminados): ${qsa(".item-form", container).length}`);

                // Validar antes de enviar
                if (!validateBeforeSubmit(form, container)) {
                    e.preventDefault();
                    alert("⚠️ Por favor completa los campos obligatorios de todos los ítems con contenido.");
                    return false;
                }

                // Log de cada ítem que se enviará
                items.forEach((card, i) => {
                    const anyInput = qs("input[name^='items-']", card);
                    if (anyInput) {
                        const m = anyInput.name.match(/items-(\d+)-/);
                        if (m) {
                            const idx = m[1];
                            const idInput = qs(`input[name="items-${idx}-id"]`, card);
                            const enunInput = qs(`textarea[name="items-${idx}-enunciado"]`, card);
                            const puntInput = qs(`input[name="items-${idx}-puntaje"]`, card);
                            const payloadInput = qs(`textarea[name="items-${idx}-game_pairs"]`, card);

                            console.log(`   [${i + 1}] items-${idx}:`);
                            console.log(`       ID: ${idInput ? idInput.value : 'NUEVO'}`);
                            console.log(`       Enunciado: ${enunInput ? enunInput.value.substring(0, 30) + '...' : 'N/A'}`);
                            console.log(`       Puntaje: ${puntInput ? puntInput.value : 'N/A'}`);
                            console.log(`       Payload: ${payloadInput ? payloadInput.value.length + ' chars' : 'N/A'}`);
                        }
                    }
                });
            });
        }

        console.log("✅ Formset inicializado correctamente");
    });
})();
