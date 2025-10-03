from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from django.core.exceptions import ValidationError
from django.utils import timezone

from .models import (
    Usuario, Administrador, Docente, Estudiante,
    Actividad, AsignacionActividad, Submission
)
from .validators import formatear_rut_usuario


# --------------------------------------------------------------------
# Utilidades de gamificación (umbral editable)
# --------------------------------------------------------------------

PUNTOS_POR_NIVEL = 100           # 1 nivel cada 100 puntos
CALIFICACION_MEDALLA = 90.0      # medalla por >= 90


def recalcular_nivel_por_puntos(puntos: int) -> int:
    """
    Nivel mínimo 1; sube 1 nivel cada PUNTOS_POR_NIVEL.
    """
    try:
        return max(1, 1 + (puntos // PUNTOS_POR_NIVEL))
    except Exception:
        return 1


# --------------------------------------------------------------------
# Usuario: normalización de RUT y creación de perfil por rol
# --------------------------------------------------------------------

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


# --------------------------------------------------------------------
# Actividad: auto-set de fecha_publicacion al publicar
# --------------------------------------------------------------------

@receiver(pre_save, sender=Actividad)
def actividad_set_fecha_publicacion(sender, instance: Actividad, **kwargs):
    """
    Si se marca es_publicada=True y no hay fecha_publicacion, setearla ahora.
    """
    if instance.es_publicada and not instance.fecha_publicacion:
        instance.fecha_publicacion = timezone.now()


# --------------------------------------------------------------------
# Submission: al finalizar, otorgar XP/medallas, nivelar y sincronizar asignación
# --------------------------------------------------------------------

@receiver(post_save, sender=Submission)
def submission_post_save(sender, instance: Submission, created, **kwargs):
    """
    Cuando un submission se marca como finalizado:
      - Suma puntos al Estudiante (xp_obtenido).
      - Recalcula nivel.
      - Suma medalla si calificación >= CALIFICACION_MEDALLA.
      - Sincroniza AsignacionActividad (nota/estado/fecha_completada).
    """
    # Solo actuamos cuando ya NO es creación y está finalizado
    if created:
        return

    if not instance.finalizado:
        # Si no está finalizado, marcar EN_PROGRESO en la asignación (si existe)
        try:
            asign = AsignacionActividad.objects.get(
                estudiante=instance.estudiante, actividad=instance.actividad
            )
            if asign.estado != AsignacionActividad.Estado.COMPLETADA:
                if asign.estado != AsignacionActividad.Estado.EN_PROGRESO:
                    asign.estado = AsignacionActividad.Estado.EN_PROGRESO
                    asign.save(update_fields=["estado"])
        except AsignacionActividad.DoesNotExist:
            pass
        return

    # Aquí: finalizado = True -> otorgar recompensas y cerrar asignación
    est = instance.estudiante
    puntos_previos = est.puntos or 0
    medallas_previas = est.medallas or 0
    nivel_prev = est.nivel or 1

    # 1) Sumar puntos por XP obtenido en el submission
    xp = int(instance.xp_obtenido or 0)
    if xp > 0:
        est.puntos = puntos_previos + xp

    # 2) Recalcular nivel por puntos acumulados
    est.nivel = recalcular_nivel_por_puntos(est.puntos)

    # 3) Medalla por buena calificación
    try:
        calif = float(instance.calificacion) if instance.calificacion is not None else None
    except Exception:
        calif = None
    if calif is not None and calif >= CALIFICACION_MEDALLA:
        est.medallas = medallas_previas + 1

    # Persistir cambios del estudiante si hubo modificaciones
    campos_update = []
    if est.puntos != puntos_previos:
        campos_update.append("puntos")
    if est.nivel != nivel_prev:
        campos_update.append("nivel")
    if est.medallas != medallas_previas:
        campos_update.append("medallas")
    if campos_update:
        est.save(update_fields=campos_update)

    # 4) Sincronizar la AsignacionActividad
    try:
        asign = AsignacionActividad.objects.get(
            estudiante=instance.estudiante, actividad=instance.actividad
        )
        cambios = []
        if asign.estado != AsignacionActividad.Estado.COMPLETADA:
            asign.estado = AsignacionActividad.Estado.COMPLETADA
            cambios.append("estado")
        if instance.calificacion is not None and asign.nota != instance.calificacion:
            asign.nota = instance.calificacion
            cambios.append("nota")
        if not asign.fecha_completada:
            asign.fecha_completada = timezone.now().date()
            cambios.append("fecha_completada")
        if cambios:
            asign.save(update_fields=cambios)
    except AsignacionActividad.DoesNotExist:
        # Si no existe la asignación, no forzamos crearla aquí; la UI debería crearla.
        # (Opcional) Podrías crearla automáticamente si ese es el flujo deseado:
        # AsignacionActividad.objects.create(
        #     estudiante=instance.estudiante,
        #     actividad=instance.actividad,
        #     estado=AsignacionActividad.Estado.COMPLETADA,
        #     nota=instance.calificacion,
        #     fecha_asignacion=timezone.now().date(),
        #     fecha_completada=timezone.now().date(),
        # )
        pass
