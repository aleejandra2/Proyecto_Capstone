from django.db import transaction
from django.contrib.auth import get_user_model

from .models import PerfilGamificacion

User = get_user_model()


def obtener_o_crear_perfil(usuario):
    perfil, _ = PerfilGamificacion.objects.get_or_create(usuario=usuario)
    return perfil


@transaction.atomic
def otorgar_xp(usuario, cantidad, origen="", referencia_id=None):
    
    if not usuario or not usuario.is_authenticated:
        return None

    perfil = obtener_o_crear_perfil(usuario)
    resultado = perfil.agregar_xp(cantidad, origen=origen, referencia_id=referencia_id)
    return resultado
