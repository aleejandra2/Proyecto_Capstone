// static/LevelUp/js/actividad_dynamic.js
(function () {
    const itemsContainer = document.getElementById("items-container");
    const addBtn = document.getElementById("btn-add-item");
    const quickAddLinks = document.querySelectorAll(".add-item-kind");

    // --- Sugerencias por tipo de Actividad ---
    const tipoActividad = document.getElementById("id_tipo");
    const ayudaLista = document.getElementById("lista-ayuda-tipo");
    const ayudasPorTipo = {
        quiz: [
            "Añade ítems de <strong>Opción múltiple</strong> o <strong>Verdadero/Falso</strong>.",
            "Define <strong>XP total</strong> y <strong>fecha de cierre</strong> si aplica.",
        ],
        video: [
            "Indica la <strong>URL del video</strong> en Recurso.",
            "Agrega ítems de <strong>Texto</strong> para reflexión.",
        ],
        juego: [
            "Usa ítems <strong>Interactivo/Juego</strong> con URL embebible.",
            "Puedes complementar con <strong>Opción múltiple</strong>.",
        ],
        tarea: [
            "Usa ítems de <strong>Texto (abierta)</strong> o <strong>Imagen</strong> para la entrega.",
            "Establece <strong>fecha de cierre</strong> si necesitas límite.",
        ],
    };
    function renderAyudaActividad() {
        if (!tipoActividad || !ayudaLista) return;
        const t = (tipoActividad.value || "").toLowerCase();
        const tips = ayudasPorTipo[t] || ["Selecciona un tipo para ver recomendaciones."];
        ayudaLista.innerHTML = tips.map(x => `<li>${x}</li>`).join("");
    }
    if (tipoActividad) {
        tipoActividad.addEventListener("change", renderAyudaActividad);
        renderAyudaActividad();
    }

    // --------- Ítems ----------
    function qsa(el, sel) { return Array.prototype.slice.call(el.querySelectorAll(sel)); }
    function findField(block, suffix) {
        return block.querySelector(`input[name$='${suffix}'], select[name$='${suffix}'], textarea[name$='${suffix}']`);
    }
    function show(el) { if (el) { el.classList.remove("d-none"); el.style.display = ""; } }
    function hide(el) { if (el) { el.classList.add("d-none"); el.style.display = "none"; } }

    function aplicarVisibilidadItem(block) {
        const selectTipo = findField(block, "-tipo");
        if (!selectTipo) return;
        const val = (selectTipo.value || "").toLowerCase();

        const mcqBlock = block.querySelector(".item-mcq-block");
        const tfBlock = block.querySelector(".item-tf-block");

        switch (val) {
            case "mcq":
                show(mcqBlock); hide(tfBlock); break;
            case "tf":
                hide(mcqBlock); show(tfBlock); break;
            case "text": // abierta
            default:
                hide(mcqBlock); hide(tfBlock); break;
        }
    }

    function prepararItem(block) {
        if (!block || block.dataset.prepared === "1") return;
        const selectTipo = findField(block, "-tipo");
        if (selectTipo) {
            selectTipo.addEventListener("change", () => aplicarVisibilidadItem(block));
        }
        aplicarVisibilidadItem(block);
        block.dataset.prepared = "1";
    }

    // Existentes
    qsa(itemsContainer, ".item-form").forEach(prepararItem);

    // Nuevos añadidos por el formset dinámico
    const obs = new MutationObserver(muts => {
        muts.forEach(m => {
            m.addedNodes.forEach(n => {
                if (n.nodeType === 1 && n.classList.contains("item-form")) {
                    prepararItem(n);
                    const pendingKind = itemsContainer.dataset.pendingKind;
                    if (pendingKind) {
                        const tipo = findField(n, "-tipo");
                        if (tipo) {
                            tipo.value = pendingKind;
                            tipo.dispatchEvent(new Event("change", { bubbles: true }));
                        }
                        delete itemsContainer.dataset.pendingKind;
                    }
                }
            });
        });
    });
    obs.observe(itemsContainer, { childList: true });

    // Agregar ítem rápido (preselecciona tipo)
    function handleQuickAdd(e) {
        e.preventDefault();
        const kind = e.currentTarget.getAttribute("data-kind");
        if (!kind) return;
        itemsContainer.dataset.pendingKind = kind;
        if (addBtn) addBtn.click();
    }
    quickAddLinks.forEach(a => a.addEventListener("click", handleQuickAdd));
})();
