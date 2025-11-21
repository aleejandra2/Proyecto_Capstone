from django.contrib.auth import get_user_model
from .models import PerfilGamificacion

from django.db.models import Count, Q

from gamificacion.models import PerfilGamificacion, Recompensa, RecompensaUsuario
from LevelUp.models import Actividad, AsignacionActividad, Estudiante, Submission

User = get_user_model()


def obtener_o_crear_perfil(user):

    perfil, created = PerfilGamificacion.objects.get_or_create(usuario=user)

    if created:
        try:
            recompensa = Recompensa.objects.get(slug="bienvenido-levelup")
            RecompensaUsuario.objects.get_or_create(
                perfil=perfil,
                recompensa=recompensa,
            )
        except Recompensa.DoesNotExist:
            pass

    return perfil


def registrar_actividad_completada(user, xp_ganada: int = 0, origen: str = "actividad", referencia_id=None):
    """
    Se llama cuando un estudiante TERMINA una actividad.

    - Sube el conteo de actividades_completadas (para el rango Timo).
    - Suma la XP (si se entrega xp_ganada) y maneja subidas de nivel.
    """
    perfil = obtener_o_crear_perfil(user)

    # 1) contar actividad para el rango
    perfil.registrar_actividad_completada(incrementar_veces=True)

    # 2) sumar XP para el nivel (si viene)
    resultado_xp = perfil.agregar_xp(xp_ganada, origen=origen, referencia_id=referencia_id)

    return {
        "nivel_actual": resultado_xp["niveles_subidos"] + perfil.nivel, 
        "niveles_subidos": resultado_xp["niveles_subidos"],
        "actividades_completadas": perfil.actividades_completadas,
    }


def _clasificar_asignatura(asignatura):
    """
    Devuelve un código simple según el nombre de la asignatura.
    """
    if not asignatura:
        return None
    nombre = (asignatura.nombre or "").lower()
    if "mate" in nombre:
        return "MAT"
    if "lengua" in nombre or "lenguaje" in nombre:
        return "LEN"
    if "hist" in nombre:
        return "HIS"
    if "cien" in nombre:
        return "CIE"
    return None


def _crear_logro(perfil: PerfilGamificacion, slug: str, lista_nuevos: list):
    """
    Crea RecompensaUsuario si no existía y lo agrega a lista_nuevos.
    """
    try:
        recompensa = Recompensa.objects.get(slug=slug)
    except Recompensa.DoesNotExist:
        return

    obj, created = RecompensaUsuario.objects.get_or_create(
        perfil=perfil,
        recompensa=recompensa,
    )
    if created:
        lista_nuevos.append(obj)


def evaluar_logros_por_actividad(
    estudiante: Estudiante,
    actividad: Actividad,
    submission: Submission | None = None,
):
    """
    Revisa los 10 logros especiales para este estudiante
    en base a la actividad recién completada.
    Devuelve una lista de RecompensaUsuario recién creadas.
    """
    perfil = obtener_o_crear_perfil(estudiante.usuario)

    # Slugs que ya tiene este perfil
    ya_tiene = set(
        RecompensaUsuario.objects
        .filter(perfil=perfil)
        .values_list("recompensa__slug", flat=True)
    )

    nuevos = []

    # ---------- Por asignatura (primer paso / todas las actividades) ----------
    tipo_asig = _clasificar_asignatura(actividad.asignatura)
    if tipo_asig:
        # Cuántas actividades de ESTA asignatura ha completado este estudiante
        completadas_qs = (
            Submission.objects
            .filter(
                estudiante=estudiante,
                finalizado=True,
                actividad__asignatura=actividad.asignatura,
            )
            .values("actividad")
            .distinct()
        )
        completadas_asig = completadas_qs.count()

        # Total de actividades de esta asignatura ASIGNADAS a este estudiante
        total_asig = (
            Actividad.objects
            .filter(
                asignatura=actividad.asignatura,
                asignacionactividad__estudiante=estudiante,
            )
            .distinct()
            .count()
        )

        # Primer paso por asignatura
        if tipo_asig == "MAT":
            if completadas_asig >= 1 and "primer-paso-matematicas" not in ya_tiene:
                _crear_logro(perfil, "primer-paso-matematicas", nuevos)
            if (
                total_asig > 0
                and completadas_asig == total_asig
                and "maestro-matematicas" not in ya_tiene
            ):
                _crear_logro(perfil, "maestro-matematicas", nuevos)

        elif tipo_asig == "LEN":
            if completadas_asig >= 1 and "primer-cuento-lenguaje" not in ya_tiene:
                _crear_logro(perfil, "primer-cuento-lenguaje", nuevos)
            if (
                total_asig > 0
                and completadas_asig == total_asig
                and "guardian-palabras" not in ya_tiene
            ):
                _crear_logro(perfil, "guardian-palabras", nuevos)

        elif tipo_asig == "HIS":
            if completadas_asig >= 1 and "primer-viaje-historia" not in ya_tiene:
                _crear_logro(perfil, "primer-viaje-historia", nuevos)
            if (
                total_asig > 0
                and completadas_asig == total_asig
                and "cronista-tiempo" not in ya_tiene
            ):
                _crear_logro(perfil, "cronista-tiempo", nuevos)

        elif tipo_asig == "CIE":
            if completadas_asig >= 1 and "primer-experimento-ciencias" not in ya_tiene:
                _crear_logro(perfil, "primer-experimento-ciencias", nuevos)
            if (
                total_asig > 0
                and completadas_asig == total_asig
                and "cientifico-estrella" not in ya_tiene
            ):
                _crear_logro(perfil, "cientifico-estrella", nuevos)

    # ---------- Respuesta perfecta / racha de genio ----------
    # Intento actual (por si no nos lo pasan)
    if submission is None:
        submission = (
            Submission.objects
            .filter(
                estudiante=estudiante,
                actividad=actividad,
                finalizado=True,
            )
            .order_by("-finished_at")
            .first()
        )

    if submission:
        corr = getattr(submission, "correctas", 0) or 0
        inc = getattr(submission, "incorrectas", 0) or 0

        # Respuesta perfecta (100% aciertos en una actividad)
        if corr > 0 and inc == 0 and "respuesta-perfecta" not in ya_tiene:
            _crear_logro(perfil, "respuesta-perfecta", nuevos)

    # Racha de genio: 3 actividades seguidas con 100%
    ultimas = list(
        Submission.objects
        .filter(estudiante=estudiante, finalizado=True)
        .order_by("-finished_at")[:3]
    )
    if len(ultimas) == 3:
        todas_perfectas = True
        for s in ultimas:
            c = getattr(s, "correctas", 0) or 0
            i = getattr(s, "incorrectas", 0) or 0
            if not (c > 0 and i == 0):
                todas_perfectas = False
                break
        if todas_perfectas and "racha-genio" not in ya_tiene:
            _crear_logro(perfil, "racha-genio", nuevos)

    return nuevos
