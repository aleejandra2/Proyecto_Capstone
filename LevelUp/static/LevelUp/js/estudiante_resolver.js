// Interacciones del resolutor del estudiante:
// - Drag&Drop para SORT -> serializa a hidden "item_<id>_orden"
// - MATCH -> serializa a hidden JSON "item_<id>_pares" [{left,right}, ...]
// Se ejecuta al enviar el formulario.

(function () {
    // DnD SORT
    document.querySelectorAll(".dnd-sort").forEach((ul) => {
        ul.addEventListener("dragstart", (e) => {
            const li = e.target.closest('li[draggable="true"]');
            if (!li) return;
            e.dataTransfer.setData("text/plain", li.dataset.id);
            e.dropEffect = "move";
        });
        ul.addEventListener("dragover", (e) => { e.preventDefault(); });
        ul.addEventListener("drop", (e) => {
            e.preventDefault();
            const targetLi = e.target.closest('li[draggable="true"]');
            if (!targetLi) return;
            const id = e.dataTransfer.getData("text/plain");
            const dragging = ul.querySelector(`li[draggable="true"][data-id="${id}"]`);
            if (!dragging || dragging === targetLi) return;
            // Inserta después del elemento sobre el que se suelta
            targetLi.after(dragging);
        });
    });

    // Serializadores
    function collectSortOrders() {
        document.querySelectorAll(".dnd-sort").forEach((ul) => {
            const itemId = ul.id.replace("sort_list_", "");
            const ids = Array.from(ul.children).map((li) => li.dataset.id);
            const hidden = document.getElementById("sort_hidden_" + itemId);
            if (hidden) hidden.value = ids.join(",");
        });
    }

    function collectMatchPairs() {
        document.querySelectorAll('[data-item-type="match"]').forEach((box) => {
            const itemId = box.dataset.itemId;
            const selects = box.querySelectorAll(".match-select");
            const pairs = [];
            selects.forEach((sel) => {
                if (sel.value) pairs.push({ left: sel.dataset.left, right: sel.value });
            });
            const hidden = document.getElementById("match_hidden_" + itemId);
            if (hidden) hidden.value = JSON.stringify(pairs);
        });
    }

    const form = document.getElementById("resolver-form");
    if (form) {
        form.addEventListener("submit", () => {
            collectSortOrders();
            collectMatchPairs();
        });
    }
})();
