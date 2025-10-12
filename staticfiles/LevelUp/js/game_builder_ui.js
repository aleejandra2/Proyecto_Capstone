(function () {
  function toggle(scope) {
    const tipoSel = scope.querySelector('[name$="-tipo"]') || scope.querySelector('[name$="tipo"]');
    if (!tipoSel) return;
    const tipo = (tipoSel.value || "").toLowerCase();
    scope.querySelectorAll('[data-group="game"]').forEach(n => n.style.display = (tipo === "game" ? "" : "none"));
    scope.querySelectorAll('[data-group="interactive"]').forEach(n => n.style.display = (tipo === "interactive" ? "" : "none"));
  }
  function init() { document.querySelectorAll(".item-form").forEach(toggle); }
  document.addEventListener("change", (e)=>{
    if (e.target.matches('select[name$="-tipo"], select[name$="tipo"]')) {
      toggle(e.target.closest(".item-form") || document);
    }
  });
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", init); } else { init(); }
  document.addEventListener("formset:item-added", e=>{ if (e.detail?.node) toggle(e.detail.node); });
})();