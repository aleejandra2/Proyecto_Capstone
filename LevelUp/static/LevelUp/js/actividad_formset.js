document.addEventListener("DOMContentLoaded", function () {
    const container = document.getElementById("items-container");
    const addBtn = document.getElementById("btn-add-item");
    const mgmtTotal = document.querySelector('[name$="-TOTAL_FORMS"]');
    const tmpl = document.getElementById("empty-form-template");

    if (!container || !mgmtTotal || !tmpl) return;

    // Reemplaza __prefix__ en atributos críticos (incluye label[for])
    function replacePrefixInNode(root, idx) {
        const ATTRS = ["name", "id", "for", "aria-describedby", "aria-labelledby", "data-bs-target"];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
        while (walker.nextNode()) {
            const el = walker.currentNode;
            ATTRS.forEach((attr) => {
                if (el.hasAttribute && el.hasAttribute(attr)) {
                    const val = el.getAttribute(attr);
                    if (val && val.indexOf("__prefix__") !== -1) {
                        el.setAttribute(attr, val.replace(/__prefix__/g, idx));
                    }
                }
            });
        }
    }

    function show(el) { if (el) { el.classList.remove("d-none"); el.style.display = ""; } }
    function hide(el) { if (el) { el.classList.add("d-none"); el.style.display = "none"; } }

    function toggleBlocksByType(card) {
        const tipoSel = card.querySelector('select[name$="-tipo"]');
        const type = (tipoSel?.value || "").toLowerCase();

        // Oculta todo y muestra solo lo correspondiente
        card.querySelectorAll(".item-block").forEach((b) => hide(b));

        const map = {
            mcq: ".item-mcq",
            tf: ".item-tf",
            fib: ".item-fib",
            sort: ".item-sort",
            match: ".item-match",
            text: ".item-text",
            interactive: ".item-ext",
            game: ".item-ext",
        };
        const sel = map[type];
        if (sel) show(card.querySelector(sel));

        // MCQ: alternar single/multi por allow_multiple
        const allow = card.querySelector('input[name$="-allow_multiple"]');
        const single = card.querySelector(".mcq-single");
        const multi = card.querySelector(".mcq-multi");
        if (allow && single && multi) {
            const update = () => {
                if (allow.checked) { hide(single); show(multi); }
                else { show(single); hide(multi); }
            };
            update();
            allow.addEventListener("change", update);
        }
    }

    function initItemCard(card) {
        if (!card || card.dataset.ready === "1") return;
        const tipoSel = card.querySelector('select[name$="-tipo"]');
        if (tipoSel) {
            tipoSel.addEventListener("change", () => toggleBlocksByType(card));
            toggleBlocksByType(card); // aplicar estado inicial
        }

        // Botón "Quitar"
        const delBtn = card.querySelector(".btn-remove-item");
        const delFlag = card.querySelector('input[type="checkbox"][name$="-DELETE"]');
        if (delBtn) {
            delBtn.addEventListener("click", () => {
                if (delFlag) {
                    delFlag.checked = true;
                    card.style.opacity = 0.5;
                    card.style.pointerEvents = "none";
                    card.style.userSelect = "none";
                } else {
                    // Si es un form nuevo (sin DELETE), solo retiramos del DOM.
                    card.remove();
                    // No decrementamos TOTAL_FORMS para evitar desajustes con otros índices.
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
        if (card) initItemCard(card);
    }

    // Botón agregar
    addBtn?.addEventListener("click", (e) => {
        e.preventDefault();
        addItem();
    });

    // Menú: agregar ítem rápido (preselecciona tipo)
    document.querySelectorAll(".add-item-kind").forEach((a) => {
        a.addEventListener("click", (e) => {
            e.preventDefault();
            const kind = (a.dataset.kind || "").toLowerCase();
            addItem();
            const card = container.querySelector(".item-form:last-of-type");
            const tipoSel = card?.querySelector('select[name$="-tipo"]');
            if (!tipoSel) return;
            // Códigos deben coincidir con ItemActividad.ItemType
            const allowed = ["mcq", "tf", "fib", "sort", "match", "text", "interactive", "game"];
            tipoSel.value = allowed.includes(kind) ? kind : "text";
            tipoSel.dispatchEvent(new Event("change", { bubbles: true }));
        });
    });

// mini-script local: cambia el hidden para que la vista sepa a dónde redirigir
  document.addEventListener('DOMContentLoaded', function () {
    const next = document.getElementById('next_action');
    const btnAssign = document.getElementById('btn-save-assign');
    btnAssign?.addEventListener('click', function () {
      if (next) next.value = 'assign';
      // dispara el submit del form
      document.getElementById('actividad-form')?.submit();
    });
  });
  
    // Inicializar ya existentes
    container.querySelectorAll(".item-form").forEach(initItemCard);
});

/* === Fallback Game Builder -> textarea al enviar =================================== */
(function () {
    document.addEventListener('DOMContentLoaded', function () {
        var form = document.getElementById('actividad-form');
        if (!form) return;

        form.addEventListener('submit', function () {
            document.querySelectorAll('.item-form').forEach(function (card) {
                var kindSel = card.querySelector('select[name$="-game_kind"]');
                var rawTA = card.querySelector('textarea[name$="-game_pairs"]');
                var gb = card.querySelector('.gbuilder');
                if (!kindSel || !rawTA || !gb) return;
                if (rawTA.value.trim()) return;

                var kind = (kindSel.value || '').toLowerCase();

                function getVals(sel) {
                    return Array.from(gb.querySelectorAll(sel))
                        .map(function (i) { return (i.value || '').trim(); })
                        .filter(Boolean);
                }

                if (kind === 'trivia') {
                    var items = Array.from(gb.querySelectorAll('.gb-trivia-item')).map(function (it) {
                        var q = it.querySelector('.gb-q');
                        q = q ? (q.value || '').trim() : '';
                        var opts = Array.from(it.querySelectorAll('.gb-opt'))
                            .map(function (o) { return (o.value || '').trim(); })
                            .filter(Boolean);
                        var ansIdx = Array.from(it.querySelectorAll('.gb-opt'))
                            .findIndex(function (o) { return o.classList.contains('is-correct') || o.dataset.correct === '1'; });
                        if (!q || opts.length < 2) return null;
                        if (ansIdx < 0) ansIdx = 0;
                        return [q].concat(opts.map(function (t, i) { return i === ansIdx ? (t + '*') : t; })).join(' | ');
                    }).filter(Boolean);
                    if (items.length) rawTA.value = items.join('\n');
                } else {
                    var A = getVals('.gb-a input, .gb-a textarea, [data-col="A"] input, [data-col="A"] textarea');
                    var B = getVals('.gb-b input, .gb-b textarea, [data-col="B"] input, [data-col="B"] textarea');
                    if (A.length && B.length && A.length === B.length) {
                        rawTA.value = A.map(function (v, i) { return v + '|' + B[i]; }).join('\n');
                    }
                }
            });
        });
    });
})();
