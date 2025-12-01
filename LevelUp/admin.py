# LevelUp/admin.py
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import (
    Administrador, Docente, Estudiante,
    Ranking, Recurso, Recompensa,
    Actividad, AsignacionActividad, ReporteProgreso,
    ItemActividad, Submission, Answer,
    Asignatura, Curso, PerfilAlumno, Matricula,
    AsignacionDocente
)

Usuario = get_user_model()

# --------- Helper robusto para detectar códigos de rol ---------
def rol_code(nombre: str):
    nombre = (nombre or "").upper().strip()
    try:
        return getattr(Usuario.Rol, nombre)
    except Exception:
        pass
    try:
        for code, label in Usuario._meta.get_field("rol").choices:
            if str(code).upper() == nombre or str(label).upper() == nombre:
                return code
    except Exception:
        pass
    return nombre

ROL_EST = rol_code("ESTUDIANTE")
ROL_DOC = rol_code("DOCENTE")

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

    actions = ["marcar_como_estudiante", "marcar_como_docente"]

    @admin.action(description="Cambiar rol a ESTUDIANTE")
    def marcar_como_estudiante(self, request, queryset):
        updated = queryset.update(rol=ROL_EST)
        self.message_user(request, f"{updated} usuario(s) ahora son ESTUDIANTES.")

    @admin.action(description="Cambiar rol a DOCENTE")
    def marcar_como_docente(self, request, queryset):
        updated = queryset.update(rol=ROL_DOC)
        self.message_user(request, f"{updated} usuario(s) ahora son DOCENTES.")

# ---------- Actividades ----------
class ItemActividadInline(admin.StackedInline):
    model = ItemActividad
    extra = 0
    fields = ("orden", "tipo", "enunciado", "puntaje", "datos")
    ordering = ("orden",)

@admin.register(Actividad)
class ActividadAdmin(admin.ModelAdmin):
    list_display  = ("titulo", "tipo", "dificultad", "docente", "xp_total", "es_publicada", "fecha_publicacion")
    list_filter   = ("tipo", "dificultad", "es_publicada")
    search_fields = ("titulo", "descripcion", "docente__usuario__username", "docente__usuario__first_name", "docente__usuario__last_name")
    date_hierarchy = "fecha_publicacion"
    inlines = [ItemActividadInline]
    readonly_fields = ("fecha_publicacion",)

# ✅ Registrar ItemActividad con search_fields (requisito para AnswerAdmin.autocomplete_fields)
@admin.register(ItemActividad)
class ItemActividadAdmin(admin.ModelAdmin):
    list_display  = ("actividad", "orden", "tipo", "puntaje")
    search_fields = ("enunciado", "actividad__titulo")
    autocomplete_fields = ("actividad",)

@admin.register(AsignacionActividad)
class AsignacionActividadAdmin(admin.ModelAdmin):
    list_display  = ("estudiante", "actividad", "estado", "nota", "fecha_asignacion", "fecha_completada")
    list_filter   = ("estado", "fecha_asignacion", "fecha_completada")
    search_fields = ("estudiante__usuario__username", "actividad__titulo")
    autocomplete_fields = ("estudiante", "actividad")

@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display  = ("actividad", "estudiante", "finalizado", "calificacion", "xp_obtenido", "enviado_en")
    list_filter   = ("finalizado",)
    search_fields = ("actividad__titulo", "estudiante__usuario__username")
    date_hierarchy = "enviado_en"
    autocomplete_fields = ("actividad", "estudiante")

@admin.register(Answer)
class AnswerAdmin(admin.ModelAdmin):
    list_display  = ("submission", "item", "es_correcta", "puntaje_obtenido")
    list_filter   = ("es_correcta",)
    search_fields = ("submission__actividad__titulo", "submission__estudiante__usuario__username", "item__enunciado")
    # ✅ Necesita que ItemActividadAdmin tenga search_fields
    autocomplete_fields = ("submission", "item")

# ---------- Catálogos y misceláneos ----------
admin.site.register([Administrador, Docente, Ranking, Recurso, Recompensa, ReporteProgreso])

@admin.register(Asignatura)
class AsignaturaAdmin(admin.ModelAdmin):
    list_display = ("nombre", "slug", "icono")
    search_fields = ("nombre", "codigo")

# ✅ Estudiante con search_fields (requisito para varios autocompletes)

# --- Filtro seguro por curso (para Estudiante) ---
class CursoMatriculaFilter(admin.SimpleListFilter):
    title = "Curso"
    parameter_name = "curso"  # <- parámetro simple y permitido

    def lookups(self, request, model_admin):
        # Muestra los cursos como aparecen en __str__
        return [(str(c.id), str(c)) for c in Curso.objects.order_by("nivel", "letra")]

    def queryset(self, request, queryset):
        value = self.value()
        if value:
            return queryset.filter(usuario__matriculas__curso_id=value).distinct()
        return queryset

@admin.register(Estudiante)
class EstudianteAdmin(admin.ModelAdmin):
    list_display  = ("usuario", "nivel", "puntos", "medallas")
    list_filter   = ("nivel", CursoMatriculaFilter)  # <- usa el filtro
    search_fields = (
        "usuario__username", "usuario__first_name", "usuario__last_name",
        "usuario__rut", "usuario__email"
    )
    autocomplete_fields = ("usuario",)

    def get_queryset(self, request):
        return super().get_queryset(request).distinct()

class MatriculaInline(admin.TabularInline):
    model = Matricula
    extra = 0
    autocomplete_fields = ("estudiante",)

@admin.register(Curso)
class CursoAdmin(admin.ModelAdmin):
    list_display  = ("nivel", "letra")
    list_filter   = ("nivel", "letra")
    # ✅ Necesario para MatriculaAdmin.autocomplete_fields
    search_fields = ("letra", "nivel")
    inlines      = [MatriculaInline]

@admin.register(PerfilAlumno)
class PerfilAlumnoAdmin(admin.ModelAdmin):
    list_display  = ("usuario", "promedio", "dificultad_matematicas", "dificultad_ingles")
    list_filter   = ("dificultad_matematicas", "dificultad_ingles")
    search_fields = ("usuario__username", "usuario__first_name", "usuario__last_name")

@admin.register(Matricula)
class MatriculaAdmin(admin.ModelAdmin):
    list_display  = ("estudiante", "curso", "fecha")
    list_filter   = ("curso__nivel", "curso__letra", "fecha")
    search_fields = ("estudiante__usuario__username", "estudiante__usuario__first_name", "estudiante__usuario__last_name")
    # ✅ Requiere que CursoAdmin tenga search_fields
    autocomplete_fields = ("estudiante", "curso")

@admin.register(AsignacionDocente)
class AsignacionDocenteAdmin(admin.ModelAdmin):
    list_display  = ("profesor", "asignatura")
    list_filter   = ("asignatura",)
    search_fields = ("profesor__username", "profesor__first_name", "profesor__last_name")
    autocomplete_fields = ("profesor", "asignatura")

# ---------- Grupo de Refuerzo (si el modelo existe) ----------
try:
    from .models import GrupoRefuerzoNivel, GrupoRefuerzoNivelAlumno

    class GrupoRefuerzoNivelAlumnoInline(admin.TabularInline):
        model = GrupoRefuerzoNivelAlumno
        extra = 0
        autocomplete_fields = ("alumno", "asignatura")

    @admin.register(GrupoRefuerzoNivel)
    class GrupoRefuerzoNivelAdmin(admin.ModelAdmin):
        list_filter = ("nivel",)
        inlines     = [GrupoRefuerzoNivelAlumnoInline]
        list_display = (
            "nivel",
            "profesor_matematicas",
            "profesor_ingles",
            "capacidad_sugerida",
        )
        # ✅ Necesario para GrupoRefuerzoNivelAlumnoAdmin.autocomplete_fields(grupo)
        search_fields = (
            "nivel",
            "profesor_matematicas__username",
            "profesor_ingles__username",
        )

    @admin.register(GrupoRefuerzoNivelAlumno)
    class GrupoRefuerzoNivelAlumnoAdmin(admin.ModelAdmin):
        list_display  = ("grupo", "alumno", "asignatura")
        list_filter   = ("grupo__nivel", "asignatura")
        search_fields = ("alumno__username", "alumno__first_name", "alumno__last_name")
        autocomplete_fields = ("grupo", "alumno", "asignatura")

except Exception:
    # Si aún no tienes estos modelos migrados, no rompas el admin.
    pass
