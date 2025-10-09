from django.shortcuts import render, redirect, get_object_or_404
from django.http import HttpResponse, Http404
from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import PasswordChangeForm
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db import transaction, models

from .forms import RegistrationForm, LoginForm, ProfileForm
# Formularios de actividades
from .forms import ActividadForm, ItemFormSet

# Modelos
from .models import (
    Estudiante, Docente, Actividad, AsignacionActividad,
    ItemActividad, Submission, Answer, Usuario
)

# -------------------------------------------------------------------
# Helpers de rol
# -------------------------------------------------------------------
def es_docente(user) -> bool:
    # En tu proyecto request.user es Usuario (custom) y tiene 'rol'
    return getattr(user, "rol", None) == Usuario.Rol.DOCENTE

def es_estudiante(user) -> bool:
    return getattr(user, "rol", None) == Usuario.Rol.ESTUDIANTE


# -------------------------------------------------------------------
# Home 
# -------------------------------------------------------------------
def home(request):
    return render(request, 'LevelUp/index.html')

@login_required
def actividades_view(request):
    # Lista simple (general) — puedes mantener como catálogo
    actividades = Actividad.objects.all().order_by("-id")[:20]
    return render(request, "LevelUp/actividades/lista.html", {
        "actividades": actividades
    })

@login_required
def ranking_view(request):
    estudiantes_top = Estudiante.objects.order_by("-puntos").select_related("usuario")[:20]
    return render(request, "LevelUp/ranking.html", {
        "estudiantes_top": estudiantes_top
    })

@login_required
def reportes_docente_view(request):
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
            "promedio_general": "—",  # placeholder
            "dias_activos": 7,        # placeholder
        })

    elif rol == Usuario.Rol.ADMINISTRADOR:
        ctx.update({
            "usuarios_total": User.objects.count(),
            "profesores_total": User.objects.filter(rol=Usuario.Rol.DOCENTE).count(),
            "estudiantes_total": User.objects.filter(rol=Usuario.Rol.ESTUDIANTE).count(),
            "actividades_total": Actividad.objects.count(),
        })

    template = template_by_role.get(rol, "LevelUp/portal/estudiante.html")
    return render(request, template, ctx)


# -------------------------------------------------------------------
# PERFIL 
# -------------------------------------------------------------------
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

# ===================================================================
# Flujo de Actividades (Docente y Estudiante)
# ===================================================================

# -----------------------
# Docente
# -----------------------
@login_required
def actividades_docente_lista(request):
    if not es_docente(request.user):
        raise Http404
    try:
        docente = Docente.objects.get(usuario=request.user)
    except Docente.DoesNotExist:
        raise Http404
    qs = Actividad.objects.filter(docente=docente).order_by("-id")
    return render(request, "LevelUp/actividades/docente_lista.html", {"actividades": qs})

@login_required
def actividad_crear(request):
    if not es_docente(request.user):
        raise Http404
    docente = get_object_or_404(Docente, usuario=request.user)

    if request.method == "POST":
        form = ActividadForm(request.POST, request.FILES)
        formset = ItemFormSet(request.POST, request.FILES)
        if form.is_valid() and formset.is_valid():
            with transaction.atomic():
                act = form.save(commit=False)
                act.docente = docente
                if getattr(act, "es_publicada", False) and not getattr(act, "fecha_publicacion", None):
                    act.fecha_publicacion = timezone.now()
                act.save()
                form.save_m2m()
                formset.instance = act
                formset.save()
            messages.success(request, "Actividad creada correctamente.")
            return redirect("docente_lista")
        messages.error(request, "Revisa los errores en el formulario y los ítems.")
    else:
        form = ActividadForm()
        if "docente" in form.fields:
            form.fields["docente"].disabled = True
        formset = ItemFormSet()

    return render(request, "LevelUp/actividades/actividad_form.html", {
        "form": form,
        "formset": formset
    })

@login_required
def actividad_editar(request, pk):
    if not es_docente(request.user):
        raise Http404
    docente = get_object_or_404(Docente, usuario=request.user)
    act = get_object_or_404(Actividad, pk=pk, docente=docente)

    if request.method == "POST":
        form = ActividadForm(request.POST, request.FILES, instance=act)
        formset = ItemFormSet(request.POST, request.FILES, instance=act)
        if form.is_valid() and formset.is_valid():
            with transaction.atomic():
                act = form.save(commit=False)
                act.docente = docente
                if getattr(act, "es_publicada", False) and not getattr(act, "fecha_publicacion", None):
                    act.fecha_publicacion = timezone.now()
                act.save()
                form.save_m2m()
                formset.save()
            messages.success(request, "Actividad actualizada.")
            return redirect("docente_lista")
        messages.error(request, "Revisa los errores en el formulario y los ítems.")
    else:
        form = ActividadForm(instance=act)
        if "docente" in form.fields:
            form.fields["docente"].disabled = True
        formset = ItemFormSet(instance=act)

    return render(request, "LevelUp/actividades/actividad_form.html", {
        "form": form,
        "formset": formset,
        "editar": True
    })


# -----------------------
# Estudiante
# -----------------------
@login_required
def estudiante_mis_actividades(request):
    if not es_estudiante(request.user):
        raise Http404
    estudiante = get_object_or_404(Estudiante, usuario=request.user)

    qs = Actividad.objects.filter(
        es_publicada=True,
        asignacionactividad__estudiante=estudiante
    ).distinct().order_by("-fecha_publicacion", "-id")

    return render(request, "LevelUp/actividades/estudiante_lista.html", {"actividades": qs})

@login_required
def actividad_resolver(request, pk):
    if not es_estudiante(request.user):
        raise Http404

    estudiante = get_object_or_404(Estudiante, usuario=request.user)
    act = get_object_or_404(Actividad, pk=pk, es_publicada=True)

    # Validar asignación a este estudiante
    if not AsignacionActividad.objects.filter(estudiante=estudiante, actividad=act).exists():
        raise Http404

    # Cierre
    if getattr(act, "fecha_cierre", None) and timezone.now() > act.fecha_cierre:
        messages.warning(request, "La actividad está cerrada.")
        return redirect("estudiante_lista")

    sub, _ = Submission.objects.get_or_create(actividad=act, estudiante=estudiante)

    if request.method == "POST":
        total_puntaje = 0
        total_obtenido = 0

        # Recorremos los ítems ligados a la actividad
        for item in act.items.all():
            campo = f"item_{item.pk}"
            valor = request.POST.get(campo)  # radios / text; (para checkboxes usa getlist)

            payload = {}
            es_correcta = False
            obtenido = 0

            tipo = (item.tipo or "").lower()

            if tipo == "mcq":
                # Student template envía 0..5; guardado correcto es 1..6
                if valor is not None and valor != "":
                    try:
                        elegido_idx0 = int(valor)
                        elegido_idx1 = elegido_idx0 + 1
                    except ValueError:
                        elegido_idx1 = None
                else:
                    elegido_idx1 = None

                payload = {"marcada": elegido_idx1}
                correcta = item.datos.get("correcta")  # 1..6
                es_correcta = (elegido_idx1 is not None and correcta == elegido_idx1)
                obtenido = item.puntaje if es_correcta else 0

            elif tipo == "tf":
                v = True if str(valor).lower() in ("true", "1", "on", "si", "sí") else False
                payload = {"valor": v}
                es_correcta = (bool(item.datos.get("respuesta")) is v)
                obtenido = item.puntaje if es_correcta else 0

            elif tipo == "text":
                # Abierta: no se autocorrige, queda para revisión del docente
                txt = (valor or "").strip()
                payload = {"texto": txt}
                es_correcta = False
                obtenido = 0

            elif tipo in ("interactive", "game"):
                # Por cumplimiento: se otorga puntaje completo al completar
                payload = {"completado": True, "valor": valor}
                es_correcta = True
                obtenido = item.puntaje

            else:
                # image u otros tipos: por defecto sin autocorrección
                payload = {"valor": valor}
                es_correcta = False
                obtenido = 0

            ans, _ = Answer.objects.get_or_create(submission=sub, item=item)
            ans.respuesta = payload
            ans.es_correcta = es_correcta
            ans.puntaje_obtenido = obtenido
            ans.save()

            total_puntaje += item.puntaje
            total_obtenido += obtenido

        sub.finalizado = True
        sub.enviado_en = timezone.now()
        sub.calificacion = round((total_obtenido / max(1, total_puntaje)) * 100, 2)
        sub.xp_obtenido = int((total_obtenido / max(1, total_puntaje)) * (act.xp_total or 0))
        sub.save()

        # (Opcional) actualizar progreso/medallas del estudiante aquí

        messages.success(request, "¡Actividad enviada! Tus puntos y progreso han sido actualizados.")
        return redirect("estudiante_lista")

    return render(request, "LevelUp/actividades/estudiante_resolver.html", {
        "actividad": act,
        "submission": sub
    })

# views.py
from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from LevelUp.models import Matricula, GrupoRefuerzoNivelAlumno, GrupoRefuerzoNivel

def _nombre_docente(obj):
    """
    Devuelve un nombre “bonito” tanto si obj es Usuario como si es Docente (con .usuario).
    """
    if not obj:
        return None
    # Caso Docente con OneToOne a Usuario
    usuario = getattr(obj, "usuario", None)
    if usuario:
        return usuario.get_full_name() or usuario.username
    # Caso Usuario directo
    get_full = getattr(obj, "get_full_name", None)
    if callable(get_full):
        return get_full() or getattr(obj, "username", None)
    return str(obj)



@login_required
def portal_estudiante(request):
    u = request.user

    # Curso actual (toma la matrícula más reciente)
    matricula = (Matricula.objects
                 .select_related("curso")
                 .filter(estudiante=u)
                 .order_by("-fecha")
                 .first())

    curso_str = None
    if matricula and matricula.curso:
        c = matricula.curso
        curso_str = f'{c.nivel}° Básico {c.letra}'

    docente_matematicas = None
    docente_ingles = None

    # 1) Si el alumno está en un grupo de refuerzo, usamos ese grupo
    gr_alum = (GrupoRefuerzoNivelAlumno.objects
               .select_related("grupo")
               .filter(alumno=u)
               .first())
    if gr_alum and gr_alum.grupo:
        g = gr_alum.grupo
        # Acepta ambos nombres de campo: profesor_* o docente_*
        dm = getattr(g, "docente_matematicas", None) or getattr(g, "profesor_matematicas", None)
        di = getattr(g, "docente_ingles", None) or getattr(g, "profesor_ingles", None)
        docente_matematicas = _nombre_docente(dm)
        docente_ingles = _nombre_docente(di)

    # 2) Si no hay grupo del alumno, usa el grupo del nivel del curso (si existe)
    if (not docente_matematicas or not docente_ingles) and matricula and matricula.curso:
        g = (GrupoRefuerzoNivel.objects
             .filter(nivel=matricula.curso.nivel)
             .first())
        if g:
            dm = getattr(g, "docente_matematicas", None) or getattr(g, "profesor_matematicas", None)
            di = getattr(g, "docente_ingles", None) or getattr(g, "profesor_ingles", None)
            if not docente_matematicas:
                docente_matematicas = _nombre_docente(dm)
            if not docente_ingles:
                docente_ingles = _nombre_docente(di)

    context = {
        # …tus otras variables…
        "curso": curso_str,
        "docente_matematicas": docente_matematicas,
        "docente_ingles": docente_ingles,
    }
    return render(request, "LevelUp/estudiante_portal.html", context)
