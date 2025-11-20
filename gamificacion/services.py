from django.contrib.auth import get_user_model
from .models import PerfilGamificacion

User = get_user_model()


def obtener_o_crear_perfil(user):
    """
    Devuelve el PerfilGamificacion del usuario, creándolo si no existe.
    """
    perfil, _ = PerfilGamificacion.objects.get_or_create(usuario=user)
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
        "nivel_actual": resultado_xp["niveles_subidos"] + perfil.nivel,  # o solo perfil.nivel si prefieres
        "niveles_subidos": resultado_xp["niveles_subidos"],
        "actividades_completadas": perfil.actividades_completadas,
    }
