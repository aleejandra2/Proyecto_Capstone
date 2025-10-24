/* Oculta el RAW y garantiza que el constructor esté visible */
(function () {
  function apply() {
    document.querySelectorAll('[data-group="game"]').forEach(n => { n.style.display = ""; });
    // Ocultar cualquier bloque legacy que mencione JSON
    document.querySelectorAll(".alert, .gb-legacy, .gb-json-hint").forEach(n => {
      if ((n.textContent || "").toLowerCase().includes("json") ||
        (n.textContent || "").toLowerCase().includes("cuadro de abajo")) {
        n.remove();
      }
    });
    // Ocultar el RAW con contundencia
    document.querySelectorAll(".gb-raw").forEach(raw => {
      raw.classList.add("d-none");
      raw.style.display = "none";
      const ta = raw.querySelector("textarea, input");
      if (ta) {
        ta.setAttribute("aria-hidden", "true");
        ta.setAttribute("tabindex", "-1");
        ta.style.display = "none";
      }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
  else apply();

  const container = document.getElementById("items-container");
  if (container && "MutationObserver" in window) {
    const mo = new MutationObserver(apply);
    mo.observe(container, { childList: true, subtree: true });
  }
})();
