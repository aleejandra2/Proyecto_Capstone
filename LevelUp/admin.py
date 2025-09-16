from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
    Usuario, Administrador, Docente, Estudiante,
    Ranking, Recurso, Recompensa, Actividad, AsignacionActividad, ReporteProgreso
)

# Register your models here.
@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ('Datos LevelUp', {'fields': ('rut', 'rol')}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Datos LevelUp', {'fields': ('rut', 'rol', 'email')}),
    )
    list_display = ('username', 'email', 'rut', 'rol', 'is_staff', 'is_active')
    list_filter = ('rol', 'is_staff', 'is_active')
    search_fields = ('username', 'email', 'rut', 'first_name', 'last_name')

@admin.register(Actividad)
class ActividadAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'tipo', 'dificultad', 'recurso', 'recompensa')
    list_filter = ('tipo', 'dificultad')
    search_fields = ('titulo', 'descripcion')

@admin.register(AsignacionActividad)
class AsignacionActividadAdmin(admin.ModelAdmin):
    list_display = ('estudiante', 'actividad', 'estado', 'nota', 'fecha_asignacion', 'fecha_completada')
    list_filter = ('estado', 'fecha_asignacion', 'fecha_completada')
    search_fields = ('estudiante__usuario__username', 'actividad__titulo')

admin.site.register([Administrador, Docente, Estudiante, Ranking, Recurso, Recompensa, ReporteProgreso])