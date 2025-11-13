// actividad_formset.js — inline formset (add/remove) + sincronización del Game Builder
(function () {
    document.addEventListener("DOMContentLoaded", () => {
        const form = document.getElementById("actividad-form");
        const container = document.getElementById("items-container");
        const addBtn = document.getElementById("btn-add-item");
        const tmpl = document.getElementById("empty-form-template");
        const totalInput = document.querySelector('[name$="-TOTAL_FORMS"]');

        if (!form || !container || !tmpl || !totalInput) return;

        // Reemplaza __prefix__ por el índice real en name/id/for/aria-describedby
        function replacePrefixInNode(root, idx) {
            const ATTRS = ["name", "id", "for", "aria-describedby"];
            const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
            while (tw.nextNode()) {
                const el = tw.currentNode;
                ATTRS.forEach((a) => {
                    if (!el.hasAttribute?.(a)) return;
                    const v = el.getAttribute(a);
                    if (v && v.includes("__prefix__")) {
                        el.setAttribute(a, v.replace(/__prefix__/g, idx));
                    }
                });
            }
        }

        // Marcar/eliminar una tarjeta
        function bindRemove(card) {
            const btn = card.querySelector(".btn-remove-item");
            if (!btn) return;

            btn.addEventListener("click", (e) => {
                e.preventDefault();
                const delFlag = card.querySelector('input[type="checkbox"][name$="-DELETE"]');

                // Ítem ya existente -> marcar DELETE y quitar del DOM
                if (delFlag) {
                    delFlag.checked = true;
                    card.remove();
                } else {
                    // Ítem nuevo -> sólo decrementar el TOTAL_FORMS y quitar del DOM
                    card.remove();
                    const n = Math.max(0, (parseInt(totalInput.value || "0", 10) - 1));
                    totalInput.value = String(n);
                }
            });
        }

        function initCard(card) {
            bindRemove(card);
            // Montar el builder en esa tarjeta
            if (window.GB?.mountOne) window.GB.mountOne(card);
        }

        function addItem() {
            const idx = parseInt(totalInput.value || "0", 10);
            const node = tmpl.content.cloneNode(true);
            replacePrefixInNode(node, idx);
            container.appendChild(node);
            totalInput.value = String(idx + 1);

            const card = container.querySelector(".item-form:last-of-type");
            if (card) {
                initCard(card);
                card.scrollIntoView({ behavior: "smooth", block: "center" });
                document.dispatchEvent(new CustomEvent("formset:item-added", { detail: { node: card } }));
            }
        }

        // Iniciales
        container.querySelectorAll(".item-form").forEach(initCard);

        // Agregar nuevo
        addBtn?.addEventListener("click", (e) => { e.preventDefault(); addItem(); });

        // Antes de enviar: asegurar que el builder sincronice sus <textarea> (game_pairs)
        form.addEventListener("submit", () => {
            if (window.GB?.syncAll) window.GB.syncAll(container);
            // mini ayuda: tras el postback, enfocar el primer error
            setTimeout(() => {
                const err = document.querySelector(".alert.alert-danger, .invalid-feedback.d-block");
                err?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 0);
        });
    });
})();
