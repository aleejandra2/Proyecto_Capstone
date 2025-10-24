from django.urls import path, reverse_lazy
from django.contrib.auth import views as auth_views
from . import views
from .forms import PasswordResetFormVisible

urlpatterns = [
    # Home pública
    path("", views.home, name="home"),

    # Auth
    path("ingresar/", views.login_view, name="login"),
    path("registro/", views.register_view, name="register"),
    path("salir/", views.logout_view, name="logout"),

    # Portal por rol
    path("inicio/", views.home_view, name="dashboard"),

    # Catálogo/Ranking/Reportes
    path("actividades/", views.actividades_view, name="actividades"),
    path("ranking/", views.ranking_view, name="ranking"),
    path("reportes/docente/", views.reportes_docente_view, name="reportes_docente"),

    # PERFIL
    path("perfil/", views.perfil_view, name="perfil"),
    path("perfil/editar/", views.perfil_editar_view, name="perfil_editar"),
    path("perfil/cambiar-password/", views.cambiar_password_view, name="cambiar_password"),

    # Docente (crear/editar actividades con formset)
    path("actividades/docente/", views.actividades_docente_lista, name="docente_lista"),
    path("actividades/docente/nueva/", views.actividad_crear, name="crear"),
    #path("actividades/docente/<int:pk>/editar/", views.actividad_editar, name="editar"),
    path("actividades/docente/<int:pk>/editar/", views.actividad_editar, name="actividad_editar"),
    path("actividades/docente/<int:pk>/asignar/", views.actividad_asignar, name="actividad_asignar"),
    path("actividades/<int:pk>/eliminar/", views.actividad_eliminar, name="actividad_eliminar"),

    # Estudiante (resolver con autocorrección)
    path("actividades/estudiante/", views.estudiante_mis_actividades, name="estudiante_lista"),
    path("actividades/estudiante/<int:pk>/resultado/", views.actividad_resultados, name="resolver_resultado"),
    path("actividades/estudiante/<int:pk>/play/", views.actividad_play, name="resolver_play"),
    path("api/actividades/<int:pk>/answer/<int:item_id>/", views.api_item_answer, name="api_item_answer"),
    path("api/actividades/<int:pk>/hint/<int:item_id>/", views.api_item_hint, name="api_item_hint"),  # opcional
    path("misiones/<slug:slug>/<int:nivel>/", views.misiones_jugar, name="misiones_jugar"),

    #Juegos (duplicado conservado por compatibilidad)
    path("api/actividades/<int:pk>/answer/<int:item_id>/", views.api_item_answer, name="api_item_answer"),

    # Misiones (mapa -> mundo -> nivel -> jugar -> logros)
    #path("misiones/", views.misiones_mapa, name="misiones_mapa"),
    #path("misiones/mundo/<slug:slug>/", views.misiones_mundo, name="misiones_mundo"),
    #path("misiones/jugar/<slug:slug>/<int:nivel>/", views.misiones_jugar, name="misiones_jugar"),
    #path("misiones/logros/", views.misiones_logros, name="misiones_logros"),

    # Recuperar / Restablecer contraseña
    path(
        "password/recuperar/",
        auth_views.PasswordResetView.as_view(
            template_name="LevelUp/auth/password_reset_form.html",
            email_template_name="LevelUp/auth/password_reset_email.html",
            subject_template_name="LevelUp/auth/password_reset_subject.txt",
            success_url=reverse_lazy("password_reset_done"),
            form_class=PasswordResetFormVisible,
        ),
        name="password_reset",
    ),
    path(
        "password/recuperar/enviado/",
        auth_views.PasswordResetDoneView.as_view(
            template_name="LevelUp/auth/password_reset_done.html"
        ),
        name="password_reset_done",
    ),
    path(
        "password/restablecer/<uidb64>/<token>/",
        auth_views.PasswordResetConfirmView.as_view(
            template_name="LevelUp/auth/password_reset_confirm.html",
            success_url=reverse_lazy("password_reset_complete"),
        ),
        name="password_reset_confirm",
    ),
    path(
        "password/restablecido/",
        auth_views.PasswordResetCompleteView.as_view(
            template_name="LevelUp/auth/password_reset_complete.html"
        ),
        name="password_reset_complete",
    ),
]
