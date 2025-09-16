from django.shortcuts import render, redirect
from django.http import HttpResponse
from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth import get_user_model
from .forms import RegistrationForm, LoginForm
from .models import Estudiante, Actividad, Usuario 

# Create your views here.
def home(request):
    return render(request, 'LevelUp/index.html')


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


@login_required
def home_view(request):
    """
    Enruta a un template distinto según el rol del usuario.
    Carga datos básicos para cada dashboard.
    """
    rol = getattr(request.user, "rol", "")

    if rol == Usuario.Rol.ESTUDIANTE:
        # Datos del estudiante
        ctx = {}
        try:
            est = Estudiante.objects.get(usuario=request.user)
            ctx.update({
                "nivel": est.nivel,
                "puntos": est.puntos,
                "medallas": est.medallas,
                "curso": est.curso,
            })
        except Estudiante.DoesNotExist:
            ctx.update({"nivel": 1, "puntos": 0, "medallas": 0, "curso": "Sin curso"})
        ctx["actividades_count"] = Actividad.objects.count()
        return render(request, "LevelUp/home_student.html", ctx)

    elif rol == Usuario.Rol.DOCENTE:
        # Datos globales simples para docente (ajusta a tus necesidades)
        ctx = {
            "total_estudiantes": Estudiante.objects.count(),
            "total_actividades": Actividad.objects.count(),
            "promedio_general": "—",  # si luego guardas notas, puedes calcularlo
            "dias_activos": 7,        # placeholder
        }
        return render(request, "LevelUp/home_teacher.html", ctx)

    elif rol == Usuario.Rol.ADMINISTRADOR:
        # Resumen para admin
        ctx = {
            "usuarios_total": User.objects.count(),
            "profesores_total": User.objects.filter(rol=Usuario.Rol.DOCENTE).count(),
            "estudiantes_total": User.objects.filter(rol=Usuario.Rol.ESTUDIANTE).count(),
            "actividades_total": Actividad.objects.count(),
        }
        return render(request, "LevelUp/home_admin.html", ctx)

    # Fallback genérico si no tiene rol
    return render(request, "LevelUp/dashboard.html", {})
