// static/LevelUp/js/estudiante_resolver.js
// Interacciones gamificadas para el alumno: Sort (drag & drop), Match (parejas)
// Genera los inputs ocultos requeridos por views.py: item_{id}_orden y item_{id}_pares

(function () {
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  // ---------------------------
  // SORT: Drag & Drop
  // ---------------------------
  function initSort(list) {
    if (!list) return;
    // atributo data-target -> selector del hidden
    const hiddenSel = list.getAttribute("data-target");
    const hidden = qs(hiddenSel);
    let dragEl = null;

    function updateHidden() {
      const ids = qsa(".sort-draggable", list).map(li => li.getAttribute("data-id")).filter(Boolean);
      if (hidden) hidden.value = ids.join(",");
    }
    updateHidden();

    list.addEventListener("dragstart", (e) => {
      const li = e.target.closest(".sort-draggable");
      if (!li) return;
      dragEl = li;
      e.dataTransfer.effectAllowed = "move";
      li.classList.add("dragging");
    });
    list.addEventListener("dragend", (e) => {
      const li = e.target.closest(".sort-draggable");
      if (li) li.classList.remove("dragging");
      dragEl = null;
      updateHidden();
    });
    list.addEventListener("dragover", (e) => {
      if (!dragEl) return;
      e.preventDefault();
      const after = getDragAfterElement(list, e.clientY);
      if (after == null) {
        list.appendChild(dragEl);
      } else {
        list.insertBefore(dragEl, after);
      }
    });

    function getDragAfterElement(container, y) {
      const els = qsa(".sort-draggable:not(.dragging)", container);
      let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
      els.forEach(child => {
        const box = child.getBoundingClientRect();
        const offset = y - (box.top + box.height / 2);
        if (offset < 0 && offset > closest.offset) {
          closest = { offset, element: child };
        }
      });
      return closest.element;
    }
  }

  // ---------------------------
  // MATCH: click-para-emparejar
  // ---------------------------
  function initMatch(area) {
    if (!area) return;
    const hiddenSel = area.getAttribute("data-target");
    const hidden = qs(hiddenSel);
    const leftCol = qs(".match-left", area);
    const rightCol = qs(".match-right", area);
    const pairsBadge = qs(".match-pairs", area.parentElement) || qs(".match-pairs");

    let pendingLeft = null; // {id, el}
    const pairs = new Map(); // leftId -> rightId

    function renderPairs() {
      const arr = Array.from(pairs.entries());
      if (hidden) {
        hidden.value = JSON.stringify(arr.map(([l, r]) => ({ left: l, right: r })));
      }
      if (pairsBadge) {
        pairsBadge.innerHTML = arr.length
          ? arr.map(([l, r]) => `<span class="badge text-bg-secondary me-1 mb-1">${l} → ${r}</span>`).join("")
          : '<span class="text-muted">Sin parejas aún</span>';
      }
    }
    renderPairs();

    function clearActive() {
      qsa(".list-group-item.active", area).forEach(b => b.classList.remove("active"));
    }

    function onLeftClick(btn) {
      const id = btn.getAttribute("data-id");
      // deseleccionar si estaba marcada
      if (pendingLeft && pendingLeft.id === id) {
        clearActive();
        pendingLeft = null;
        return;
      }
      clearActive();
      btn.classList.add("active");
      pendingLeft = { id, el: btn };
    }

    function onRightClick(btn) {
      const rid = btn.getAttribute("data-id");
      if (!pendingLeft) return; // no hay izquierda seleccionada
      const lid = pendingLeft.id;

      // si ya existía pareja para ese left, la reemplazamos
      pairs.set(lid, rid);
      // marcar visualmente (opcional)
      pendingLeft.el.classList.add("btn-success");
      btn.classList.add("btn-success");

      clearActive();
      pendingLeft = null;
      renderPairs();
    }

    leftCol.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-side='left']");
      if (!btn) return;
      onLeftClick(btn);
    });
    rightCol.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-side='right']");
      if (!btn) return;
      onRightClick(btn);
    });
  }

  // ---------------------------
  // INIT
  // ---------------------------
  document.addEventListener("DOMContentLoaded", function () {
    // Sort
    qsa(".sort-list").forEach(initSort);
    // Match
    qsa(".match-area").forEach(initMatch);
  });
})();
