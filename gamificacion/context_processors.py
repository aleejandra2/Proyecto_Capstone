# gamificacion/context_processors.py
from .models import PerfilGamificacion, RecompensaUsuario

def recompensas_nuevas(request):
    """
    Inyecta en el contexto las recompensas recién desbloqueadas
    (notificada=False) del usuario actual.
    """
    if not request.user.is_authenticated:
        return {}

    try:
        perfil = request.user.perfil_gamificacion
    except PerfilGamificacion.DoesNotExist:
        return {}

    qs = (
        RecompensaUsuario.objects
        .filter(perfil=perfil, notificada=False)
        .select_related("recompensa")
    )

    nuevas = list(qs)

    # Las marcamos como notificadas para que no salgan otra vez
    if nuevas:
        qs.update(notificada=True)

    return {
        "recompensas_nuevas": nuevas
    }
