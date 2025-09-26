from django.shortcuts import render, redirect
from django.http import HttpResponse
from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import PasswordChangeForm
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth import get_user_model
from .forms import RegistrationForm, LoginForm, ProfileForm
from .models import Estudiante, Actividad, Usuario 

# Create your views here.
def home(request):
    return render(request, 'LevelUp/index.html')

@login_required
def actividades_view(request):
    # Placeholder: lista de actividades (ajusta el queryset a tu necesidad)
    actividades = Actividad.objects.all().order_by("-id")[:20]
    return render(request, "LevelUp/actividades/lista.html", {
        "actividades": actividades
    })

@login_required
def ranking_view(request):
    # Placeholder: Top estudiantes por puntos
    estudiantes_top = Estudiante.objects.order_by("-puntos").select_related("usuario")[:20]
    return render(request, "LevelUp/ranking.html", {
        "estudiantes_top": estudiantes_top
    })

@login_required
def reportes_docente_view(request):
    # Placeholder: panel simple de reportes para docente
    total_estudiantes = Estudiante.objects.count()
    total_actividades = Actividad.objects.count()
    return render(request, "LevelUp/reportes_docente.html", {
        "total_estudiantes": total_estudiantes,
        "total_actividades": total_actividades
    })


User = get_user_model()

def register_view(request):
    if request.method == "POST":
        form = RegistrationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            messages.success(request, "¡Cuenta creada con éxito! Bienvenido/a a LevelUp.")
            return redirect("home")
        else:
            messages.error(request, "Por favor corrige los errores del formulario.")
    else:
        form = RegistrationForm()
    return render(request, "LevelUp/auth/register.html", {"form": form})


def login_view(request):
    if request.user.is_authenticated:
        return redirect("home")

    if request.method == "POST":
        form = LoginForm(request.POST)
        if form.is_valid():
            email = form.cleaned_data["email"].lower()
            password = form.cleaned_data["password"]
            remember = form.cleaned_data.get("remember")

            try:
                user_obj = User.objects.get(email=email)
                user = authenticate(request, username=user_obj.username, password=password)
            except User.DoesNotExist:
                user = None

            if user is not None:
                login(request, user)
                # "Recordarme": si NO está marcado, expira al cerrar el navegador
                if not remember:
                    request.session.set_expiry(0)
                messages.success(request, f"¡Hola {user.first_name or user.username}!")
                return redirect("home")
            else:
                messages.error(request, "Credenciales inválidas. Verifica tu email y contraseña.")
    else:
        form = LoginForm()

    return render(request, "LevelUp/auth/login.html", {"form": form})


@login_required
def logout_view(request):
    logout(request)
    messages.info(request, "Sesión cerrada correctamente.")
    return redirect("login")


@login_required(login_url='login')
def home_view(request):
    """
    Enruta a una plantilla distinta según el rol del usuario
    y arma el contexto básico de cada portal.
    """
    rol = getattr(request.user, "rol", None)
    ctx = {}

    template_by_role = {
        Usuario.Rol.ESTUDIANTE:    "LevelUp/portal/estudiante.html",
        Usuario.Rol.DOCENTE:       "LevelUp/portal/docente.html",
        Usuario.Rol.ADMINISTRADOR: "LevelUp/portal/admin.html",
    }

    if rol == Usuario.Rol.ESTUDIANTE:
        try:
            est = Estudiante.objects.select_related("usuario").get(usuario=request.user)
            ctx.update({
                "nivel": est.nivel,
                "puntos": est.puntos,
                "medallas": est.medallas,
                "curso": getattr(est, "curso", "Sin curso"),
            })
        except Estudiante.DoesNotExist:
            ctx.update({"nivel": 1, "puntos": 0, "medallas": 0, "curso": "Sin curso"})
        ctx["actividades_count"] = Actividad.objects.count()

    elif rol == Usuario.Rol.DOCENTE:
        ctx.update({
            "total_estudiantes": Estudiante.objects.count(),
            "total_actividades": Actividad.objects.count(),
            "promedio_general": "—",  # placeholder si luego agregas notas
            "dias_activos": 7,        # placeholder
        })

    elif rol == Usuario.Rol.ADMINISTRADOR:
        User = get_user_model()  # O usa Usuario directamente si prefieres
        ctx.update({
            "usuarios_total": User.objects.count(),
            "profesores_total": User.objects.filter(rol=Usuario.Rol.DOCENTE).count(),
            "estudiantes_total": User.objects.filter(rol=Usuario.Rol.ESTUDIANTE).count(),
            "actividades_total": Actividad.objects.count(),
        })

    # fallback: si no tiene rol, muestra portal estudiante
    template = template_by_role.get(rol, "LevelUp/portal/estudiante.html")
    return render(request, template, ctx)

# --- PERFIL ---
@login_required
def perfil_view(request):
    """Resumen del perfil del usuario."""
    return render(request, "LevelUp/perfil/ver.html", {"user_obj": request.user})

@login_required
def perfil_editar_view(request):
    """Editar datos básicos del perfil (nombre, apellido, email, RUT)."""
    if request.method == "POST":
        form = ProfileForm(request.POST, instance=request.user)
        if form.is_valid():
            form.save()
            messages.success(request, "Perfil actualizado correctamente.")
            return redirect("perfil")
        else:
            messages.error(request, "Revisa los campos del formulario.")
    else:
        form = ProfileForm(instance=request.user)
    return render(request, "LevelUp/perfil/editar.html", {"form": form})

@login_required
def cambiar_password_view(request):
    """Cambiar contraseña (mantiene la sesión activa al cambiarla)."""
    if request.method == "POST":
        form = PasswordChangeForm(user=request.user, data=request.POST)
        if form.is_valid():
            user = form.save()
            update_session_auth_hash(request, user)  # mantener sesión
            messages.success(request, "Tu contraseña fue actualizada.")
            return redirect("perfil")
        else:
            messages.error(request, "Corrige los errores e inténtalo nuevamente.")
    else:
        form = PasswordChangeForm(user=request.user)
    return render(request, "LevelUp/perfil/cambiar_password.html", {"form": form})
