from django.contrib.auth.decorators import login_required
from django.shortcuts import render

from .models import Recompensa


@login_required
def recompensas(request):
    perfil = getattr(request.user, "perfil_gamificacion", None)

    # Todas las recompensas existentes
    recompensas = Recompensa.objects.all().order_by(
        "nivel_requerido", "xp_requerida", "nombre"
    )

    # Set de IDs que el usuario SÍ tiene
    recompensas_desbloqueadas_ids = set()
    if perfil:
        recompensas_desbloqueadas_ids = set(
            perfil.recompensas_usuario.values_list("recompensa_id", flat=True)
        )

    contexto = {
        "perfil": perfil,
        "recompensas": recompensas,
        "desbloqueadas_ids": recompensas_desbloqueadas_ids,
    }
    return render(request, "gamificacion/recompensas.html", contexto)
