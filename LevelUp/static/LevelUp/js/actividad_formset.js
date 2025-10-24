(function () {
    document.addEventListener("DOMContentLoaded", function () {
        const container = document.getElementById("items-container");
        const addBtn = document.getElementById("btn-add-item");
        const mgmtTotal = document.querySelector('[name$="-TOTAL_FORMS"]');
        const tmpl = document.getElementById("empty-form-template");
        const form = document.getElementById("actividad-form");

        if (!container || !mgmtTotal || !tmpl) return;

        // Reemplaza __prefix__ por el índice real
        function replacePrefixInNode(root, idx) {
            const ATTRS = ["name", "id", "for", "aria-describedby", "aria-labelledby", "data-bs-target"];
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
            while (walker.nextNode()) {
                const el = walker.currentNode;
                ATTRS.forEach((attr) => {
                    if (!el.hasAttribute || !el.hasAttribute(attr)) return;
                    const val = el.getAttribute(attr);
                    if (val && val.indexOf("__prefix__") !== -1) {
                        el.setAttribute(attr, val.replace(/__prefix__/g, idx));
                    }
                });
            }
            (root.querySelectorAll("label") || []).forEach((lab) => {
                if (lab.htmlFor && lab.htmlFor.indexOf("__prefix__") !== -1) {
                    lab.htmlFor = lab.htmlFor.replace(/__prefix__/g, idx);
                }
            });
        }

        function initItemCard(card) {
            if (!card || card.dataset.ready === "1") return;

            // Botón quitar
            const delBtn = card.querySelector(".btn-remove-item");
            const delFlag = card.querySelector('input[type="checkbox"][name$="-DELETE"]');
            if (delBtn) {
                delBtn.addEventListener("click", (e) => {
                    e.preventDefault();
                    if (delFlag) {
                        delFlag.checked = true;
                        card.style.opacity = 0.5;
                        card.style.pointerEvents = "none";
                        card.style.userSelect = "none";
                    } else {
                        card.remove();
                    }
                });
            }

            card.dataset.ready = "1";
        }

        function addItem() {
            const idx = parseInt(mgmtTotal.value || "0", 10);
            const node = tmpl.content.cloneNode(true);
            replacePrefixInNode(node, idx);
            container.appendChild(node);
            mgmtTotal.value = idx + 1;

            const card = container.querySelector(".item-form:last-of-type");
            if (card) {
                initItemCard(card);
                document.dispatchEvent(new CustomEvent("formset:item-added", { detail: { node: card } }));
            }
        }

        addBtn?.addEventListener("click", function (e) {
            e.preventDefault();
            addItem();
        });

        container.querySelectorAll(".item-form").forEach((card) => initItemCard(card));

        // Antes de enviar: forzar serialización del builder a su textarea
        if (form) {
            form.addEventListener("submit", function () {
                container.querySelectorAll(".item-form").forEach(function (card) {
                    if (window.GB && typeof window.GB.syncOne === "function") {
                        window.GB.syncOne(card);
                    } else {
                        const anyInput = card.querySelector(".gbuilder input, .gbuilder textarea, .gbuilder select");
                        if (anyInput) anyInput.dispatchEvent(new Event("input", { bubbles: true }));
                    }
                });
            });
        }
    });
})();
