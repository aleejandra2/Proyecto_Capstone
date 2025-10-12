// static/LevelUp/js/actividad_play.js
(function () {
  const form = document.getElementById("play-form");
  if (!form) return;

  // -------- Utils ----------
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  // Progreso: % de items con “alguna” interacción/respuesta
  function computeProgress() {
    const items = qsa(".play-item");
    let done = 0;
    items.forEach(it => {
      const type = (it.dataset.itemType || "").toLowerCase();
      const id = it.dataset.itemId;
      if (!id) return;

      if (type === "mcq") {
        const checked = qsa(".mcq-option:checked", it).length;
        if (checked > 0) done++;
      } else if (type === "tf") {
        const sel = qs(`input[name="item_${id}"]:checked`, it);
        if (sel) done++;
      } else if (type === "fib" || type === "text" || type === "image") {
        const input = qs(`[name="item_${id}"]`, it);
        if (input && (input.value || "").trim().length > 0) done++;
      } else if (type === "sort") {
        const hidden = qs(`#orden_${id}`);
        if (hidden && (hidden.value || "").length > 0) done++;
      } else if (type === "match") {
        const hidden = qs(`#pares_${id}`);
        try {
          const arr = JSON.parse(hidden?.value || "[]");
          if (Array.isArray(arr) && arr.length > 0) done++;
        } catch (_) { /* noop */ }
      } else if (type === "interactive" || type === "game") {
        const hidden = qs(`#hidden_done_${id}`);
        if (hidden && hidden.value === "true") done++;
      }
    });

    const pct = items.length ? Math.round((done / items.length) * 100) : 0;
    const bar = qs("#play-progress");
    if (bar) {
      bar.style.width = pct + "%";
      bar.setAttribute("aria-valuenow", String(pct));
    }
  }

  // ---------- Sort (drag & drop nativo) ----------
  function setupSort(it) {
    const list = qs(".play-sort-list", it);
    if (!list) return;
    let dragEl = null;

    list.addEventListener("dragstart", (e) => {
      const li = e.target.closest("li");
      if (!li) return;
      dragEl = li;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", li.dataset.id || "");
      // Hint visual
      setTimeout(() => { li.classList.add("opacity-50"); }, 0);
    });

    list.addEventListener("dragend", (e) => {
      const li = e.target.closest("li");
      if (li) li.classList.remove("opacity-50");
      dragEl = null;
      writeSortHidden(it);
      computeProgress();
    });

    list.addEventListener("dragover", (e) => {
      e.preventDefault();
      const li = e.target.closest("li");
      if (!li || !dragEl || li === dragEl) return;
      const rect = li.getBoundingClientRect();
      const isAfter = (e.clientY - rect.top) / rect.height > 0.5;
      if (isAfter) {
        li.after(dragEl);
      } else {
        li.before(dragEl);
      }
    });

    function writeSortHidden(block) {
      const ul = qs(".play-sort-list", block);
      const ids = qsa("li", ul).map(li => li.dataset.id);
      const inputId = ul?.dataset.inputId;
      const hidden = inputId ? qs("#" + inputId) : null;
      if (hidden) hidden.value = ids.join(",");
    }

    // inicial
    setTimeout(() => {
      // si la lista ya tiene un orden inicial, escríbelo
      const ids = qsa("li", list).map(li => li.dataset.id);
      const hidden = qs("#" + list.dataset.inputId);
      if (hidden) hidden.value = (ids || []).join(",");
      computeProgress();
    }, 0);
  }

  // ---------- Match (simple “selecciona par”) ----------
  function setupMatch(it) {
    const leftCol = qs(".play-match-left", it);
    const rightCol = qs(".play-match-right", it);
    const hidden = qs(`#pares_${it.dataset.itemId}`);
    if (!leftCol || !rightCol || !hidden) return;

    // lógica simple: click en izquierda y luego derecha crea par
    let pendingLeft = null;

    leftCol.addEventListener("click", (e) => {
      const node = e.target.closest(".play-match-left-item");
      if (!node) return;
      pendingLeft = node.dataset.id;
      qsa(".play-match-left-item", leftCol).forEach(n => n.classList.remove("border-primary"));
      node.classList.add("border-primary");
    });

    rightCol.addEventListener("click", (e) => {
      const node = e.target.closest(".play-match-right-item");
      if (!node || !pendingLeft) return;
      const r = node.dataset.id;

      let arr = [];
      try { arr = JSON.parse(hidden.value || "[]"); } catch (_) { arr = []; }
      // Evitar duplicados exactos
      if (!arr.some(p => p.left === pendingLeft && p.right === r)) {
        arr.push({ left: pendingLeft, right: r });
        hidden.value = JSON.stringify(arr);
      }

      // reset selección
      qsa(".play-match-left-item", leftCol).forEach(n => n.classList.remove("border-primary"));
      pendingLeft = null;
      computeProgress();
    });
  }

  // ---------- Interactive/Game checkbox sync ----------
  function setupInteractive(it) {
    const id = it.dataset.itemId;
    const chk = qs(`#done_${id}`);
    const hidden = qs(`#hidden_done_${id}`);
    if (!chk || !hidden) return;
    chk.addEventListener("change", () => {
      hidden.value = chk.checked ? "true" : "false";
      computeProgress();
    });
  }

  // ---------- Inicializar por tipo ----------
  qsa(".play-item").forEach(it => {
    const type = (it.dataset.itemType || "").toLowerCase();
    if (type === "sort") setupSort(it);
    if (type === "match") setupMatch(it);
    if (type === "interactive" || type === "game") setupInteractive(it);

    // mcq/tf/text/fib/image: actualizar progreso en change/input
    qsa("input, textarea, select", it).forEach(inp => {
      inp.addEventListener("change", computeProgress);
      inp.addEventListener("input", computeProgress);
    });
  });

  // progreso inicial
  computeProgress();

  // Validación mínima antes de enviar
  form.addEventListener("submit", (e) => {
    // Si quieres evitar envíos vacíos, descomenta:
    // const bar = document.getElementById("play-progress");
    // const val = parseInt(bar?.getAttribute("aria-valuenow") || "0", 10);
    // if (val < 10) {
    //   e.preventDefault();
    //   alert("Avanza un poco más antes de enviar 😅");
    //   return;
    // }
  });
})();
