from django.shortcuts import render, redirect, get_object_or_404
from django.http import HttpResponse, Http404, HttpResponseForbidden, JsonResponse, HttpResponseBadRequest
from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import PasswordChangeForm
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from django.db import transaction, models
import json
from django.db.models import Count, Q
from .forms import RegistrationForm, LoginForm, ProfileForm
from .forms import ActividadForm, ItemFormSet
from django.views.decorators.http import require_POST
from django import forms
from .rewards import compute_rewards, apply_rewards
from django.templatetags.static import static
from django.contrib.staticfiles import finders

# Formularios de actividades


# Modelos
from .models import (
    Asignatura, Estudiante, Docente, Actividad, AsignacionActividad,
    ItemActividad, Submission, Answer, Usuario,
    Matricula, GrupoRefuerzoNivelAlumno, GrupoRefuerzoNivel, NIVELES, Curso
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
# Home pública (sin login)
# -------------------------------------------------------------------
def home(request):
    # Renderiza una homepage simple (puedes poner tu landing aquÃ­)
    return render(request, "LevelUp/home.html")


# -------------------------------------------------------------------
# Catalogo / Ranking / Reportes (con login)
# -------------------------------------------------------------------
@login_required
def actividades_view(request):
    actividades = Actividad.objects.all().order_by("-id")[:20]
    return render(request, "LevelUp/actividades/lista.html", {"actividades": actividades})

@login_required
def ranking_view(request):
    estudiantes_top = Estudiante.objects.order_by("-puntos").select_related("usuario")[:20]
    return render(request, "LevelUp/ranking.html", {"estudiantes_top": estudiantes_top})

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
            messages.success(request, "¡Cuenta creada con Ã©xito! Bienvenido/a a LevelUp.")
            # â¬‡â¬‡ redirige al portal por rol
            return redirect("dashboard")
        else:
            messages.error(request, "Por favor corrige los errores del formulario.")
    else:
        form = RegistrationForm()
    return render(request, "LevelUp/auth/register.html", {"form": form})


def login_view(request):
    if request.user.is_authenticated:
        # si ya está logueado, al portal por rol
        return redirect("dashboard")

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
                messages.success(request, f"Â¡Hola {user.first_name or user.username}!")
                # al portal por rol
                return redirect("dashboard")
            else:
                messages.error(request, "Credenciales inválidas. Verifica tu email y contraseÃ±a.")
    else:
        form = LoginForm()

    return render(request, "LevelUp/auth/login.html", {"form": form})


@login_required
def logout_view(request):
    logout(request)
    messages.info(request, "Sesión cerrada correctamente.")
    return redirect("login")


# -------------------------------------------------------------------
# Portal por rol (ahora en /inicio/)
# -------------------------------------------------------------------
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
            "promedio_general": "â€”",
            "dias_activos": 7,
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
    """Editar datos basicos del perfil (nombre, apellido, email, RUT)."""
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
    """Cambiar contraseñaa (mantiene la sesión activa al cambiarla)."""
    if request.method == "POST":
        form = PasswordChangeForm(user=request.user, data=request.POST)
        if form.is_valid():
            user = form.save()
            update_session_auth_hash(request, user)  # mantener sesiÃ³n
            messages.success(request, "Tu contraseÃ±a fue actualizada.")
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
# imports usuales
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect, get_object_or_404

# importa tus modelos
from .models import Docente, Actividad, AsignacionDocente


@login_required
def actividades_docente_lista(request):
    docente = Docente.objects.filter(usuario=request.user).first()

    # Base: actividades creadas por el docente
    qs = (Actividad.objects
          .select_related("docente", "asignatura")
          .order_by("-id"))
    if docente:
        qs = qs.filter(docente=docente)

    # Detecta la asignatura "propia" del docente
    asignatura_prof = None
    rels = AsignacionDocente.objects.filter(
        profesor=request.user
    ).select_related("asignatura")

    if rels.count() == 1:
        asignatura_prof = rels.first().asignatura
    elif docente and docente.asignatura:
        asignatura_prof = Asignatura.objects.filter(
            nombre__iexact=docente.asignatura.strip()
        ).first()

    # Si la encontramos, filtramos por ella
    if asignatura_prof:
        qs = qs.filter(asignatura=asignatura_prof)

    return render(request, "LevelUp/actividades/docente_lista.html", {
        "actividades": qs,
        "asignatura_prof": asignatura_prof,
    })

@login_required
def actividad_crear(request):
    # Solo docentes
    if getattr(request.user, "rol", None) != "DOCENTE":
        raise Http404

    docente = get_object_or_404(Docente, usuario=request.user)

    if request.method == "POST":
        form = ActividadForm(request.POST, request.FILES)

        # formset contra un objeto "temporal" sin guardar (para validar campos)
        temp_act = Actividad(docente=docente)
        formset = ItemFormSet(request.POST, request.FILES, instance=temp_act, prefix="items")

        if form.is_valid() and formset.is_valid():
            with transaction.atomic():
                act = form.save(commit=False)
                act.docente = docente
                if getattr(act, "es_publicada", False) and not getattr(act, "fecha_publicacion", None):
                    act.fecha_publicacion = timezone.now()
                act.save()
                form.save_m2m()

                # ahora sÃ­, asociamos y guardamos los Ã­tems
                formset.instance = act
                formset.save()

            messages.success(request, "Actividad creada correctamente.")

            if request.POST.get("accion") == "guardar_y_asignar":
                return redirect(f"/actividades/docente/{act.pk}/editar/?open=asignar")

            return redirect("docente_lista")
        else:
            messages.error(request, "Revisa los errores en el formulario y los í­tems.")
    else:
        form = ActividadForm()
        temp_act = Actividad(docente=docente)              # <-- agrega esto
        formset = ItemFormSet(instance=temp_act, prefix="items")

    ctx = {
        "form": form,
        "formset": formset,
        "editar": False,
        "abrir_asignar": request.GET.get("abrir_asignar") == "1",
        "cursos": Curso.objects.all().order_by("nivel", "letra"),
        "estudiantes": Estudiante.objects.select_related("usuario").order_by(
            "usuario__first_name", "usuario__last_name"
        ),
    }
    return render(request, "LevelUp/actividades/actividad_form.html", ctx)

@login_required
def actividad_editar(request, pk):
    # Solo docentes
    if getattr(request.user, "rol", None) != "DOCENTE":
        raise Http404

    docente = get_object_or_404(Docente, usuario=request.user)
    act = get_object_or_404(Actividad, pk=pk, docente=docente)

    if request.method == "POST":
        form = ActividadForm(request.POST, request.FILES, instance=act)
        formset = ItemFormSet(request.POST, request.FILES, instance=act, prefix="items")

        if form.is_valid() and formset.is_valid():
            with transaction.atomic():
                obj = form.save(commit=False)
                obj.docente = docente
                if getattr(obj, "es_publicada", False) and not getattr(obj, "fecha_publicacion", None):
                    obj.fecha_publicacion = timezone.now()
                obj.save()
                form.save_m2m()
                formset.save()

            messages.success(request, "Actividad actualizada.")
            return redirect("docente_lista")
        else:
            messages.error(request, "Revisa los errores en el formulario y los í­tems.")
    else:
        form = ActividadForm(instance=act)
        formset = ItemFormSet(instance=act, prefix="items")

    # Acepta ambos parametros para abrir el modal
    abrir_asignar = (
        request.GET.get("open") == "asignar"
    ) or (
        request.GET.get("abrir_asignar") == "1"
    )

    ctx = {
        "form": form,
        "formset": formset,
        "editar": True,
        "act": act,
        "abrir_asignar": abrir_asignar,
        "cursos": Curso.objects.all().order_by("nivel", "letra"),
        "estudiantes": Estudiante.objects.select_related("usuario").order_by(
            "usuario__first_name", "usuario__last_name"
        ),
    }
    return render(request, "LevelUp/actividades/actividad_form.html", ctx)

@login_required
@require_POST
def actividad_asignar(request, pk):
    # Solo docentes
    if getattr(request.user, "rol", None) != "DOCENTE":
        raise Http404

    docente = get_object_or_404(Docente, usuario=request.user)
    act = get_object_or_404(Actividad, pk=pk, docente=docente)

    # IDs que vienen del formulario
    cursos_ids = [int(x) for x in request.POST.getlist("cursos") if str(x).strip()]
    alumnos_usuario_ids = [int(x) for x in request.POST.getlist("alumnos") if str(x).strip()]
    # "alumnos" envi­a Usuario.id (no Estudiante.id)

    # 1) Junta todos los Usuario.id objetivo
    usuario_ids = set(alumnos_usuario_ids)

    if cursos_ids:
        # Matricula.estudiante_id -> Usuario.id
        usuario_ids.update(
            Matricula.objects
            .filter(curso_id__in=cursos_ids)
            .values_list("estudiante_id", flat=True)
        )

    if not usuario_ids:
        messages.warning(request, "Selecciona al menos un curso o un alumno.")
        return redirect(reverse("actividad_editar", args=[act.pk]) + "?open=asignar")

    # 2) Limita a Estudiantes que EXISTEN (su PK = usuario_id)
    est_pks = set(
        Estudiante.objects
        .filter(usuario_id__in=usuario_ids)
        .values_list("usuario_id", flat=True)   # <-- PK de Estudiante
    )

    if not est_pks:
        messages.warning(request, "No se encontraron perfiles de estudiante para la selecciÃ³n.")
        return redirect(reverse("actividad_editar", args=[act.pk]) + "?open=asignar")

    # 3) Crea asignaciones evitando duplicados
    creadas = existentes = 0
    for est_pk in est_pks:
        _, created = AsignacionActividad.objects.get_or_create(
            actividad=act,
            estudiante_id=est_pk,  # FK directa al PK de Estudiante (usuario_id)
        )
        if created:
            creadas += 1
        else:
            existentes += 1

    messages.success(
        request,
        f"Actividad asignada: {creadas} nuevas, {existentes} ya existí­an."
    )
    return redirect(reverse("actividad_editar", args=[act.pk]) + "?open=asignar")

@login_required
def actividad_eliminar(request, pk):
    a = get_object_or_404(Actividad, pk=pk)

    # Chequeo básico de pertenencia/permiso: adapta al campo correcto (docente/creador/autor)
    owner_ok = (
        (hasattr(a, "docente") and a.docente_id == request.user.id) or
        (hasattr(a, "creador") and getattr(a, "creador_id", None) == request.user.id) or
        (hasattr(a, "autor") and getattr(a, "autor_id", None) == request.user.id)
    )
    if not owner_ok and not request.user.is_superuser:
        return HttpResponseForbidden("No puedes eliminar esta actividad.")

    if request.method == "POST":
        titulo = a.titulo
        a.delete()
        messages.success(request, f"Actividad «{titulo}» eliminada.")
        # Ajusta el nombre del listado si es distinto
        return redirect("docente_lista")

    # Si llegan por GET, muestra confirmación (opcional)
    return render(request, "LevelUp/actividades/confirmar_eliminar.html", {"a": a})

# -----------------------
# Helpers de corrección (estudiante) 
# -----------------------
def _post_bool(v):
    return str(v).lower() in ("true", "1", "on", "si", "sí")

def _grade_game(item, POST):
    """
    Evalúa un ítem 'game' a partir de valores enviados desde el front.
    Campos esperados (opcionales):
      - item_{id}_completado: 'true'/'false'
      - item_{id}_score: float 0..1 (si no viene, usa 1.0 si completado)
      - item_{id}_correctas / item_{id}_total (solo para juegos que lo reportan)
      - item_{id}_detail: JSON con telemetría adicional
    """
    base = f"item_{item.pk}"
    done = _post_bool(POST.get(f"{base}_completado", True))

    # ratio 0..1 (si no viene, 1.0 si completado; 0.0 en caso contrario)
    try:
        ratio = float(POST.get(f"{base}_score", ""))
    except Exception:
        ratio = 1.0 if done else 0.0
    ratio = max(0.0, min(1.0, ratio))

    # opcionales
    try:
        corr = int(float(POST.get(f"{base}_correctas", "0") or 0))
    except Exception:
        corr = None
    try:
        tot = int(float(POST.get(f"{base}_total", "0") or 0))
    except Exception:
        tot = None

    detail_raw = POST.get(f"{base}_detail")
    try:
        detail = json.loads(detail_raw) if detail_raw else None
    except Exception:
        detail = None

    payload = {
        "completado": done,
        "score": ratio,
        "kind": (item.datos or {}).get("kind"),
    }
    if detail is not None:
        payload["detail"] = detail
    if corr is not None:
        payload["correctas"] = corr
    if tot is not None:
        payload["total"] = tot

    return (ratio >= 1.0), payload, ratio


# -----------------------
# Estudiante
# -----------------------
@login_required
def estudiante_mis_actividades(request):
    if not es_estudiante(request.user):
        raise Http404
    estudiante = get_object_or_404(Estudiante, usuario=request.user)

    # Solo PUBLICADAS y ASIGNADAS al estudiante
    act_qs = (
        Actividad.objects
        .filter(es_publicada=True, asignacionactividad__estudiante=estudiante)
        .distinct()
        .order_by("-fecha_publicacion", "-id")
    )

    # Conteos de intentos por actividad para este estudiante
    subs_counts = (
        Submission.objects
        .filter(estudiante=estudiante, actividad__in=act_qs)
        .values("actividad")
        .annotate(
            total=Count("id"),
            abiertos=Count("id", filter=Q(finalizado=False)),
            finalizados=Count("id", filter=Q(finalizado=True)),
        )
    )
    counts_map = {row["actividad"]: row for row in subs_counts}

    # Overrides de intentos por alumno (AsignacionActividad.intentos_permitidos)
    overrides = (
        AsignacionActividad.objects
        .filter(estudiante=estudiante, actividad__in=act_qs)
        .values("actividad_id", "intentos_permitidos")
    )
    ov_map = {r["actividad_id"]: r["intentos_permitidos"] for r in overrides if r["intentos_permitidos"]}

    now = timezone.now()
    rows = []
    grupos = {}
    for a in act_qs:
        c = counts_map.get(a.id, {"total": 0, "abiertos": 0, "finalizados": 0})
        usados = int(c["total"])
        abiertos = int(c["abiertos"])
        finalizados = int(c["finalizados"])

        cerrada = bool(a.fecha_cierre and now > a.fecha_cierre)
        max_for_student = ov_map.get(a.id) or (a.intentos_max or 1)

        # Puede intentar si estÃ¡ abierta y no agotÃ³ intentos
        puede_intentar = (not cerrada) and (usados < max_for_student)
        tiene_abierto = abiertos > 0
        tiene_resultados = finalizados > 0

        row = {
            "a": a,
            "usados": usados,
            "max": max_for_student,
            "tiene_abierto": tiene_abierto,
            "puede_intentar": puede_intentar,
            "tiene_resultados": tiene_resultados,
            "cerrada": cerrada,
        }
        try:
            asignatura_nombre = getattr(a.docente, "asignatura", None)
        except Exception:
            asignatura_nombre = None
        if not asignatura_nombre:
            asignatura_nombre = "Asignatura"
        row["asignatura"] = asignatura_nombre
        rows.append(row)
        grupos.setdefault(asignatura_nombre, []).append(row)

    return render(
        request,
        "LevelUp/actividades/estudiante_lista.html",
        {
            "rows": rows,
            "actividades": [r["a"] for r in rows],
            "grupos": [{"asignatura": k, "rows": v} for k, v in grupos.items()],
        }
    )

@login_required
def actividad_resolver(request, pk):
    return redirect("resolver_play", pk=pk)


def _letra(i):
    # 0->A, 1->B...
    try:
        i = int(i)
    except Exception:
        return "?"
    return chr(65 + i)

@login_required
def actividad_resultados(request, pk):
    if not es_estudiante(request.user):
        raise Http404

    estudiante = get_object_or_404(Estudiante, usuario=request.user)
    act = get_object_or_404(Actividad, pk=pk)

    # ultimo intento por defecto; permite ?intento=2 para ver uno especi­fico
    intento_qs = Submission.objects.filter(
        actividad=act, estudiante=estudiante, finalizado=True
    ).order_by("-intento", "-id")

    if not intento_qs.exists():
        # Si nunca ha enviado, no hay resultados; redirige a resolver si tiene intento abierto
        if Submission.objects.filter(
            actividad=act, estudiante=estudiante, finalizado=False
        ).exists():
            return redirect("resolver_play", pk=act.pk)
        messages.info(request, "Aún no has enviado esta actividad.")
        return redirect("resolver_play", pk=act.pk)

    intento_param = request.GET.get("intento")
    if intento_param and str(intento_param).isdigit():
        sub = intento_qs.filter(intento=int(intento_param)).first() or intento_qs.first()
    else:
        sub = intento_qs.first()

        items_data = []
    for item in act.items.all():
        tipo = (item.tipo or "").lower()
        ans = Answer.objects.filter(submission=sub, item=item).first()
        respuesta = ans.respuesta if ans else {}
        correcto = bool(ans.es_correcta) if ans else False

        detalle = {
            "tipo": tipo,
            "correcto": correcto,
            "puntaje": item.puntaje,
            "obtenido": ans.puntaje_obtenido if ans else 0,
        }

        # Único flujo soportado: 'game'
        if tipo == "game":
            comp = bool(respuesta.get("completado", True))
            try:
                score = float(respuesta.get("score", ""))
            except Exception:
                score = None
            corr = respuesta.get("correctas")
            tot  = respuesta.get("total")
            inc  = (tot - corr) if (isinstance(corr, (int, float)) and isinstance(tot, (int, float))) else None
            detalle.update({
                "completado": comp,
                "score": score,
                "correctas": corr,
                "total": tot,
                "incorrectas": inc,
                "kind": respuesta.get("kind"),
                "detail": respuesta.get("detail"),
            })
        else:
            # Cualquier otro tipo (residual) se muestra crudo
            detalle.update({"respuesta": respuesta})

        items_data.append({"item": item, "detalle": detalle})

    # Intentos usados / máximo y lógica de reintento SOLO si no está cerrada
    intentos_usados = Submission.objects.filter(actividad=act, estudiante=estudiante).count()
    intentos_max = act.intentos_max
    now = timezone.now()
    puede_reintentar = (
        act.es_publicada
        and (not act.fecha_cierre or now <= act.fecha_cierre)
        and intentos_usados < intentos_max
    )

    return render(request, "LevelUp/actividades/estudiante_resultados.html", {
        "actividad": act,
        "sub": sub,
        "items_data": items_data,
        "intentos_usados": intentos_usados,
        "intentos_max": intentos_max,
        "puede_reintentar": puede_reintentar,
        "intentos": list(intento_qs),
    })

# ===================================================================
# MODO GAMIFICADO (PLAY) + APIs AJAX
# ===================================================================

@login_required
def actividad_play(request, pk):
    """Vista interactiva tipo juego: un i­tem a la vez con feedback inmediato via AJAX."""
    if not es_estudiante(request.user):
        raise Http404
    estudiante = get_object_or_404(Estudiante, usuario=request.user)
    act = get_object_or_404(Actividad, pk=pk, es_publicada=True)

    # Validar asignación
    if not AsignacionActividad.objects.filter(estudiante=estudiante, actividad=act).exists():
        raise Http404

    # Cierre
    if act.fecha_cierre and timezone.now() > act.fecha_cierre:
        messages.warning(request, "La actividad está cerrada.")
        return redirect("estudiante_lista")

    # Intentos
    intentos_usados = Submission.objects.filter(actividad=act, estudiante=estudiante).count()
    intentos_max = act.intentos_max or 1
    sub = (Submission.objects
           .filter(actividad=act, estudiante=estudiante, finalizado=False)
           .order_by("-intento", "-id").first())
    if not sub:
        if intentos_usados >= intentos_max:
            messages.info(request, "Ya no tienes intentos disponibles.")
            return redirect("resolver_resultado", pk=act.pk)
        sub = Submission.objects.create(
            actividad=act, estudiante=estudiante, intento=intentos_usados + 1
        )

    # Progreso actual
    items = list(act.items.all().values("id", "tipo", "enunciado", "datos", "puntaje"))
    respondidas_ids = set(Answer.objects.filter(submission=sub).values_list("item_id", flat=True))
    total = len(items)
    hechas = sum(1 for i in respondidas_ids)

    return render(request, "LevelUp/actividades/play.html", {
        "actividad": act,
        "submission": sub,
        "items": items,
        "total_items": total,
        "hechas": hechas,
        "xp_total": act.xp_total or 0,
        "intento_actual": sub.intento,
        "intentos_max": intentos_max,
    })


def _eval_item(item, payload: dict):
    """
    Evalúa payload para 'game'. Los demás tipos ya no se usan.
    """
    t = (item.tipo or "").lower()
    if t == "game":
        # el front puede ya haber calculado ratio; si no, considera completado como éxito total
        try:
            ratio = float(payload.get("score", 1.0))
        except Exception:
            ratio = 1.0 if bool(payload.get("completado", True)) else 0.0
        ratio = max(0.0, min(1.0, ratio))
        pts = round(item.puntaje * ratio)
        return (ratio >= 1.0), pts, {}
    return False, 0, {}


@login_required
@require_POST
def api_item_answer(request, pk, item_id):
    """
    Recibe: {"payload": {"completado": true, "meta": {...}, "kind":"memory|dragmatch|trivia"}}
    Guarda telemetrí­a en Submission.detalle y otorga XP/coins/desbloqueos.
    """
    try:
        body = json.loads(request.body.decode("utf-8"))
    except Exception:
        return HttpResponseBadRequest("JSON inválido")
    payload = body.get("payload") or {}
    meta = payload.get("meta") or {}
    completado = bool(payload.get("completado"))
    kind = (payload.get("kind") or "").lower()

    actividad = get_object_or_404(Actividad, pk=pk)
    try:
        estudiante = Estudiante.objects.get(usuario=request.user)
    except Estudiante.DoesNotExist:
        return HttpResponseBadRequest("Solo estudiantes pueden responder")

    # Obtiene o crea submission para esta actividad
    sub, _ = Submission.objects.get_or_create(
        actividad=actividad,
        estudiante=request.user,  # si tu Submission usa Usuario
        defaults={"started_at": timezone.now(), "detalle": {}}
    )

    # Guarda telemetrí­a por i­tem
    detalle = sub.detalle or {}
    detalle[str(item_id)] = {
        "completado": completado,
        "kind": kind or "game",
        "meta": meta,
        "at": timezone.now().isoformat()
    }
    sub.detalle = detalle

    # puntajes básicos (opcional)
    sub.score = int(sub.score or 0) + int(meta.get("hits", meta.get("found", 0)) or 0) * 10
    sub.correctas = int(sub.correctas or 0) + int(meta.get("hits", meta.get("found", 0)) or 0)
    sub.incorrectas = int(sub.incorrectas or 0) + int(meta.get("misses", 0))
    sub.finished_at = timezone.now()
    sub.save()

    # Recompensas
    outcome = compute_rewards(meta)
    res = apply_rewards(estudiante, outcome)

    return JsonResponse({
        "ok": True,
        "submission_id": sub.id,
        "reward": {"xp": outcome.xp, "coins": outcome.coins, "unlocks": outcome.unlocks, **res},
    })


@require_POST
@login_required
def api_item_hint(request, pk, item_id):
    """Devuelve pista (si existe en datos.hint) para el item en modo play."""
    if not es_estudiante(request.user):
        return JsonResponse({"ok": False, "error": "No autorizado."}, status=403)

    estudiante = get_object_or_404(Estudiante, usuario=request.user)
    act = get_object_or_404(Actividad, pk=pk, es_publicada=True)
    item = get_object_or_404(ItemActividad, pk=item_id, actividad=act)

    if not AsignacionActividad.objects.filter(estudiante=estudiante, actividad=act).exists():
        return JsonResponse({"ok": False, "error": "No asignada."}, status=403)

    hint = (item.datos or {}).get("hint") or "Piensa en los conceptos clave que viste en clase."
    return JsonResponse({"ok": True, "hint": hint})


# -------------------------------------------------------------------
# Portal estudiante (info de curso y docentes de refuerzo)
# -------------------------------------------------------------------
def _nombre_docente(obj):
    """
    Devuelve un nombre bonito tanto si obj es Usuario como si es Docente (con .usuario).
    """
    if not obj:
        return None
    usuario = getattr(obj, "usuario", None)
    if usuario:
        return usuario.get_full_name() or usuario.username
    get_full = getattr(obj, "get_full_name", None)
    if callable(get_full):
        return get_full() or getattr(obj, "username", None)
    return str(obj)

@login_required
def portal_estudiante(request):
    u = request.user

    # Curso actual (toma la matrÃ­cula mÃ¡s reciente)
    matricula = (Matricula.objects
                 .select_related("curso")
                 .filter(estudiante=u)
                 .order_by("-fecha")
                 .first())

    curso_str = None
    if matricula and matricula.curso:
        c = matricula.curso
        # Si Curso.nivel es choice, usa display; si es int, muestra nÃºmero:
        try:
            nivel_display = c.get_nivel_display()
        except Exception:
            nivel_display = f"{c.nivel}A° Básico"
        curso_str = f'{nivel_display} {c.letra}'

    docente_matematicas = None
    docente_ingles = None

    # 1) Si el alumno está en un grupo de refuerzo, usamos ese grupo
    gr_alum = (GrupoRefuerzoNivelAlumno.objects
               .select_related("grupo")
               .filter(alumno=u)
               .first())
    if gr_alum and gr_alum.grupo:
        g = gr_alum.grupo
        dm = getattr(g, "docente_matematicas", None) or getattr(g, "profesor_matematicas", None)
        di = getattr(g, "docente_ingles", None) or getattr(g, "profesor_ingles", None)
        docente_matematicas = _nombre_docente(dm)
        docente_ingles = _nombre_docente(di)

    # 2) Si no hay grupo del alumno, usa el grupo del nivel del curso (si existe)
    if (not docente_matematicas or not docente_ingles) and matricula and matricula.curso:
        g = GrupoRefuerzoNivel.objects.filter(nivel=matricula.curso.nivel).first()
        if g:
            dm = getattr(g, "docente_matematicas", None) or getattr(g, "profesor_matematicas", None)
            di = getattr(g, "docente_ingles", None) or getattr(g, "profesor_ingles", None)
            if not docente_matematicas:
                docente_matematicas = _nombre_docente(dm)
            if not docente_ingles:
                docente_ingles = _nombre_docente(di)

    context = {
        "curso": curso_str,
        "docente_matematicas": docente_matematicas,
        "docente_ingles": docente_ingles,
    }
    return render(request, "LevelUp/estudiante_portal.html", context)

# =============================================================
# Misiones
# =============================================================

def _load_static_map(path):
    """Intenta cargar el JSON del static map; si falla devuelve plantilla base."""
    try:
        real = finders.find(path)
        if real:
            with open(real, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    # mapa base simple por defecto
    return {"name": "default", "questions": []}

@login_required
def misiones_mapa(request, actividad_pk=None, slug=None, nivel=None):
    """
    Devuelve JSON del mapa. Si se pasa actividad_pk, inyecta las preguntas
    definidas en los ItemActividad (tipo 'game') dentro del mapa.
    """
    # carga mapa base según slug/nivel o usa el primer mapa por defecto
    default_map = MAPS.get((slug, nivel)) if slug and nivel else next(iter(MAPS.values()))
    base = _load_static_map(default_map)

    # si se pidió una actividad concreta, intenta inyectarle items tipo 'game'
    if actividad_pk:
        try:
            act = Actividad.objects.get(pk=int(actividad_pk))
            items = act.items.filter(tipo__iexact="game")
            questions = []
            for it in items:
                # suponemos que it.datos es JSON con keys relevantes: question/options/answer...
                datos = it.datos or {}
                q = {
                    "id": it.pk,
                    "title": datos.get("title") or it.enunciado or datos.get("question"),
                    "payload": datos,          # todo dato adicional que necesite el front
                    "puntaje": it.puntaje or 0,
                }
                questions.append(q)
            # asegurarse de que la clave questions exista
            new_map = dict(base)
            new_map["questions"] = questions
            new_map["actividad_id"] = act.pk
            return JsonResponse(new_map, safe=False)
        except Actividad.DoesNotExist:
            return JsonResponse({"error": "Actividad no encontrada"}, status=404)

    # Sin actividad, devolver el mapa base
    return JsonResponse(base, safe=False)

# Mapeo simple: (mundo, nivel) -> archivo de mapa (dentro de static)
MAPS = {
    ("bosque", 1): "LevelUp/maps/escenario1.json",
    # agrega más niveles si quieres:
    # ("bosque", 2): "LevelUp/maps/escenario2.json",
    # ("desierto", 1): "LevelUp/maps/desierto_n1.json",
}

def misiones_jugar(request, slug, nivel):
    # Si se pasa ?actividad=PK, se usará el endpoint dinámico
    actividad_pk = request.GET.get("actividad")
    if actividad_pk:
        # URL relativa al endpoint (agrega URLconf como en el siguiente bloque)
        map_url = reverse("misiones_mapa_actividad", args=[actividad_pk])
    else:
        # busca el mapa o usa uno por defecto
        map_path = MAPS.get((slug, int(nivel)), "LevelUp/maps/escenario1.json")
        map_url = static(map_path)
    return render(request, "LevelUp/misiones/jugar.html", {
        "map_url": map_url,
        "mundo": slug,
        "nivel": nivel,
    })