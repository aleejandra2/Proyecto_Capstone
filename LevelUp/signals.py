from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from django.core.exceptions import ValidationError
from .models import Usuario, Administrador, Docente, Estudiante
from .validators import formatear_rut_usuario

@receiver(pre_save, sender=Usuario)
def pre_save_formato_rut(sender, instance: Usuario, **kwargs):
    if instance.rut:
        instance.rut = formatear_rut_usuario(instance.rut)

@receiver(post_save, sender=Usuario)
def crear_perfil_por_rol(sender, instance: Usuario, created, **kwargs):
    if not created:
        return
    if instance.rol == Usuario.Rol.ADMINISTRADOR:
        Administrador.objects.get_or_create(usuario=instance)
    elif instance.rol == Usuario.Rol.DOCENTE:
        Docente.objects.get_or_create(usuario=instance)
    elif instance.rol == Usuario.Rol.ESTUDIANTE:
        Estudiante.objects.get_or_create(usuario=instance)
