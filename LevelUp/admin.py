# LevelUp/admin.py
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

# Importa SOLO lo que ya existe con certeza
from .models import (
    Administrador, Docente, Estudiante,
    Ranking, Recurso, Recompensa,
    Actividad, AsignacionActividad, ReporteProgreso,
    ItemActividad, Submission, Answer,
    Asignatura, Curso, PerfilAlumno, Matricula,
    AsignacionDocente
)

Usuario = get_user_model()

@admin.register(Usuario)
class UsuarioAdmin(BaseUserAdmin):
    list_display  = ("username", "email", "rut", "rol", "is_staff", "is_active")
    list_filter   = ("rol", "is_staff", "is_active")
    search_fields = ("username", "email", "rut", "first_name", "last_name")

    fieldsets = BaseUserAdmin.fieldsets + (
        ("Datos LevelUp", {"fields": ("rut", "rol")}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("Datos LevelUp", {"fields": ("rut", "rol", "email")}),
    )

# ---------- Actividades ----------
class ItemActividadInline(admin.StackedInline):
    model = ItemActividad
    extra = 0
    fields = ("orden", "tipo", "enunciado", "puntaje", "imagen", "datos")
    ordering = ("orden",)

@admin.register(Actividad)
class ActividadAdmin(admin.ModelAdmin):
    list_display  = ("titulo", "tipo", "dificultad", "docente", "xp_total", "es_publicada", "fecha_publicacion")
    list_filter   = ("tipo", "dificultad", "es_publicada")
    search_fields = ("titulo", "descripcion", "docente__usuario__username", "docente__usuario__first_name", "docente__usuario__last_name")
    date_hierarchy = "fecha_publicacion"
    inlines = [ItemActividadInline]
    readonly_fields = ("fecha_publicacion",)

@admin.register(AsignacionActividad)
class AsignacionActividadAdmin(admin.ModelAdmin):
    list_display  = ("estudiante", "actividad", "estado", "nota", "fecha_asignacion", "fecha_completada")
    list_filter   = ("estado", "fecha_asignacion", "fecha_completada")
    search_fields = ("estudiante__usuario__username", "actividad__titulo")

@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display  = ("actividad", "estudiante", "finalizado", "calificacion", "xp_obtenido", "enviado_en")
    list_filter   = ("finalizado",)
    search_fields = ("actividad__titulo", "estudiante__usuario__username")
    date_hierarchy = "enviado_en"

@admin.register(Answer)
class AnswerAdmin(admin.ModelAdmin):
    list_display  = ("submission", "item", "es_correcta", "puntaje_obtenido")
    list_filter   = ("es_correcta",)
    search_fields = ("submission__actividad__titulo", "submission__estudiante__usuario__username", "item__enunciado")

# Otros catálogos
admin.site.register([Administrador, Docente, Estudiante, Ranking, Recurso, Recompensa, ReporteProgreso])

# ---------- Asignaturas y Clases ----------
@admin.register(Asignatura)
class AsignaturaAdmin(admin.ModelAdmin):
    list_display = ("nombre", "codigo")
    search_fields = ("nombre", "codigo")

@admin.register(Curso)
class CursoAdmin(admin.ModelAdmin):
    list_display = ("nivel", "letra")
    list_filter = ("nivel",)

@admin.register(PerfilAlumno)
class PerfilAlumnoAdmin(admin.ModelAdmin):
    list_display = ("usuario", "promedio", "dificultad_matematicas", "dificultad_ingles")
    list_filter = ("dificultad_matematicas", "dificultad_ingles")

@admin.register(Matricula)
class MatriculaAdmin(admin.ModelAdmin):
    list_display = ("estudiante", "curso", "fecha")
    list_filter = ("curso__nivel", "curso__letra")
    # OJO: si tu relación es estudiante→usuario, usa estudiante__usuario__username (ajústalo a tu modelo real)
    search_fields = ("estudiante__username", "estudiante__first_name", "estudiante__last_name")

@admin.register(AsignacionDocente)
class AsignacionDocenteAdmin(admin.ModelAdmin):
    list_display = ("profesor", "asignatura")
    list_filter = ("asignatura",)
    search_fields = ("profesor__username", "profesor__first_name", "profesor__last_name")

# ---------- Registro condicional (evita romper mientras migras) ----------
try:
    from .models import GrupoRefuerzoNivel, GrupoRefuerzoNivelAlumno

    class GrupoRefuerzoNivelAlumnoInline(admin.TabularInline):
        model = GrupoRefuerzoNivelAlumno
        extra = 0

    @admin.register(GrupoRefuerzoNivel)
    class GrupoRefuerzoNivelAdmin(admin.ModelAdmin):
        list_display = ("nivel", "profesor_matematicas", "profesor_ingles", "capacidad_sugerida")
        list_filter = ("nivel",)
        inlines = [GrupoRefuerzoNivelAlumnoInline]

except Exception:
    # Si los modelos aún no existen (antes de migrar), no rompas el admin.
    pass
