from django.urls import path
from . import views
from django.urls import reverse_lazy
from django.contrib.auth import views as auth_views
from .views import register_view, login_view, logout_view, home_view

urlpatterns = [
    path('', home_view, name='home'),
    path("ingresar/", login_view, name="login"),
    path("registro/", register_view, name="register"),
    path("salir/", logout_view, name="logout"),
    path("actividades/", views.actividades_view, name="actividades"),
    path("ranking/", views.ranking_view, name="ranking"),
    path("reportes/docente/", views.reportes_docente_view, name="reportes_docente"),

    # Recuperar / Restablecer contraseña
    path(
        "password/recuperar/",
        auth_views.PasswordResetView.as_view(
            template_name="LevelUp/auth/password_reset_form.html",
            email_template_name="LevelUp/auth/password_reset_email.html",
            subject_template_name="LevelUp/auth/password_reset_subject.txt",
            success_url=reverse_lazy("password_reset_done"),
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
