from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from .models import Usuario, Administrador, Docente, Estudiante
from .validators import formatear_rut

@receiver(pre_save, sender=Usuario)
def normalizar_rut(sender, instance: Usuario, **kwargs):
    """
    Antes de guardar, normaliza el RUT a formato 12.345.678-5 para
    evitar duplicados por formatos distintos y mantener consistencia.
    """
    if instance.rut:
        instance.rut = formatear_rut(instance.rut)

@receiver(post_save, sender=Usuario)
def crear_perfil_por_rol(sender, instance: Usuario, created, **kwargs):
    """
    Cuando se crea un Usuario, genera automáticamente el perfil según su rol.
    """
    if not created:
        return

    if instance.rol == Usuario.Rol.ADMINISTRADOR:
        Administrador.objects.get_or_create(usuario=instance)
    elif instance.rol == Usuario.Rol.DOCENTE:
        Docente.objects.get_or_create(usuario=instance)
    elif instance.rol == Usuario.Rol.ESTUDIANTE:
        Estudiante.objects.get_or_create(usuario=instance)
