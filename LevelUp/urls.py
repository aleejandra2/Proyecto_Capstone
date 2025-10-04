from django.urls import path
from . import views
from django.urls import reverse_lazy
from django.contrib.auth import views as auth_views
from .views import register_view, login_view, logout_view, home_view

urlpatterns = [
     # Home / Auth
    path("", home_view, name="home"),
    path("ingresar/", login_view, name="login"),
    path("registro/", register_view, name="register"),
    path("salir/", logout_view, name="logout"),

    # Catálogo/Ranking/Reportes
    path("actividades/", views.actividades_view, name="actividades"),
    path("ranking/", views.ranking_view, name="ranking"),
    path("reportes/docente/", views.reportes_docente_view, name="reportes_docente"),

    # PERFIL
    path("perfil/", views.perfil_view, name="perfil"),
    path("perfil/editar/", views.perfil_editar_view, name="perfil_editar"),
    path("perfil/cambiar-password/", views.cambiar_password_view, name="cambiar_password"),

    # Flujo Actividades
    # Docente
    path("actividades/docente/", views.actividades_docente_lista, name="docente_lista"),
    path("actividades/docente/nueva/", views.actividad_crear, name="crear"),
    path("actividades/docente/<int:pk>/editar/", views.actividad_editar, name="editar"),

    # Estudiante
    path("actividades/estudiante/", views.estudiante_mis_actividades, name="estudiante_lista"),
    path("actividades/estudiante/<int:pk>/resolver/", views.actividad_resolver, name="resolver"),

    # Recuperar / Restablecer contraseña
    path(
        "password/recuperar/",
        auth_views.PasswordResetView.as_view(
            template_name="LevelUp/auth/password_reset_form.html",
            email_template_name="LevelUp/auth/password_reset_email.html",
            subject_template_name="LevelUp/auth/password_reset_subject.txt",
            success_url=reverse_lazy("levelup:password_reset_done"),
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
            success_url=reverse_lazy("levelup:password_reset_complete"),
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
