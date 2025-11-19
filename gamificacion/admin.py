# Register your models here.
from django.contrib import admin
from .models import PerfilGamificacion, Recompensa, RecompensaUsuario


@admin.register(PerfilGamificacion)
class PerfilGamificacionAdmin(admin.ModelAdmin):
    list_display = ("usuario", "nivel", "xp_actual", "xp_total")
    search_fields = ("usuario__username", "usuario__email")
    list_filter = ("nivel",)


@admin.register(Recompensa)
class RecompensaAdmin(admin.ModelAdmin):
    list_display = ("nombre", "tipo", "nivel_requerido", "xp_requerida")
    prepopulated_fields = {"slug": ("nombre",)}
    list_filter = ("tipo",)


@admin.register(RecompensaUsuario)
class RecompensaUsuarioAdmin(admin.ModelAdmin):
    list_display = ("perfil", "recompensa", "fecha_desbloqueo", "notificada")
    list_filter = ("recompensa__tipo", "notificada")
