// static/LevelUp/js/actividad_preview.js
(function () {
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function val(el) { return el ? (el.value || "").trim() : ""; }
  function bool(el) { return !!(el && (el.checked || String(el.value).toLowerCase() === "true")); }

  function buildPreviewItem(idx, card) {
    const tipoSel = qs('select[name$="-tipo"]', card);
    const tipo = (val(tipoSel) || "").toLowerCase();
    const enun = val(qs('textarea[name$="-enunciado"]', card)) || "(Sin enunciado)";
    const puntaje = val(qs('input[name$="-puntaje"]', card)) || "0";

    // campos por tipo
    const allowMultiple = qs('input[name$="-allow_multiple"]', card);
    const alt = n => val(qs(`input[name$="-alt_${n}"]`, card));
    const correctaRadios = qsa('input[type="radio"][name$="-correcta"]', card)
      .filter(r => r.checked).map(r => r.value);
    const correctasMulti = qsa('input[type="checkbox"][name$="-correctas_multi"]', card)
      .filter(c => c.checked).map(c => c.value);

    const tfRadio = qsa('input[type="radio"][name$="-tf_respuesta"]', card)
      .find(r => r.checked);
    const fibLines = val(qs('textarea[name$="-fib_respuestas"]', card)).split(/\r?\n/).filter(Boolean);
    const sortLines = val(qs('textarea[name$="-sort_items"]', card)).split(/\r?\n/).filter(Boolean);
    const matchLeft = val(qs('textarea[name$="-match_left"]', card)).split(/\r?\n/).filter(Boolean);
    const matchRight = val(qs('textarea[name$="-match_right"]', card)).split(/\r?\n/).filter(Boolean);
    const textMin = val(qs('input[name$="-text_minlen"]', card));
    const textKw  = val(qs('input[name$="-text_keywords"]', card));
    const extUrl  = val(qs('input[name$="-ext_url"]', card));

    // Render por tipo
    let body = "";

    if (tipo === "mcq") {
      const opciones = [alt(1),alt(2),alt(3),alt(4),alt(5),alt(6)].filter(x => x);
      const multiple = bool(allowMultiple);
      if (multiple) {
        body += opciones.map((op, i) =>
          `<div class="form-check">
             <input class="form-check-input" type="checkbox" disabled>
             <label class="form-check-label">${op}</label>
           </div>`).join("");
        body += `<small class="text-muted d-block mt-1">Múltiples respuestas correctas (simulación).</small>`;
      } else {
        body += opciones.map((op, i) =>
          `<div class="form-check">
             <input class="form-check-input" type="radio" disabled>
             <label class="form-check-label">${op}</label>
           </div>`).join("");
      }
    }
    else if (tipo === "tf") {
      body += `
        <div class="form-check"><input class="form-check-input" type="radio" disabled><label class="form-check-label">Verdadero</label></div>
        <div class="form-check"><input class="form-check-input" type="radio" disabled><label class="form-check-label">Falso</label></div>
      `;
    }
    else if (tipo === "fib") {
      body += `<input type="text" class="form-control" disabled placeholder="Escribe tu respuesta">`;
      if (fibLines.length) {
        body += `<small class="text-muted d-block mt-1">Aceptadas (referencia): ${fibLines.join(", ")}</small>`;
      }
    }
    else if (tipo === "sort") {
      body += `<ul class="list-group">` +
        sortLines.map(txt =>
          `<li class="list-group-item d-flex align-items-center gap-2">
             <span class="badge text-bg-secondary">≡</span> ${txt}
           </li>`).join("") + `</ul>
           <small class="text-muted d-block mt-1">Arrastre (simulado en vista previa).</small>`;
    }
    else if (tipo === "match") {
      body += `
        <div class="row g-3">
          <div class="col-md-6">
            <div class="list-group">` +
            matchLeft.map(t => `<button type="button" class="list-group-item" disabled>${t}</button>`).join("") +
            `</div>
          </div>
          <div class="col-md-6">
            <div class="list-group">` +
            matchRight.map(t => `<button type="button" class="list-group-item" disabled>${t}</button>`).join("") +
            `</div>
          </div>
        </div>
        <small class="text-muted d-block mt-1">Emparejar (simulado en vista previa).</small>`;
    }
    else if (tipo === "text") {
      body += `<textarea class="form-control" rows="3" disabled placeholder="Escribe tu respuesta…"></textarea>`;
      if (textMin || textKw) {
        body += `<small class="text-muted d-block mt-1">Pistas: mínimo ${textMin || 0} · claves: ${textKw || "—"}</small>`;
      }
    }
    else if (tipo === "interactive" || tipo === "game") {
      if (extUrl) {
        body += `
          <div class="ratio ratio-16x9 mb-2">
            <iframe src="${extUrl}" title="Recurso" allowfullscreen></iframe>
          </div>
          <div class="form-check"><input class="form-check-input" type="checkbox" checked disabled>
            <label class="form-check-label">Marcar como completado</label></div>`;
      } else {
        body += `<div class="alert alert-warning">Sin URL configurada.</div>`;
      }
    } else if (tipo === "image") {
      body += `<input type="text" class="form-control" disabled placeholder="Describe la imagen o responde">`;
    } else {
      body += `<div class="alert alert-secondary">Tipo de ítem no soportado: ${tipo || "—"}</div>`;
    }

    return `
      <div class="mb-4">
        <h2 class="h6">${idx}. ${enun}</h2>
        ${body}
        <div class="small text-muted mt-1">Puntaje: ${puntaje}</div>
      </div>
    `;
  }

  function buildPreviewHTML() {
    const titulo = val(qs("#id_titulo")) || "(Sin título)";
    const descripcion = val(qs("#id_descripcion")) || "";
    const items = qsa(".item-form");
    const parts = [];

    parts.push(`
      <h1 class="h4 mb-1">${titulo}</h1>
      <p class="text-muted">${descripcion}</p>
      <div class="card p-3">
    `);

    items.forEach((card, i) => {
      parts.push(buildPreviewItem(i + 1, card));
    });

    if (!items.length) {
      parts.push(`<div class="alert alert-info m-0">Esta actividad aún no tiene ítems.</div>`);
    }

    parts.push(`
      <div class="d-flex gap-2">
        <button class="btn btn-success" disabled>Enviar actividad</button>
        <button class="btn btn-outline-secondary" disabled>Volver</button>
      </div>
      </div>
    `);

    return parts.join("");
  }

  document.addEventListener("DOMContentLoaded", function () {
    const btn = qs("#btn-preview");
    const container = qs("#preview-actividad");
    if (!btn || !container) return;

    btn.addEventListener("click", function () {
      container.innerHTML = buildPreviewHTML();
    });
  });
})();
