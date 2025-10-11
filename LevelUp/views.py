from django.shortcuts import render, redirect, get_object_or_404
from django.http import HttpResponse, Http404, JsonResponse
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

# Formularios de actividades


# Modelos
from .models import (
    Estudiante, Docente, Actividad, AsignacionActividad,
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
    # Renderiza una homepage simple (puedes poner tu landing aquí)
    return render(request, "LevelUp/home.html")


# -------------------------------------------------------------------
# Catálogo / Ranking / Reportes (con login)
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
            messages.success(request, "¡Cuenta creada con éxito! Bienvenido/a a LevelUp.")
            # ⬇⬇ redirige al portal por rol
            return redirect("dashboard")
        else:
            messages.error(request, "Por favor corrige los errores del formulario.")
    else:
        form = RegistrationForm()
    return render(request, "LevelUp/auth/register.html", {"form": form})


def login_view(request):
    if request.user.is_authenticated:
        # ⬇⬇ si ya está logueado, al portal por rol
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
                messages.success(request, f"¡Hola {user.first_name or user.username}!")
                # ⬇⬇ al portal por rol
                return redirect("dashboard")
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
            "promedio_general": "—",
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
    if not getattr(request.user, "rol", None) == "DOCENTE":
        raise Http404

    docente = get_object_or_404(Docente, usuario=request.user)

    if request.method == "POST":
        form = ActividadForm(request.POST, request.FILES)
        temp_act = Actividad(docente=docente)
        formset = ItemFormSet(request.POST, request.FILES, instance=temp_act)

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

            # Si el botón fue "Guardar y asignar…"
            if request.POST.get("accion") == "guardar_y_asignar":
                return redirect(f"/actividades/docente/{act.pk}/editar/?open=asignar")

            return redirect("docente_lista")
        else:
            messages.error(request, "Revisa los errores en el formulario y los ítems.")
    else:
        form = ActividadForm()
        if "docente" in form.fields:
            form.fields["docente"].disabled = True
        formset = ItemFormSet()

    ctx = {
        "form": form,
        "formset": formset,
        "editar": False,            # <— importante
        "cursos": Curso.objects.all().order_by("nivel", "letra"),
        "estudiantes": Estudiante.objects.select_related("usuario").order_by(
            "usuario__first_name", "usuario__last_name"
        ),
    }
    return render(request, "LevelUp/actividades/actividad_form.html", ctx)


@login_required
def actividad_editar(request, pk):
    if not getattr(request.user, "rol", None) == "DOCENTE":
        raise Http404

    docente = get_object_or_404(Docente, usuario=request.user)
    act = get_object_or_404(Actividad, pk=pk, docente=docente)

    if request.method == "POST":
        form = ActividadForm(request.POST, request.FILES, instance=act)
        formset = ItemFormSet(request.POST, request.FILES, instance=act)

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
            messages.error(request, "Revisa los errores en el formulario y los ítems.")
    else:
        form = ActividadForm(instance=act)
        if "docente" in form.fields:
            form.fields["docente"].disabled = True
        formset = ItemFormSet(instance=act)

    ctx = {
        "form": form,
        "formset": formset,
        "editar": True,             # <— importante
        "act": act,                 # <— pasa el objeto para usar act.pk en el template
        "cursos": Curso.objects.all().order_by("nivel", "letra"),
        "estudiantes": Estudiante.objects.select_related("usuario").order_by(
            "usuario__first_name", "usuario__last_name"
        ),
    }
    return render(request, "LevelUp/actividades/actividad_form.html", ctx)

@login_required
@require_POST
def actividad_asignar(request, pk):
    if not getattr(request.user, "rol", None) == "DOCENTE":
        raise Http404

    act = get_object_or_404(Actividad, pk=pk)

    cursos_ids = [int(x) for x in request.POST.getlist("cursos") if x.strip()]
    alumnos_ids = [int(x) for x in request.POST.getlist("alumnos") if x.strip()]  # Usuario.id

    target_usuario_ids = set()

    if alumnos_ids:
        target_usuario_ids.update(
            Estudiante.objects.filter(usuario_id__in=alumnos_ids).values_list("usuario_id", flat=True)
        )

    if cursos_ids:
        target_usuario_ids.update(
            Matricula.objects.filter(curso_id__in=cursos_ids).values_list("estudiante_id", flat=True)
        )

    if not target_usuario_ids:
        messages.warning(request, "No se seleccionaron alumnos ni cursos.")
        return redirect("actividad_editar", pk=act.pk)

    alumnos_est = Estudiante.objects.filter(usuario_id__in=target_usuario_ids)
    creadas, existentes = 0, 0
    for est in alumnos_est:
        obj, created = AsignacionActividad.objects.get_or_create(
            estudiante=est,
            actividad=act,
        )
        if created:
            creadas += 1
        else:
            existentes += 1

    messages.success(
        request,
        f"Actividad asignada correctamente: {creadas} nuevas, {existentes} ya existían."
    )
    return redirect("actividad_editar", pk=act.pk)


# -----------------------
# Helpers de corrección (estudiante)
# -----------------------
def _norm(s):
    return str(s or "").strip()

def _norm_lower(s):
    return _norm(s).lower()

def _post_bool(v):
    return str(v).lower() in ("true", "1", "on", "si", "sí")

def _grade_mcq(item, POST):
    """
    Espera:
      - name='item_{id}' (radio) para single
      - name='item_{id}' (checkboxes -> getlist) para multiple
    item.datos:
      {"opciones":[...], "correctas":[0,2], "multiple": bool}
    """
    name = f"item_{item.pk}"
    datos = item.datos or {}
    correctas = list(datos.get("correctas", []))  # índices 0-based
    multiple = bool(datos.get("multiple", False))

    if multiple:
        raw = POST.getlist(name)
        elegidas = []
        for r in raw:
            try:
                elegidas.append(int(r))
            except Exception:
                pass
        ok = set(elegidas) == set(correctas)
        payload = {"marcadas": elegidas}
        inter = len(set(elegidas) & set(correctas))
        ratio = inter / max(1, len(correctas))
        return ok, payload, ratio
    else:
        val = POST.get(name, "")
        try:
            idx = int(val)
        except Exception:
            idx = None
        ok = (idx is not None) and correctas == [idx]
        payload = {"marcada": idx}
        ratio = 1.0 if ok else 0.0
        return ok, payload, ratio

def _grade_tf(item, POST):
    """
    name='item_{id}' -> 'true'/'false'
    item.datos: {"respuesta": true/false}
    """
    name = f"item_{item.pk}"
    esperado = bool((item.datos or {}).get("respuesta"))
    r = _post_bool(POST.get(name))
    ok = (r == esperado)
    payload = {"valor": r}
    return ok, payload, 1.0 if ok else 0.0

def _grade_fib(item, POST):
    """
    name='item_{id}' -> texto
    item.datos: {"respuestas":[...], "case_insensitive": true}
    """
    name = f"item_{item.pk}"
    datos = item.datos or {}
    case_ins = bool(datos.get("case_insensitive", True))
    aceptadas = [str(x) for x in datos.get("respuestas", [])]
    txt = POST.get(name, "")
    if case_ins:
        ok = _norm_lower(txt) in {_norm_lower(x) for x in aceptadas}
    else:
        ok = _norm(txt) in {_norm(x) for x in aceptadas}
    payload = {"texto": txt}
    return ok, payload, 1.0 if ok else 0.0

def _grade_sort(item, POST):
    """
    Espera un input hidden:
      name='item_{id}_orden' con ids separados por coma (s1,s3,s2)
      o getlist('item_{id}_orden')
    item.datos: {"items":[{"id":"s1","texto":"1"},...], "orden_correcto":["s1","s3","s2"]}
    """
    datos = item.datos or {}
    correcto = list(datos.get("orden_correcto", []))
    name = f"item_{item.pk}_orden"
    if POST.getlist(name):
        orden = POST.getlist(name)
    else:
        raw = POST.get(name, "")
        orden = [x for x in raw.split(",") if x] if raw else []
    ok = orden == correcto
    payload = {"orden": orden}
    ratio = 1.0 if ok else 0.0
    return ok, payload, ratio

def _grade_match(item, POST):
    """
    Espera un input hidden:
      name='item_{id}_pares' con JSON: [{"left":"l1","right":"rA"}, ...]
    item.datos: {"pares":[{"left":{"id":"l1","texto":...},"right":{"id":"rA","texto":...}}, ...]}
    Puntaje parcial proporcional a pares correctos.
    """
    datos = item.datos or {}
    esperado = {(p["left"]["id"], p["right"]["id"]) for p in datos.get("pares", [])}
    name = f"item_{item.pk}_pares"
    try:
        raw = POST.get(name, "[]")
        rlist = json.loads(raw) if isinstance(raw, str) else (raw or [])
    except Exception:
        rlist = []
    rset = {(str(p.get("left")), str(p.get("right"))) for p in rlist if p}
    inter = len(esperado & rset)
    total = max(1, len(esperado))
    ratio = inter / total
    ok = (inter == len(esperado))
    payload = {"pares": [{"left": l, "right": r} for (l, r) in rset]}
    return ok, payload, ratio

def _grade_text(item, POST):
    """
    Respuesta abierta -> no autocorrige (puedes ampliar con palabras_clave).
    item.datos: {"palabras_clave":[...], "long_min": 0}
    """
    name = f"item_{item.pk}"
    txt = POST.get(name, "")
    payload = {"texto": txt}
    return False, payload, 0.0

def _grade_interactive(item, POST):
    """
    Por cumplimiento: si viene 'completado' truthy -> puntaje completo.
    """
    name = f"item_{item.pk}_completado"
    done = _post_bool(POST.get(name, True))  # default True si no llega nada
    payload = {"completado": done}
    return bool(done), payload, 1.0 if done else 0.0


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
    for a in act_qs:
        c = counts_map.get(a.id, {"total": 0, "abiertos": 0, "finalizados": 0})
        usados = int(c["total"])
        abiertos = int(c["abiertos"])
        finalizados = int(c["finalizados"])

        cerrada = bool(a.fecha_cierre and now > a.fecha_cierre)
        max_for_student = ov_map.get(a.id) or (a.intentos_max or 1)

        # Puede intentar si está abierta y no agotó intentos
        puede_intentar = (not cerrada) and (usados < max_for_student)
        tiene_abierto = abiertos > 0
        tiene_resultados = finalizados > 0

        rows.append({
            "a": a,
            "usados": usados,
            "max": max_for_student,
            "tiene_abierto": tiene_abierto,
            "puede_intentar": puede_intentar,
            "tiene_resultados": tiene_resultados,
            "cerrada": cerrada,
        })

    return render(
        request,
        "LevelUp/actividades/estudiante_lista.html",
        {"rows": rows, "actividades": [r["a"] for r in rows]}
    )


@login_required
def actividad_resolver(request, pk):
    if not es_estudiante(request.user):
        raise Http404

    estudiante = get_object_or_404(Estudiante, usuario=request.user)
    act = get_object_or_404(Actividad, pk=pk, es_publicada=True)

    # ¿Se pidió modo play por querystring?
    modo_play = (request.GET.get("modo") == "play")
    template_name = (
        "LevelUp/actividades/play.html"
        if modo_play else
        "LevelUp/actividades/estudiante_resolver.html"
    )

    # Validar asignación al estudiante
    if not AsignacionActividad.objects.filter(estudiante=estudiante, actividad=act).exists():
        raise Http404

    # Cierre
    if getattr(act, "fecha_cierre", None) and timezone.now() > act.fecha_cierre:
        messages.warning(request, "La actividad está cerrada.")
        return redirect("estudiante_lista")

    # ¿Hay un intento sin finalizar?
    sub_abierta = (
        Submission.objects
        .filter(actividad=act, estudiante=estudiante, finalizado=False)
        .order_by("-intento", "-id")
        .first()
    )

    # Intentos ya usados (finalizados o en curso)
    intentos_usados = Submission.objects.filter(actividad=act, estudiante=estudiante).count()
    intentos_max = act.intentos_max or 1

    # Si no hay sub abierta y no quedan intentos → ver resultados del último
    if not sub_abierta and intentos_usados >= intentos_max:
        messages.info(request, "Ya no tienes intentos disponibles para esta actividad.")
        return redirect("resolver_resultado", pk=act.pk)

    # Si no hay sub abierta → crear nuevo intento (1-indexado)
    if not sub_abierta:
        sub_abierta = Submission.objects.create(
            actividad=act, estudiante=estudiante, intento=intentos_usados + 1
        )
    sub = sub_abierta  # alias

    if request.method == "POST":
        total_puntaje = 0
        total_obtenido = 0

        for item in act.items.all():
            tipo = (item.tipo or "").lower()
            es_correcta = False
            obtenido = 0
            payload = {}

            if tipo == "mcq":
                es_correcta, payload, ratio = _grade_mcq(item, request.POST)
                obtenido = int(round(ratio * item.puntaje))
            elif tipo == "tf":
                es_correcta, payload, ratio = _grade_tf(item, request.POST)
                obtenido = int(round(ratio * item.puntaje))
            elif tipo == "fib":
                es_correcta, payload, ratio = _grade_fib(item, request.POST)
                obtenido = int(round(ratio * item.puntaje))
            elif tipo == "sort":
                es_correcta, payload, ratio = _grade_sort(item, request.POST)
                obtenido = int(round(ratio * item.puntaje))
            elif tipo == "match":
                es_correcta, payload, ratio = _grade_match(item, request.POST)
                obtenido = int(round(ratio * item.puntaje))
            elif tipo == "text":
                es_correcta, payload, ratio = _grade_text(item, request.POST)
                obtenido = int(round(ratio * item.puntaje))
            elif tipo in ("interactive", "game"):
                es_correcta, payload, ratio = _grade_interactive(item, request.POST)
                obtenido = int(round(ratio * item.puntaje))
            else:
                val = request.POST.get(f"item_{item.pk}")
                payload = {"valor": val}
                es_correcta = False
                obtenido = 0

            ans, _ = Answer.objects.get_or_create(submission=sub, item=item)
            ans.respuesta = payload
            ans.es_correcta = bool(es_correcta)
            ans.puntaje_obtenido = max(0, min(item.puntaje, int(obtenido)))
            ans.save()

            total_puntaje += int(item.puntaje)
            total_obtenido += int(ans.puntaje_obtenido)

        sub.finalizado = True
        sub.enviado_en = timezone.now()
        sub.calificacion = round((total_obtenido / max(1, total_puntaje)) * 100, 2)
        sub.xp_obtenido = int((total_obtenido / max(1, total_puntaje)) * (act.xp_total or 0))
        sub.save()

        messages.success(request, "¡Actividad enviada! Tus respuestas fueron registradas.")
        return redirect("resolver_resultado", pk=act.pk)

    # GET → renderizar el template correspondiente (play o clásico)
    return render(request, template_name, {
        "actividad": act,
        "submission": sub,
        "intento_actual": sub.intento,
        "intentos_max": intentos_max,
        "modo_play": modo_play,
    })

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

    # Último intento por defecto; permite ?intento=2 para ver uno específico
    intento_qs = Submission.objects.filter(
        actividad=act, estudiante=estudiante, finalizado=True
    ).order_by("-intento", "-id")

    if not intento_qs.exists():
        # Si nunca ha enviado, no hay resultados; redirige a resolver si tiene intento abierto
        if Submission.objects.filter(
            actividad=act, estudiante=estudiante, finalizado=False
        ).exists():
            return redirect("resolver", pk=act.pk)
        messages.info(request, "Aún no has enviado esta actividad.")
        return redirect("resolver", pk=act.pk)

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

        if tipo == "mcq":
            opciones = list((item.datos or {}).get("opciones", []))
            correctas = list((item.datos or {}).get("correctas", []))  # índices 0-based
            multiple = bool((item.datos or {}).get("multiple", False))
            if multiple:
                marcadas = list(respuesta.get("marcadas") or [])
            else:
                marcadas = [respuesta.get("marcada")] if respuesta.get("marcada") is not None else []
            detalle.update({
                "opciones": opciones,
                "correctas": correctas,
                "marcadas": marcadas,
                "multiple": multiple,
                "correctas_letras": ", ".join(_letra(i) for i in correctas),
                "marcadas_letras": ", ".join(_letra(i) for i in marcadas if i is not None),
            })

        elif tipo == "tf":
            esperado = bool((item.datos or {}).get("respuesta"))
            valor = bool(respuesta.get("valor"))
            detalle.update({"esperado": esperado, "valor": valor})

        elif tipo == "fib":
            aceptadas = list((item.datos or {}).get("respuestas", []))
            texto = (respuesta.get("texto") or "")
            detalle.update({"aceptadas": aceptadas, "texto": texto})

        elif tipo == "sort":
            orden_ok = list((item.datos or {}).get("orden_correcto", []))
            items_map = {x["id"]: x.get("texto") for x in (item.datos or {}).get("items", [])}
            orden_alum = (respuesta.get("orden") or [])
            detalle.update({
                "orden_correcto": [items_map.get(i, i) for i in orden_ok],
                "orden_alumno": [items_map.get(i, i) for i in orden_alum],
            })

        elif tipo == "match":
            pares = (item.datos or {}).get("pares", [])
            esperado_ids = [(p["left"]["id"], p["right"]["id"]) for p in pares]
            left_map = {p["left"]["id"]: p["left"]["texto"] for p in pares}
            right_map = {p["right"]["id"]: p["right"]["texto"] for p in pares}
            alumno_ids = [(p.get("left"), p.get("right")) for p in (respuesta.get("pares") or [])]
            detalle.update({
                "pares_esperados": [(left_map.get(l, l), right_map.get(r, r)) for (l, r) in esperado_ids],
                "pares_alumno": [(left_map.get(l, l), right_map.get(r, r)) for (l, r) in alumno_ids],
            })

        elif tipo == "text":
            detalle.update({
                "texto": (respuesta.get("texto") or ""),
                "palabras_clave": (item.datos or {}).get("palabras_clave", []),
                "long_min": (item.datos or {}).get("long_min", 0),
            })

        elif tipo in ("interactive", "game"):
            detalle.update({"completado": bool(respuesta.get("completado", True))})

        else:
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
    })

# ===================================================================
# MODO GAMIFICADO (PLAY) + APIs AJAX
# ===================================================================

@login_required
def actividad_play(request, pk):
    """Vista interactiva tipo juego: un ítem a la vez con feedback inmediato vía AJAX."""
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
        "intento": sub.intento,
        "intentos_max": intentos_max,
    })


def _eval_item(item: ItemActividad, payload: dict):
    """
    Evalúa payload por tipo. Devuelve (es_correcta, puntaje_obtenido, meta_extra)
    """
    t = (item.tipo or "").lower()
    datos = item.datos or {}
    meta = {}

    if t == "mcq":
        multiple = bool(datos.get("multiple"))
        correctas = list(datos.get("correctas", []))   # 0-based
        if multiple:
            try:
                marcadas = sorted([int(i) for i in payload.get("marcadas", [])])
            except Exception:
                marcadas = []
            es_ok = marcadas == sorted(correctas)
        else:
            marcada = payload.get("marcada")
            try:
                marcada = int(marcada) if marcada is not None else None
            except Exception:
                marcada = None
            es_ok = (marcada is not None) and (marcada in correctas)
        return es_ok, (item.puntaje if es_ok else 0), meta

    if t == "tf":
        esperado = bool(datos.get("respuesta"))
        valor = bool(payload.get("valor"))
        es_ok = (valor is esperado)
        return es_ok, (item.puntaje if es_ok else 0), meta

    if t == "fib":
        # {"items":[{"id":"f1","respuestas":["4","cuatro"]}]}
        aceptadas_map = {x["id"]: set([str(s).strip().lower() for s in x.get("respuestas", [])])
                         for x in datos.get("items", [])}
        entradas = payload.get("campos", {})  # {"f1":"4", ...}
        aciertos = 0
        total = max(1, len(aceptadas_map))
        for fid, ok_set in aceptadas_map.items():
            val = str(entradas.get(fid, "") or "").strip().lower()
            if val in ok_set:
                aciertos += 1
        es_ok = aciertos == total
        pts = round(item.puntaje * (aciertos / total))
        meta["aciertos"] = aciertos
        meta["total"] = total
        return es_ok, pts, meta

    if t == "sort":
        correcto = datos.get("orden_correcto", [])
        alumno = payload.get("orden", [])
        es_ok = alumno == correcto
        pts = item.puntaje if es_ok else 0
        return es_ok, pts, meta

    if t == "match":
        esperado = [(p["left"]["id"], p["right"]["id"]) for p in datos.get("pares", [])]
        alumno = [(p.get("left"), p.get("right")) for p in payload.get("pares", [])]
        esperado_set = set(esperado)
        alumno_set = set(alumno)
        inter = len(esperado_set & alumno_set)
        total = max(1, len(esperado_set))
        es_ok = inter == total
        pts = round(item.puntaje * (inter / total))
        meta["aciertos"] = inter
        meta["total"] = total
        return es_ok, pts, meta

    if t in ("interactive", "game"):
        return True, item.puntaje, meta

    if t == "text":
        return False, 0, meta

    return False, 0, meta


@require_POST
@login_required
def api_item_answer(request, pk, item_id):
    """Recibe la respuesta de un ítem, corrige, guarda y responde JSON (modo play)."""
    if not es_estudiante(request.user):
        return JsonResponse({"ok": False, "error": "No autorizado."}, status=403)

    estudiante = get_object_or_404(Estudiante, usuario=request.user)
    act = get_object_or_404(Actividad, pk=pk, es_publicada=True)
    item = get_object_or_404(ItemActividad, pk=item_id, actividad=act)

    # Validar asignación
    if not AsignacionActividad.objects.filter(estudiante=estudiante, actividad=act).exists():
        return JsonResponse({"ok": False, "error": "No asignada."}, status=403)

    # Intento abierto
    sub = (Submission.objects
           .filter(actividad=act, estudiante=estudiante, finalizado=False)
           .order_by("-intento", "-id").first())
    if not sub:
        return JsonResponse({"ok": False, "error": "Intento no disponible."}, status=400)

    # Payload
    try:
        data = json.loads(request.body.decode("utf-8"))
    except Exception:
        data = request.POST.dict()

    payload = data.get("payload") or {}
    es_ok, pts, meta = _eval_item(item, payload)

    ans, _ = Answer.objects.get_or_create(submission=sub, item=item)
    ans.respuesta = payload
    ans.es_correcta = es_ok
    # conserva la mejor puntuación para el ítem dentro del mismo intento
    ans.puntaje_obtenido = max(int(ans.puntaje_obtenido or 0), int(pts or 0))
    ans.save()

    # Progreso y calificación parcial
    items = list(act.items.all())
    total_puntaje = sum(i.puntaje for i in items) or 1
    obtenido = Answer.objects.filter(submission=sub).aggregate(s=models.Sum("puntaje_obtenido"))["s"] or 0
    progreso = round(100 * (obtenido / total_puntaje), 1)

    # XP proporcional
    xp_total = act.xp_total or 0
    xp_actual = int(xp_total * (obtenido / total_puntaje))
    sub.xp_obtenido = xp_actual
    sub.calificacion = progreso
    sub.save(update_fields=["xp_obtenido", "calificacion"])

    return JsonResponse({
        "ok": True,
        "correcto": es_ok,
        "puntaje_item": item.puntaje,
        "puntaje_obtenido_item": int(pts or 0),
        "meta": meta,
        "progreso": progreso,
        "xp_actual": xp_actual,
        "hechas": Answer.objects.filter(submission=sub).count(),
        "total": len(items),
    })


@require_POST
@login_required
def api_item_hint(request, pk, item_id):
    """Devuelve pista (si existe en datos.hint) para el ítem en modo play."""
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
    Devuelve un nombre “bonito” tanto si obj es Usuario como si es Docente (con .usuario).
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

    # Curso actual (toma la matrícula más reciente)
    matricula = (Matricula.objects
                 .select_related("curso")
                 .filter(estudiante=u)
                 .order_by("-fecha")
                 .first())

    curso_str = None
    if matricula and matricula.curso:
        c = matricula.curso
        # Si Curso.nivel es choice, usa display; si es int, muestra número:
        try:
            nivel_display = c.get_nivel_display()
        except Exception:
            nivel_display = f"{c.nivel}° Básico"
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