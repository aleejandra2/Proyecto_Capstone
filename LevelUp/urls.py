from django.urls import path, reverse_lazy
from django.contrib.auth import views as auth_views
from . import views
from .forms import PasswordResetFormVisible

from django.contrib import admin
from django.urls import include

urlpatterns = [
    # Home pública
    path("", views.home, name="home"),

    # Auth
    path("ingresar/", views.login_view, name="login"),
    path("registro/", views.register_view, name="register"),
    path("salir/", views.logout_view, name="logout"),

    # Portal por rol
    path("inicio/", views.home_view, name="dashboard"),

    # Catálogo / Ranking / Reportes
    path("actividades/", views.actividades_view, name="actividades"),
    path("gamificacion/ranking/", views.ranking_view, name="ranking"),
    path("reportes/docente/", views.reportes_docente_view, name="reportes_docente"),

    # PERFIL
    path("perfil/", views.perfil_view, name="perfil"),
    path("perfil/editar/", views.perfil_editar_view, name="perfil_editar"),
    path("perfil/cambiar-password/", views.cambiar_password_view, name="cambiar_password"),

    # DOCENTE — lista / crear / editar / asignar / eliminar
    path("actividades/docente/", views.actividades_docente_lista, name="docente_lista"),
    path("actividades/docente/nueva/", views.actividad_crear, name="actividad_crear"),
    path("actividades/docente/crear/", views.actividad_crear, name="crear"),  # alias opcional (ruta distinta)
    path("actividades/docente/<int:pk>/editar/", views.actividad_editar, name="actividad_editar"),
    path("actividades/<int:pk>/eliminar/", views.actividad_eliminar, name="actividad_eliminar"),
    
    # AJAX: Eliminar ítem
    path('actividades/item/<int:item_id>/eliminar/', views.item_eliminar_ajax, name='item_eliminar_ajax'),

    # “Crear misión/videojuego” para el docente
    path("misiones/crear/", views.actividad_crear_mision, name="actividad_crear_mision"),

    # ESTUDIANTE — lista / resultados / jugar
    path("portal/estudiante/asignatura/set/", views.estudiante_set_asignatura, name="estudiante_set_asignatura"),
    path("actividades/estudiante/", views.estudiante_mis_actividades, name="estudiante_lista"),
    path("actividades/estudiante/<int:pk>/resultado/", views.actividad_resultados, name="resolver_resultado"),
    path("actividades/estudiante/<int:pk>/play/", views.actividad_play, name="resolver_play"),

    # APIs de juego
    path("api/actividades/<int:pk>/answer/<int:item_id>/", views.api_item_answer, name="api_item_answer"),
    path("api/actividades/<int:pk>/hint/<int:item_id>/", views.api_item_hint, name="api_item_hint"),

    # Misiones / mapa (para jugar.html + play.js)
    path("misiones/<slug:slug>/<int:nivel>/", views.misiones_jugar, name="misiones_jugar"),
    path("misiones/mapa/<int:actividad_pk>/", views.misiones_mapa, name="misiones_mapa_actividad"),

    # Panel Admin (admin-app)
    # --- Cursos ---
    path("panel/admin/cursos/", views.adm_cursos_lista, name="adm_cursos_lista"),
    path("panel/admin/cursos/nuevo/", views.adm_cursos_nuevo, name="adm_cursos_nuevo"),
    path("panel/admin/cursos/<int:pk>/editar/",views.adm_cursos_editar,  name="adm_cursos_editar"),
    path("panel/admin/cursos/<int:pk>/borrar/",views.adm_cursos_borrar,  name="adm_cursos_borrar"),

    # --- Asignaturas ---
    path("panel/admin/asignaturas/", views.adm_asignaturas_lista, name="adm_asignaturas_lista"),
    path("panel/admin/asignaturas/nueva/", views.adm_asignaturas_nueva, name="adm_asignaturas_nueva"),
    path("panel/admin/asignaturas/<int:pk>/editar/",views.adm_asignaturas_editar,  name="adm_asignaturas_editar"),
    path("panel/admin/asignaturas/<int:pk>/borrar/",views.adm_asignaturas_borrar,  name="adm_asignaturas_borrar"),

    # --- Asignaciones Docente ---
    path("panel/admin/asignaciones/", views.adm_asignaciones_lista, name="adm_asignaciones_lista"),
    path("panel/admin/asignaciones/nueva/", views.adm_asignaciones_nueva, name="adm_asignaciones_nueva"),
    path("panel/admin/asignaciones/<int:pk>/editar/", views.adm_asignaciones_editar, name="adm_asignaciones_editar"),
    path("panel/admin/asignaciones/<int:pk>/borrar/", views.adm_asignaciones_borrar, name="adm_asignaciones_borrar"),

    # --- Matrículas ---
    path("panel/admin/matriculas/", views.adm_matriculas_lista, name="adm_matriculas_lista"),
    path("panel/admin/matriculas/nueva/", views.adm_matriculas_nueva, name="adm_matriculas_nueva"),
    path("panel/admin/matriculas/<int:pk>/editar/", views.adm_matriculas_editar, name="adm_matriculas_editar"),
    path("panel/admin/matriculas/<int:pk>/borrar/", views.adm_matriculas_borrar, name="adm_matriculas_borrar"),

    # --- Listas de Usuarios ---
    # Docentes
    path("panel/admin/listas/profesores/", views.adm_list_profesores, name="adm_list_profesores"),
    path("panel/admin/listas/profesores/<int:pk>/editar/", views.adm_profesor_editar, name="adm_profesor_editar"),
    path("panel/admin/listas/profesores/<int:pk>/borrar/", views.adm_profesor_borrar, name="adm_profesor_borrar"),

    # Alumnos
    path("panel/admin/listas/alumnos/", views.adm_list_alumnos, name="adm_list_alumnos"),
    path("panel/admin/listas/alumnos/<int:pk>/editar/", views.adm_alumno_editar, name="adm_alumno_editar"),
    path("panel/admin/listas/alumnos/<int:pk>/borrar/", views.adm_alumno_borrar, name="adm_alumno_borrar"),

    # Alumnos por curso
    path("panel/admin/listas/alumnos-por-curso/", views.adm_list_alumnos_por_curso, name="adm_list_alumnos_por_curso"),

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
    # Gamificacion
    path("gamificacion/", include("gamificacion.urls")),
    path("gamificacion/recompensas/", views.recompensas_view, name="recompensas"),
    path("gamificacion/rangos/", views.rangos_view, name="gamificacion_rangos"),

]
