document.addEventListener('DOMContentLoaded', function () {
    const container = document.getElementById('items-container');
    const addBtn = document.getElementById('btn-add-item');
    const mgmtTotal = document.querySelector('[name$="-TOTAL_FORMS"]');
    const tmpl = document.getElementById('empty-form-template');

    if (!container || !mgmtTotal || !tmpl) return;

    function replacePrefixInNode(root, idx) {
        // Reemplaza __prefix__ en atributos críticos (incluye label[for])
        const ATTRS = ['name', 'id', 'for', 'aria-describedby', 'aria-labelledby', 'data-bs-target'];
        const all = root.querySelectorAll('*');
        all.forEach(el => {
            ATTRS.forEach(attr => {
                if (el.hasAttribute && el.hasAttribute(attr)) {
                    const val = el.getAttribute(attr);
                    if (val && val.includes('__prefix__')) {
                        el.setAttribute(attr, val.replace(/__prefix__/g, idx));
                    }
                }
            });
        });
    }

    function toggleBlocksByType(card) {
        const tipoSel = card.querySelector('select[name$="-tipo"]');
        const mcq = card.querySelector('.item-mcq-block');
        const tf = card.querySelector('.item-tf-block');

        const show = (el, on) => el && el.classList.toggle('d-none', !on);

        function apply() {
            const v = (tipoSel?.value || '').toLowerCase();
            // Ajusta estos valores a tus choices reales
            const isMcq = ['mcq', 'opcion_multiple', 'opción múltiple'].includes(v);
            const isTf = ['true_false', 'true-false', 'vf', 'verdadero_falso', 'verdadero/falso'].includes(v);
            show(mcq, isMcq);
            show(tf, isTf);
        }

        tipoSel?.addEventListener('change', apply);
        apply();
    }

    function initItemCard(card) {
        toggleBlocksByType(card);
    }

    function addItem() {
        const idx = parseInt(mgmtTotal.value || '0', 10);
        const clone = tmpl.content.cloneNode(true);

        // Reemplazar __prefix__
        replacePrefixInNode(clone, idx);

        // Insertar
        container.appendChild(clone);

        // Incrementar TOTAL_FORMS
        mgmtTotal.value = idx + 1;

        // Inicializar nuevo card
        const card = container.querySelector('.item-form:last-of-type');
        if (card) initItemCard(card);
    }

    addBtn?.addEventListener('click', addItem);

    // Menú: agregar ítem rápido
    document.querySelectorAll('.add-item-kind').forEach(a => {
        a.addEventListener('click', (e) => {
            e.preventDefault();
            addItem();
            const card = container.querySelector('.item-form:last-of-type');
            const tipoSel = card?.querySelector('select[name$="-tipo"]');
            if (!tipoSel) return;

            const kind = (a.dataset.kind || '').toLowerCase();
            if (kind === 'mcq') tipoSel.value = 'mcq';
            if (kind === 'tf') tipoSel.value = 'true_false';
            if (kind === 'text') tipoSel.value = 'text';
            tipoSel.dispatchEvent(new Event('change', { bubbles: true }));
        });
    });

    // Quitar item (marca DELETE si existe; si no, lo remueve del DOM)
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-remove-item');
        if (!btn) return;

        const card = btn.closest('.item-form');
        if (!card) return;

        const del = card.querySelector('input[type="checkbox"][name$="-DELETE"]');
        if (del) {
            del.checked = true;
            card.style.display = 'none';
        } else {
            // Si no hay DELETE, remover del DOM. (Opcional: reindexar TOTAL_FORMS si lo prefieres.)
            card.remove();
            // Nota: no decrementamos TOTAL_FORMS para evitar desajustes con el formset.
        }
    });

    // Inicializar los ya existentes al cargar
    container.querySelectorAll('.item-form').forEach(initItemCard);
});
