// UI complementaria del formulario de Actividad:
// - Sugerencias dinámicas según "Tipo" de la Actividad (no confundir con tipo de ÍTEM)
(function () {
    const tipoActividad = document.getElementById("id_tipo");
    const ayudaLista = document.getElementById("lista-ayuda-tipo");

    const ayudasPorTipo = {
        quiz: [
            "Añade ítems de <strong>Opción múltiple</strong> (simple o múltiples) y <strong>Verdadero/Falso</strong>.",
            "Define <strong>XP total</strong> y <strong>fecha de cierre</strong> si aplica."
        ],
        video: [
            "Indica la <strong>URL del video</strong> en el recurso o en un ítem Interactivo.",
            "Agrega preguntas de <strong>Texto</strong> para reflexión."
        ],
        juego: [
            "Usa ítems <strong>Interactivo/Juego</strong> con URL embebible.",
            "Puedes complementar con <strong>Opción múltiple</strong> y <strong>Ordenar</strong>."
        ],
        tarea: [
            "Usa ítems de <strong>Texto (abierta)</strong>, <strong>Imagen</strong> o <strong>Completar</strong>.",
            "Establece <strong>fecha de cierre</strong> si necesitas límite."
        ],
    };

    function renderAyudaActividad() {
        if (!tipoActividad || !ayudaLista) return;
        const t = (tipoActividad.value || "").toLowerCase();
        const tips = ayudasPorTipo[t] || ["Selecciona un tipo para ver recomendaciones."];
        ayudaLista.innerHTML = tips.map((x) => `<li>${x}</li>`).join("");
    }

    if (tipoActividad) {
        tipoActividad.addEventListener("change", renderAyudaActividad);
        renderAyudaActividad(); // estado inicial
    }
})();
