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

/* === Modal "Asignar" (abrir 1 sola vez y validar selección) ================= */
(function () {
    document.addEventListener('DOMContentLoaded', function () {
        var modalEl = document.getElementById('asignarModal');
        if (!modalEl) return;

        // Abrir si viene ?open=asignar o ?abrir_asignar=1
        var params = new URLSearchParams(window.location.search);
        var shouldOpen = params.get('open') === 'asignar' || params.get('abrir_asignar') === '1';

        if (shouldOpen && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            var modal = bootstrap.Modal.getOrCreateInstance(modalEl);
            modal.show();

            // Limpiar la URL para evitar que se siga abriendo en recargas
            try {
                params.delete('open');
                params.delete('abrir_asignar');
                var clean = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
                window.history.replaceState({}, document.title, clean);
            } catch (e) { }
        }

        // ---- Texto dinámico "curso y/o alumno" + deshabilitar submit si nada seleccionado
        var form = document.getElementById('form-asignar');
        if (!form) return;

        var selCursos = form.querySelector('select[name="cursos"]');
        var selAlumnos = form.querySelector('select[name="alumnos"]');
        var help = document.getElementById('asignar-help');
        var btnSubmit = form.querySelector('button[type="submit"]');

        function countSelected(sel) {
            return sel && sel.selectedOptions ? sel.selectedOptions.length : 0;
        }
        function updateHelp() {
            var c = countSelected(selCursos);
            var a = countSelected(selAlumnos);
            var ok = (c + a) > 0;

            if (btnSubmit) btnSubmit.disabled = !ok;

            if (!ok) {
                help.textContent = 'Selecciona al menos un curso o un alumno.';
                help.classList.remove('text-success', 'text-danger');
                help.classList.add('text-muted');
            } else {
                var parts = [];
                if (c) parts.push(c + ' curso' + (c > 1 ? 's' : ''));
                if (a) parts.push(a + ' alumno' + (a > 1 ? 's' : ''));
                help.textContent = 'Asignar a ' + parts.join(' y ') + '.';
                help.classList.remove('text-muted', 'text-danger');
                help.classList.add('text-success');
            }
        }

        selCursos && selCursos.addEventListener('change', updateHelp);
        selAlumnos && selAlumnos.addEventListener('change', updateHelp);
        updateHelp();

        form.addEventListener('submit', function (e) {
            var c = countSelected(selCursos);
            var a = countSelected(selAlumnos);
            if ((c + a) === 0) {
                e.preventDefault();
                help.classList.remove('text-muted', 'text-success');
                help.classList.add('text-danger');
                help.textContent = 'Selecciona al menos un curso o un alumno.';
                setTimeout(updateHelp, 1200);
            }
        });
    });
})();