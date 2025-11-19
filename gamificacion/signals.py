from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import PerfilGamificacion

User = get_user_model()


@receiver(post_save, sender=User)
def crear_perfil_gamificacion(sender, instance, created, **kwargs):
    if not created:
        return

    # Si tu modelo de usuario tiene campo "rol" y solo quieres estudiantes:
    # if getattr(instance, "rol", None) != "ESTUDIANTE":
    #     return

    PerfilGamificacion.objects.get_or_create(usuario=instance)
