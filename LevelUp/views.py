# LevelUp/views.py
from __future__ import annotations
import json
from django.views.decorators.clickjacking import xframe_options_exempt
from django.shortcuts import render, redirect, get_object_or_404
from django.http import HttpResponse, Http404, HttpResponseForbidden, JsonResponse, HttpResponseBadRequest
from django.contrib import messages
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash, get_user_model
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import PasswordChangeForm
from django.urls import reverse
from django.utils import timezone
import time
from django.db import transaction, models, connection
from django.core.cache import cache
from django.db.models import Count, Q, Prefetch, ProtectedError, Max
from django.forms import inlineformset_factory, BaseInlineFormSet
from django import get_version as django_get_version
from django.views.decorators.http import require_POST
from django.templatetags.static import static
from django.contrib.staticfiles import finders
from django import forms

from .forms import RegistrationForm, LoginForm, ProfileForm, ActividadForm, ItemForm, CursoForm, AsignaturaForm, AsignacionDocenteForm, MatriculaForm
from .rewards import compute_rewards, apply_rewards


# Modelos
from .models import (
    Usuario, Asignatura, Estudiante, Docente, Actividad, AsignacionActividad,
    ItemActividad, Submission, Answer, Matricula,
    GrupoRefuerzoNivelAlumno, GrupoRefuerzoNivel, NIVELES, Curso, AsignacionDocente
    # Si tienes este modelo en tu app:
    # AsignacionDocente,
)

User = get_user_model()

# -------------------------------------------------------------------
# Helpers de rol
# -------------------------------------------------------------------
def es_docente(user) -> bool:
    return getattr(user, "rol", None) == Usuario.Rol.DOCENTE

def es_estudiante(user) -> bool:
    return getattr(user, "rol", None) == Usuario.Rol.ESTUDIANTE

# -------------------------------------------------------------------
# Home pública (sin login)
# -------------------------------------------------------------------
def home(request):
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
    return render(request, "LevelUp/gamificacion/ranking.html", {"estudiantes_top": estudiantes_top})

@login_required
def reportes_docente_view(request):
    total_estudiantes = Estudiante.objects.count()
    total_actividades = Actividad.objects.count()
    return render(request, "LevelUp/reportes_docente.html", {
        "total_estudiantes": total_estudiantes,
        "total_actividades": total_actividades
    })

# -------------------------------------------------------------------
# Auth
# -------------------------------------------------------------------
def register_view(request):
    if request.method == "POST":
        form = RegistrationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            messages.success(request, "¡Cuenta creada con éxito! Bienvenido/a a LevelUp.")
            return redirect("dashboard")
        messages.error(request, "Por favor corrige los errores del formulario.")
    else:
        form = RegistrationForm()
    return render(request, "LevelUp/auth/register.html", {"form": form})

def login_view(request):
    if request.user.is_authenticated:
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
                return redirect("dashboard")
            messages.error(request, "Credenciales inválidas. Verifica tu email y contraseña.")
    else:
        form = LoginForm()
    return render(request, "LevelUp/auth/login.html", {"form": form})

@login_required
def logout_view(request):
    logout(request)
    return redirect("login")

# -------------------------------------------------------------------
# Portal por rol (/inicio/)
# -------------------------------------------------------------------
@login_required(login_url='login')
def home_view(request):
    """
    Enruta a una plantilla distinta según el rol del usuario
    y arma el contexto básico de cada portal.
    """
    rol = getattr(request.user, "rol", None)
    if request.user.is_superuser:
        rol = Usuario.Rol.ADMINISTRADOR

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
        # --- KPIs ---
        alumnos = User.objects.filter(rol=Usuario.Rol.ESTUDIANTE).count()
        profesores = User.objects.filter(rol=Usuario.Rol.DOCENTE).count()
        cursos = Curso.objects.count()
        asignaturas = Asignatura.objects.count()

        # --- Salud del sistema (real) ---
        # Servidor
        server_ok = True  # si llegamos aquí, el servidor respondió
        server_time = timezone.now()
        server_version = django_get_version()

        # DB
        db_ok = False
        db_vendor = connection.vendor
        db_name = connection.settings_dict.get("NAME", "")
        try:
            with connection.cursor() as cur:
                cur.execute("SELECT 1")
            db_ok = True
        except Exception:
            db_ok = False

        # Cache (latencia simple set/get)
        cache_ok = False
        cache_backend = f"{cache.__class__.__module__}.{cache.__class__.__name__}"
        t0 = time.perf_counter()
        try:
            _k = "healthcheck_key"
            cache.set(_k, "ok", 5)
            got = cache.get(_k)
            cache_ok = (got == "ok")
        except Exception:
            cache_ok = False
        latency_ms = int((time.perf_counter() - t0) * 1000)

        ctx.update({
            "alumnos_total": alumnos,
            "profesores_total": profesores,
            "cursos_total": cursos,
            "asignaturas_total": asignaturas,

            "health": {
                "server": {"ok": server_ok, "time": server_time, "version": server_version},
                "db": {"ok": db_ok, "vendor": db_vendor, "name": db_name},
                "cache": {"ok": cache_ok, "backend": cache_backend, "latency_ms": latency_ms},
            },
            "cursos_list": Curso.objects.only("id", "nivel", "letra").order_by("nivel", "letra"),
        })

    template = template_by_role.get(rol, "LevelUp/portal/estudiante.html")
    return render(request, template, ctx)

# -------------------------------------------------------------------
# Perfil
# -------------------------------------------------------------------
@login_required
def perfil_view(request):
    return render(request, "LevelUp/perfil/ver.html", {"user_obj": request.user})

@login_required
def perfil_editar_view(request):
    if request.method == "POST":
        form = ProfileForm(request.POST, instance=request.user)
        if form.is_valid():
            form.save()
            messages.success(request, "Perfil actualizado correctamente.")
            return redirect("perfil")
        messages.error(request, "Revisa los campos del formulario.")
    else:
        form = ProfileForm(instance=request.user)
    return render(request, "LevelUp/perfil/editar.html", {"form": form})

@login_required
def cambiar_password_view(request):
    if request.method == "POST":
        form = PasswordChangeForm(user=request.user, data=request.POST)
        if form.is_valid():
            user = form.save()
            update_session_auth_hash(request, user)
            messages.success(request, "Tu contraseña fue actualizada.")
            return redirect("perfil")
        messages.error(request, "Corrige los errores e inténtalo nuevamente.")
    else:
        form = PasswordChangeForm(user=request.user)
    return render(request, "LevelUp/perfil/cambiar_password.html", {"form": form})

# ===================================================================
# Funciones de administración 
# ===================================================================

# ---------- Decorador ----------
def admin_required(viewfunc):
    @login_required
    def _wrapped(request, *args, **kwargs):
        if request.user.is_superuser or getattr(request.user, "rol", None) == Usuario.Rol.ADMINISTRADOR:
            return viewfunc(request, *args, **kwargs)
        messages.error(request, "No tienes permisos para esta sección.")
        return redirect("dashboard")
    return _wrapped

# ---------- CURSOS ----------
@admin_required
def adm_cursos_lista(request):
    cursos = Curso.objects.all().order_by("nivel", "letra")
    return render(request, "LevelUp/admin/lista_cursos.html", {"cursos": cursos})

@admin_required
def adm_cursos_nuevo(request):
    form = CursoForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        form.save()
        messages.success(request, "Curso creado.")
        return redirect("adm_cursos_lista")
    return render(request, "LevelUp/admin/admin_form.html", {"form": form, "titulo": "Nuevo curso", "post_url": reverse("adm_cursos_nuevo")})

@admin_required
def adm_cursos_editar(request, pk):
    curso = get_object_or_404(Curso, pk=pk)
    # Para edición, evitamos el "duplicado" contra sí mismo:
    class CursoEditForm(CursoForm):
        def clean(self):
            data = super().clean()
            if Curso.objects.exclude(pk=curso.pk).filter(nivel=data.get("nivel"), letra=data.get("letra")).exists():
                raise forms.ValidationError("Ese curso ya existe.")
            return data

    form = CursoEditForm(request.POST or None, instance=curso)
    if request.method == "POST" and form.is_valid():
        form.save()
        messages.success(request, "Curso actualizado.")
        return redirect("adm_cursos_lista")
    return render(request, "LevelUp/admin/admin_form.html", {
        "form": form, "titulo": "Editar curso", "post_url": reverse("adm_cursos_editar", args=[pk])
    })

@admin_required
def adm_cursos_borrar(request, pk):
    curso = get_object_or_404(Curso, pk=pk)
    try:
        curso.delete()
        messages.success(request, "Curso eliminado.")
    except ProtectedError:
        messages.error(request, "No se puede eliminar: el curso tiene matrículas u otros registros asociados.")
    return redirect("adm_cursos_lista")

# ---------- ASIGNATURAS ----------
@admin_required
def adm_asignaturas_lista(request):
    asignaturas = Asignatura.objects.all().order_by("nombre")
    return render(request, "LevelUp/admin/lista_asignaturas.html", {"asignaturas": asignaturas})

@admin_required
def adm_asignaturas_nueva(request):
    form = AsignaturaForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        form.save()
        messages.success(request, "Asignatura creada.")
        return redirect("adm_asignaturas_lista")
    return render(request, "LevelUp/admin/admin_form.html", {"form": form, "titulo": "Nueva asignatura", "post_url": reverse("adm_asignaturas_nueva")})

@admin_required
def adm_asignaturas_editar(request, pk):
    asign = get_object_or_404(Asignatura, pk=pk)

    class AsignaturaEditForm(AsignaturaForm):
        def clean_codigo(self):
            c = (self.cleaned_data.get("codigo") or "").strip()
            if Asignatura.objects.exclude(pk=asign.pk).filter(codigo__iexact=c).exists():
                raise forms.ValidationError("Ya existe una asignatura con ese código.")
            return c

    form = AsignaturaEditForm(request.POST or None, instance=asign)
    if request.method == "POST" and form.is_valid():
        form.save()
        messages.success(request, "Asignatura actualizada.")
        return redirect("adm_asignaturas_lista")
    return render(request, "LevelUp/admin/admin_form.html", {
        "form": form, "titulo": "Editar asignatura", "post_url": reverse("adm_asignaturas_editar", args=[pk])
    })

@admin_required
def adm_asignaturas_borrar(request, pk):
    asign = get_object_or_404(Asignatura, pk=pk)
    try:
        asign.delete()
        messages.success(request, "Asignatura eliminada.")
    except ProtectedError:
        messages.error(request, "No se puede eliminar: hay actividades u otras referencias a esta asignatura.")
    return redirect("adm_asignaturas_lista")

# ---------- ASIGNACIÓN DOCENTE → ASIGNATURA ----------
@admin_required
def adm_asignaciones_lista(request):
    filas = (AsignacionDocente.objects
             .select_related("profesor", "asignatura")
             .order_by("asignatura__nombre", "profesor__last_name"))
    return render(request, "LevelUp/admin/docente_asignatura.html", {"asignaciones": filas})

@admin_required
def adm_asignaciones_nueva(request):
    form = AsignacionDocenteForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        form.save()
        messages.success(request, "Asignación creada.")
        return redirect("adm_asignaciones_lista")
    return render(request, "LevelUp/admin/admin_form.html", {"form": form, "titulo": "Asignar profesor → asignatura", "post_url": reverse("adm_asignaciones_nueva")})

@admin_required
def adm_asignaciones_borrar(request, pk):
    reg = get_object_or_404(AsignacionDocente, pk=pk)
    reg.delete()
    messages.success(request, "Asignación eliminada.")
    return redirect("adm_asignaciones_lista")

# ---------- MATRÍCULAS ----------
def adm_matriculas_lista(request):
    filas = (Matricula.objects
             .select_related("estudiante", "curso")
             .order_by("-fecha"))
    return render(request, "LevelUp/admin/lista_matriculas.html", {"filas": filas})

@admin_required
def adm_matriculas_nueva(request):
    form = MatriculaForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        form.save()
        messages.success(request, "Matrícula registrada.")
        return redirect("adm_matriculas_lista")
    return render(request, "LevelUp/admin/admin_form.html", {"form": form, "titulo": "Matricular alumno → curso", "post_url": reverse("adm_matriculas_nueva")})

@admin_required
def adm_matriculas_borrar(request, pk):
    m = get_object_or_404(Matricula, pk=pk)
    m.delete()
    messages.success(request, "Matrícula eliminada.")
    return redirect("adm_matriculas_lista")

# ---------- LISTADOS ----------
@admin_required
def adm_list_profesores(request):
    profesores = User.objects.filter(rol=Usuario.Rol.DOCENTE).order_by("last_name", "first_name")
    return render(request, "LevelUp/admin/lista_docentes.html", {"profesores": profesores})

@admin_required
def adm_list_alumnos(request):
    alumnos = (Estudiante.objects.select_related("usuario")
               .order_by("usuario__last_name", "usuario__first_name"))
    return render(request, "LevelUp/admin/lista_alumnos.html", {"alumnos": alumnos})

@admin_required
def adm_list_alumnos_por_curso(request):
    curso_id = request.GET.get("curso")
    cursos = Curso.objects.all().order_by("nivel", "letra")
    alumnos = []
    if curso_id:
        alumnos = (
            Estudiante.objects
            .filter(usuario__matriculas__curso_id=curso_id)  # <-- a través de Usuario
            .select_related("usuario")
            .order_by("usuario__last_name", "usuario__first_name")
            .distinct()
        )
    return render(request, "LevelUp/admin/lista_alumnos_por_curso.html", {
        "cursos": cursos,
        "alumnos": alumnos,
        "curso_id": int(curso_id or 0),
    })


# ===================================================================
# Flujo de Actividades (Docente y Estudiante)
# ===================================================================

@login_required
def actividades_docente_lista(request):
    if not es_docente(request.user):
        raise Http404
    docente = Docente.objects.filter(usuario=request.user).first()

    qs = (Actividad.objects.select_related("docente", "asignatura").order_by("-id"))
    if docente:
        qs = qs.filter(docente=docente)

    # Si tienes AsignacionDocente, puedes detectar asignatura del profe:
    # from .models import AsignacionDocente
    # rels = AsignacionDocente.objects.filter(profesor=request.user).select_related("asignatura")
    # asignatura_prof = rels.first().asignatura if rels.count() == 1 else None
    asignatura_prof = None
    if docente and getattr(docente, "asignatura", None):
        asignatura_prof = Asignatura.objects.filter(nombre__iexact=docente.asignatura.strip()).first()

    if asignatura_prof:
        qs = qs.filter(asignatura=asignatura_prof)

    return render(request, "LevelUp/actividades/docente_lista.html", {
        "actividades": qs,
        "asignatura_prof": asignatura_prof,
    })

# =====================================================
# Formset personalizado que pasa actividad_tipo al form
# =====================================================
class ItemInlineFormSet(BaseInlineFormSet):
    def __init__(self, *args, **kwargs):
        self.actividad_tipo = kwargs.pop('actividad_tipo', None)
        super().__init__(*args, **kwargs)

    def _construct_form(self, i, **kwargs):
        # PÁSALO como kwarg para que ItemForm lo lea en __init__
        kwargs.setdefault("actividad_tipo", self.actividad_tipo)
        return super()._construct_form(i, **kwargs)

    def clean(self):
        super().clean()
        for form in self.forms:
            if form.cleaned_data.get("DELETE"):
                form._errors.clear()


# Actualizar factory
ItemFormSet = inlineformset_factory(
    Actividad,
    ItemActividad,
    form=ItemForm,
    formset=ItemInlineFormSet,
    fields=("enunciado", "puntaje"),  # quitar "tipo"
    extra=0,
    can_delete=True,
)
# =====================================================
# CREAR ACTIVIDAD 
# =====================================================
def normalize_tipo(raw):
    """Normaliza 'juego' a 'game', mantiene 'quiz'"""
    if not raw:
        return "quiz"
    v = str(raw).lower().strip()
    return "game" if v in ("game", "juego") else "quiz"

@login_required
def actividad_crear(request):
    """
    VERSIÓN DEFINITIVA - Procesa ítems DIRECTAMENTE desde request.POST
    """
    if not es_docente(request.user):
        raise Http404
    
    docente = get_object_or_404(Docente, usuario=request.user)
    
    if request.method == "POST":
        form = ActividadForm(request.POST, request.FILES)
        
        print("\n" + "="*60)
        print(f"➕ CREAR ACTIVIDAD")
        print(f"   request.POST.get('items-TOTAL_FORMS'): {request.POST.get('items-TOTAL_FORMS')}")
        print("="*60)
        
        if form.is_valid():
            with transaction.atomic():
                # 1) Crear actividad
                act = form.save(commit=False)
                act.docente = docente
                if act.es_publicada and not act.fecha_publicacion:
                    act.fecha_publicacion = timezone.now()
                act.save()
                form.save_m2m()
                
                print(f"   ✅ Actividad creada (ID: {act.pk})")

                # 2) Procesar ítems DIRECTAMENTE desde request.POST
                items_guardados = 0
                
                total_forms_raw = request.POST.get("items-TOTAL_FORMS", "0")
                try:
                    total_forms = int(total_forms_raw)
                except:
                    total_forms = 0
                
                print(f"\n🔄 PROCESAMIENTO DIRECTO:")
                print(f"   TOTAL_FORMS: {total_forms}")
                
                for i in range(total_forms):
                    delete_raw = request.POST.get(f"items-{i}-DELETE", "")
                    enun = request.POST.get(f"items-{i}-enunciado", "").strip()
                    punt_raw = request.POST.get(f"items-{i}-puntaje", "").strip()
                    payload = request.POST.get(f"items-{i}-game_pairs", "").strip()
                    item_kind = request.POST.get(f"items-{i}-item_kind", "trivia").strip()
                    time_limit_raw = request.POST.get(f"items-{i}-game_time_limit", "")
                    
                    print(f"\n   📋 Form {i}:")
                    print(f"      enunciado: '{enun[:30]}...'")
                    print(f"      puntaje: '{punt_raw}'")
                    print(f"      payload: {len(payload)} chars")
                    
                    if delete_raw in ("1", "true", "True", "on"):
                        print(f"      ⏭️ Marcado DELETE, saltando")
                        continue
                    
                    try:
                        punt = int(punt_raw) if punt_raw else 0
                    except:
                        punt = 0
                    
                    try:
                        time_limit = int(time_limit_raw) if time_limit_raw else None
                    except:
                        time_limit = None
                    
                    tiene_contenido = bool(payload or enun or punt)
                    
                    if not tiene_contenido:
                        print(f"      ⏭️ Sin contenido, saltando")
                        continue
                    
                    print(f"      ✅ Tiene contenido, creando ítem...")
                    
                    try:
                        if payload:
                            import json
                            datos = json.loads(payload)
                        else:
                            datos = {"kind": item_kind, "questions": []}
                    except Exception as e:
                        print(f"         ⚠️ Error parseando JSON: {e}")
                        datos = {"kind": item_kind, "questions": []}
                    
                    if time_limit:
                        datos["timeLimit"] = time_limit
                    
                    max_orden = (ItemActividad.objects
                               .filter(actividad=act)
                               .aggregate(Max('orden'))['orden__max'] or 0)
                    
                    try:
                        item = ItemActividad.objects.create(
                            actividad=act,
                            enunciado=enun,
                            puntaje=punt,
                            datos=datos,
                            tipo="game",
                            orden=max_orden + 1
                        )
                        items_guardados += 1
                        print(f"         ✅ Ítem guardado (ID: {item.pk})")
                    except Exception as e:
                        print(f"         ❌ ERROR: {e}")

                # Asignaciones
                cursos_ids = [int(x) for x in request.POST.getlist("cursos") if str(x).strip()]
                alumnos_usuario_ids = [int(x) for x in request.POST.getlist("alumnos") if str(x).strip()]
                
                estudiantes_pks = set()
                
                if cursos_ids:
                    usuarios_de_cursos = Matricula.objects.filter(
                        curso_id__in=cursos_ids
                    ).values_list("estudiante_id", flat=True)
                    
                    est_from_cursos = Estudiante.objects.filter(
                        usuario_id__in=usuarios_de_cursos
                    ).values_list("pk", flat=True)
                    
                    estudiantes_pks.update(est_from_cursos)
                
                if alumnos_usuario_ids:
                    est_from_alumnos = Estudiante.objects.filter(
                        usuario_id__in=alumnos_usuario_ids
                    ).values_list("pk", flat=True)
                    
                    estudiantes_pks.update(est_from_alumnos)
                
                creadas = 0
                for est_pk in estudiantes_pks:
                    _, created = AsignacionActividad.objects.get_or_create(
                        actividad=act,
                        estudiante_id=est_pk
                    )
                    if created:
                        creadas += 1
                
                print(f"\n💾 RESUMEN:")
                print(f"   Ítems creados: {items_guardados}")
                print(f"   Asignaciones: {creadas}")
                
                if estudiantes_pks:
                    if creadas > 0:
                        messages.success(request, f"✅ Actividad '{act.titulo}' creada con {items_guardados} ítems y asignada a {creadas} estudiante(s).")
                    else:
                        messages.info(request, f"✅ Actividad '{act.titulo}' creada con {items_guardados} ítems.")
                else:
                    messages.success(request, f"✅ Actividad '{act.titulo}' creada con {items_guardados} ítems.")
            
            return redirect("docente_lista")
        else:
            print(f"\n❌ Form inválido: {form.errors}")
            messages.error(request, "Revisa los errores en el formulario.")
    else:
        form = ActividadForm()
        temp_act = Actividad(docente=docente)
        formset = ItemFormSet(
            instance=temp_act,
            prefix="items",
            actividad_tipo="quiz"
        )
    
    ctx = {
        "form": form,
        "formset": formset,
        "editar": False,
        "cursos": Curso.objects.all().order_by("nivel", "letra"),
        "estudiantes": Estudiante.objects.select_related("usuario").order_by("usuario__first_name"),
        "cursos_asignados": set(),
        "asignados_usuarios": set(),
        "abrir_asignar": False,
    }
    return render(request, "LevelUp/actividades/actividad_form.html", ctx)

# =====================================================
# EDITAR ACTIVIDAD 
# =====================================================
@login_required
def actividad_editar(request, pk):
    """
    VERSIÓN DEFINITIVA - Procesa ítems DIRECTAMENTE desde request.POST
    sin depender del sistema de validación de Django formsets
    """
    if not es_docente(request.user):
        raise Http404

    docente = get_object_or_404(Docente, usuario=request.user)
    act = get_object_or_404(Actividad, pk=pk, docente=docente)

    # Cargar TODOS los ítems existentes
    qs_items = ItemActividad.objects.filter(actividad=act).order_by("orden", "id")
    items_iniciales = qs_items.count()

    if request.method == "POST":
        form = ActividadForm(request.POST, request.FILES, instance=act)
        tipo_norm = normalize_tipo(request.POST.get("tipo", act.tipo))

        formset = ItemFormSet(
            request.POST,
            request.FILES,
            instance=act,
            prefix="items",
            queryset=qs_items,
            actividad_tipo=tipo_norm,
        )
        
        # 🔍 DEBUG INICIAL
        print("\n" + "="*60)
        print(f"✏️ EDITAR ACTIVIDAD #{pk}")
        print(f"   Ítems iniciales en BD: {items_iniciales}")
        print(f"   request.POST.get('items-TOTAL_FORMS'): {request.POST.get('items-TOTAL_FORMS')}")
        print("="*60)

        # Validar solo el form principal (actividad)
        if form.is_valid():
            # NO validamos el formset, lo procesamos manualmente
            with transaction.atomic():
                # 1) Guardar actividad
                obj = form.save(commit=False)
                obj.docente = docente
                if obj.es_publicada and not obj.fecha_publicacion:
                    obj.fecha_publicacion = timezone.now()
                obj.save()
                form.save_m2m()

                # 2) Procesar ítems DIRECTAMENTE desde request.POST
                items_guardados = 0
                items_actualizados = 0
                items_nuevos = 0
                items_eliminados = 0
                
                # Obtener TOTAL_FORMS del POST
                total_forms_raw = request.POST.get("items-TOTAL_FORMS", "0")
                try:
                    total_forms = int(total_forms_raw)
                except:
                    total_forms = 0
                
                print(f"\n🔄 PROCESAMIENTO DIRECTO desde POST:")
                print(f"   TOTAL_FORMS: {total_forms}")
                print(f"   Ítems actuales en BD: {ItemActividad.objects.filter(actividad=obj).count()}")
                
                for i in range(total_forms):
                    # Leer datos DIRECTOS del POST
                    item_id_raw = request.POST.get(f"items-{i}-id", "").strip()
                    delete_raw = request.POST.get(f"items-{i}-DELETE", "")
                    enun = request.POST.get(f"items-{i}-enunciado", "").strip()
                    punt_raw = request.POST.get(f"items-{i}-puntaje", "").strip()
                    payload = request.POST.get(f"items-{i}-game_pairs", "").strip()
                    item_kind = request.POST.get(f"items-{i}-item_kind", "trivia").strip()
                    time_limit_raw = request.POST.get(f"items-{i}-game_time_limit", "")
                    
                    print(f"\n   📋 Form {i}:")
                    print(f"      items-{i}-id: '{item_id_raw}'")
                    print(f"      items-{i}-DELETE: '{delete_raw}'")
                    print(f"      items-{i}-enunciado: '{enun[:30]}...'")
                    print(f"      items-{i}-puntaje: '{punt_raw}'")
                    print(f"      items-{i}-game_pairs: {len(payload)} chars")
                    
                    # Parsear valores
                    try:
                        item_id = int(item_id_raw) if item_id_raw and item_id_raw not in ("", "None", "none") else None
                    except:
                        item_id = None
                    
                    try:
                        punt = int(punt_raw) if punt_raw else 0
                    except:
                        punt = 0
                    
                    try:
                        time_limit = int(time_limit_raw) if time_limit_raw else None
                    except:
                        time_limit = None
                    
                    # Verificar DELETE
                    if delete_raw in ("1", "true", "True", "on"):
                        if item_id:
                            try:
                                ItemActividad.objects.filter(pk=item_id, actividad=obj).delete()
                                items_eliminados += 1
                                print(f"      🗑️ ELIMINADO (ID={item_id})")
                            except Exception as e:
                                print(f"      ⚠️ Error eliminando ID={item_id}: {e}")
                        else:
                            print(f"      ⏭️ DELETE sin ID, saltando")
                        continue
                    
                    # Verificar contenido
                    tiene_contenido = bool(payload or enun or punt)
                    
                    if not tiene_contenido:
                        print(f"      ⏭️ Sin contenido, saltando")
                        continue
                    
                    print(f"      ✅ Tiene contenido, procesando...")
                    
                    # Parsear datos JSON
                    try:
                        if payload:
                            import json
                            datos = json.loads(payload)
                            print(f"         JSON parseado: kind={datos.get('kind')}")
                        else:
                            datos = {"kind": item_kind, "questions": []}
                            print(f"         JSON default: kind={item_kind}")
                    except Exception as e:
                        print(f"         ⚠️ Error parseando JSON: {e}")
                        datos = {"kind": item_kind, "questions": []}
                    
                    # Agregar time_limit si existe
                    if time_limit:
                        datos["timeLimit"] = time_limit
                    
                    # GUARDAR o ACTUALIZAR
                    if item_id:
                        # ACTUALIZAR existente
                        try:
                            item = ItemActividad.objects.get(pk=item_id, actividad=obj)
                            item.enunciado = enun
                            item.puntaje = punt
                            item.datos = datos
                            item.tipo = "game"
                            item.save()
                            items_actualizados += 1
                            items_guardados += 1
                            print(f"         ✅ ACTUALIZADO (ID: {item_id})")
                        except ItemActividad.DoesNotExist:
                            print(f"         ⚠️ ID {item_id} no encontrado en BD")
                            item_id = None
                    
                    if not item_id:
                        # CREAR nuevo
                        max_orden = (ItemActividad.objects
                                   .filter(actividad=obj)
                                   .aggregate(Max('orden'))['orden__max'] or 0)
                        
                        print(f"         🆕 Creando nuevo ítem (orden={max_orden + 1})...")
                        
                        try:
                            item = ItemActividad.objects.create(
                                actividad=obj,
                                enunciado=enun,
                                puntaje=punt,
                                datos=datos,
                                tipo="game",
                                orden=max_orden + 1
                            )
                            items_nuevos += 1
                            items_guardados += 1
                            print(f"         ✅ NUEVO guardado (ID: {item.pk}, orden: {item.orden})")
                        except Exception as e:
                            print(f"         ❌ ERROR creando ítem: {e}")
                            import traceback
                            traceback.print_exc()

                # Mensaje de éxito
                msg_parts = [f"Actividad '{obj.titulo}' actualizada"]
                if items_nuevos > 0:
                    msg_parts.append(f"{items_nuevos} ítem(s) nuevo(s)")
                if items_actualizados > 0:
                    msg_parts.append(f"{items_actualizados} actualizado(s)")
                if items_eliminados > 0:
                    msg_parts.append(f"{items_eliminados} eliminado(s)")
                
                messages.success(request, "✅ " + ", ".join(msg_parts) + ".")
                
                print(f"\n💾 RESUMEN FINAL:")
                print(f"   Total guardados: {items_guardados}")
                print(f"   Nuevos: {items_nuevos}")
                print(f"   Actualizados: {items_actualizados}")
                print(f"   Eliminados: {items_eliminados}")
                print(f"   Ítems finales en BD: {ItemActividad.objects.filter(actividad=obj).count()}")
            
            return redirect("docente_lista")

        else:
            print(f"\n❌ Form de actividad inválido:")
            print(f"   Errores: {form.errors}")
            messages.error(request, "Revisa los errores en los datos de la actividad.")
    else:
        # GET request
        form = ActividadForm(instance=act)
        formset = ItemFormSet(
            instance=act,
            prefix="items",
            queryset=qs_items,
            actividad_tipo=act.tipo,
        )

    # Asignaciones actuales
    est_ids_asignados = set(
        AsignacionActividad.objects.filter(actividad=act).values_list("estudiante_id", flat=True)
    )
    asignados_usuarios = set(
        Estudiante.objects.filter(pk__in=est_ids_asignados).values_list("usuario_id", flat=True)
    )
    cursos_asignados = set(
        Matricula.objects.filter(estudiante_id__in=asignados_usuarios).values_list("curso_id", flat=True)
    )

    ctx = {
        "form": form,
        "formset": formset,
        "editar": True,
        "act": act,
        "abrir_asignar": request.GET.get("open") == "asignar",
        "cursos": Curso.objects.all().order_by("nivel", "letra"),
        "estudiantes": Estudiante.objects.select_related("usuario").order_by("usuario__first_name"),
        "cursos_asignados": cursos_asignados,
        "asignados_usuarios": asignados_usuarios,
    }
    return render(request, "LevelUp/actividades/actividad_form.html", ctx)

# =====================================================
# ELIMINAR ÍTEM ACTIVIDAD
# =====================================================

@login_required
@require_POST
def item_eliminar_ajax(request, item_id):
    """Elimina un ítem vía AJAX"""
    if not es_docente(request.user):
        return JsonResponse({"ok": False, "error": "No autorizado"}, status=403)
    
    try:
        item = get_object_or_404(ItemActividad, pk=item_id)
        actividad = item.actividad
        actividad_id = actividad.pk
        
        # Verificar que el docente sea el dueño
        if actividad.docente.usuario != request.user:
            return JsonResponse({"ok": False, "error": "No autorizado"}, status=403)
        
        items_antes = ItemActividad.objects.filter(actividad=actividad).count()
        item_pk = item.pk
        item.delete()
        items_despues = ItemActividad.objects.filter(actividad=actividad).count()
        
        print(f"✅ Ítem #{item_pk} eliminado vía AJAX")
        print(f"   Actividad #{actividad_id}: {items_antes} → {items_despues} ítems")
        
        return JsonResponse({
            "ok": True,
            "message": "Ítem eliminado correctamente",
            "item_id": item_pk,
            "total_items": items_despues
        })
        
    except Exception as e:
        print(f"❌ Error eliminando ítem: {e}")
        import traceback
        traceback.print_exc()
        return JsonResponse({"ok": False, "error": str(e)}, status=500)

@login_required
def actividad_eliminar(request, pk):
    a = get_object_or_404(Actividad, pk=pk)

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
        return redirect("docente_lista")

    return render(request, "LevelUp/actividades/confirmar_eliminar.html", {"a": a})

# -----------------------
# Helpers de corrección (estudiante)
# -----------------------
def _post_bool(v):
    return str(v).lower() in ("true", "1", "on", "si", "sí")

def _grade_game(item, POST):
    base = f"item_{item.pk}"
    done = _post_bool(POST.get(f"{base}_completado", True))
    try:
        ratio = float(POST.get(f"{base}_score", ""))
    except Exception:
        ratio = 1.0 if done else 0.0
    ratio = max(0.0, min(1.0, ratio))

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

    payload = {"completado": done, "score": ratio, "kind": (item.datos or {}).get("kind")}
    if detail is not None: payload["detail"] = detail
    if corr   is not None: payload["correctas"] = corr
    if tot    is not None: payload["total"] = tot

    return (ratio >= 1.0), payload, ratio

# -----------------------
# Estudiante
# -----------------------
@login_required
def estudiante_mis_actividades(request):
    if not es_estudiante(request.user):
        raise Http404
    
    estudiante = get_object_or_404(Estudiante, usuario=request.user)
    
    print(f"🔍 Buscando actividades para: {request.user.username}")
    print(f"   Estudiante.pk: {estudiante.pk}")
    print(f"   Usuario.id: {request.user.id}")

    # ⚠️ CRÍTICO: Filtrar por estudiante.pk (no por usuario)
    act_qs = (
        Actividad.objects
        .filter(
            es_publicada=True,
            asignacionactividad__estudiante_id=estudiante.pk  # <-- Usar .pk directamente
        )
        .distinct()
        .select_related('docente', 'asignatura')
        .order_by("-fecha_publicacion", "-id")
    )
    
    total_actividades = act_qs.count()
    print(f"   ✅ Actividades encontradas: {total_actividades}")
    
    for act in act_qs:
        print(f"      - {act.titulo} (ID: {act.id})")

    # Contar intentos por actividad
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

    # Intentos personalizados
    overrides = (
        AsignacionActividad.objects
        .filter(estudiante=estudiante, actividad__in=act_qs)
        .values("actividad_id", "intentos_permitidos")
    )
    ov_map = {
        r["actividad_id"]: r["intentos_permitidos"] 
        for r in overrides 
        if r["intentos_permitidos"]
    }

    now = timezone.now()
    rows, grupos = [], {}
    
    for a in act_qs:
        c = counts_map.get(a.id, {"total": 0, "abiertos": 0, "finalizados": 0})
        usados = int(c["total"])
        abiertos = int(c["abiertos"])
        finalizados = int(c["finalizados"])
        
        cerrada = bool(a.fecha_cierre and now > a.fecha_cierre)
        max_for_student = ov_map.get(a.id) or (a.intentos_max or 1)
        puede_intentar = (not cerrada) and (usados < max_for_student)
        tiene_abierto = abiertos > 0
        tiene_resultados = finalizados > 0

        # Obtener nombre de asignatura
        try:
            if a.asignatura:
                asignatura_nombre = a.asignatura.nombre
            elif a.docente and hasattr(a.docente, 'asignatura'):
                asignatura_nombre = a.docente.asignatura
            else:
                asignatura_nombre = "Otras actividades"
        except Exception:
            asignatura_nombre = "Otras actividades"

        row = {
            "a": a, 
            "usados": usados, 
            "max": max_for_student,
            "tiene_abierto": tiene_abierto, 
            "puede_intentar": puede_intentar,
            "tiene_resultados": tiene_resultados, 
            "cerrada": cerrada,
            "asignatura": asignatura_nombre,
        }
        
        rows.append(row)
        grupos.setdefault(asignatura_nombre, []).append(row)

    print(f"\n📊 Resumen:")
    print(f"   Total rows: {len(rows)}")
    print(f"   Grupos: {list(grupos.keys())}")

    return render(
        request,
        "LevelUp/actividades/estudiante_lista.html",
        {
            "rows": rows, 
            "actividades": [r["a"] for r in rows],
            "grupos": [{"asignatura": k, "rows": v} for k, v in grupos.items()]
        }
    )

@login_required
def actividad_resolver(request, pk):
    return redirect("resolver_play", pk=pk)

def _letra(i):
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

    intento_qs = Submission.objects.filter(
        actividad=act, estudiante=estudiante, finalizado=True
    ).order_by("-intento", "-id")

    if not intento_qs.exists():
        if Submission.objects.filter(actividad=act, estudiante=estudiante, finalizado=False).exists():
            return redirect("resolver_play", pk=act.pk)
        messages.info(request, "Aún no has enviado esta actividad.")
        return redirect("resolver_play", pk=act.pk)

    intento_param = request.GET.get("intento")
    if intento_param and str(intento_param).isdigit():
        sub = intento_qs.filter(intento=int(intento_param)).first() or intento_qs.first()
    else:
        sub = intento_qs.first()

    items_data = []
    for item in act.items.all():  # requiere related_name="items" en ItemActividad
        tipo = (item.tipo or "").lower()
        ans = Answer.objects.filter(submission=sub, item=item).first()
        respuesta = ans.respuesta if ans else {}
        correcto = bool(getattr(ans, "es_correcta", False)) if ans else False

        detalle = {
            "tipo": tipo, "correcto": correcto,
            "puntaje": item.puntaje, "obtenido": getattr(ans, "puntaje_obtenido", 0) if ans else 0,
        }

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
                "completado": comp, "score": score, "correctas": corr, "total": tot,
                "incorrectas": inc, "kind": respuesta.get("kind"), "detail": respuesta.get("detail"),
            })
        else:
            detalle.update({"respuesta": respuesta})

        items_data.append({"item": item, "detalle": detalle})

    intentos_usados = Submission.objects.filter(actividad=act, estudiante=estudiante).count()
    intentos_max = act.intentos_max
    now = timezone.now()
    puede_reintentar = act.es_publicada and (not act.fecha_cierre or now <= act.fecha_cierre) and intentos_usados < intentos_max

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

# =====================================================
# ESTUDIANTE: Jugar actividad (corregido)
# =====================================================
@login_required
def actividad_play(request, pk):
    """Vista de juego con diagnóstico completo"""
    if not es_estudiante(request.user):
        raise Http404
    
    estudiante = get_object_or_404(Estudiante, usuario=request.user)
    act = get_object_or_404(Actividad, pk=pk, es_publicada=True)
    
    print(f"\n{'='*60}")
    print(f"🎮 ACTIVIDAD PLAY - ID: {pk}")
    print(f"{'='*60}")
    print(f"👤 Usuario: {request.user.username}")
    print(f"🎯 Actividad: {act.titulo}")
    print(f"📋 Tipo: {act.tipo}")
    
    # Verificar asignación
    tiene_asignacion = AsignacionActividad.objects.filter(
        estudiante=estudiante, 
        actividad=act
    ).exists()
    
    print(f"✅ Tiene asignación: {tiene_asignacion}")
    
    if not tiene_asignacion:
        print(f"❌ No tiene asignación, redirigiendo")
        messages.error(request, "No tienes acceso a esta actividad.")
        return redirect("estudiante_lista")
    
    # Verificar cierre
    now = timezone.now()
    esta_cerrada = bool(act.fecha_cierre and now > act.fecha_cierre)
    print(f"🔒 Fecha cierre: {act.fecha_cierre}")
    print(f"🕐 Ahora: {now}")
    print(f"❌ Cerrada: {esta_cerrada}")
    
    if esta_cerrada:
        messages.warning(request, "La actividad está cerrada.")
        return redirect("estudiante_lista")
    
    # Intentos
    intentos_usados = Submission.objects.filter(
        actividad=act, 
        estudiante=estudiante
    ).count()
    intentos_max = act.intentos_max or 1
    
    print(f"🔢 Intentos: {intentos_usados}/{intentos_max}")
    
    # Buscar submission abierto
    sub = (Submission.objects
           .filter(actividad=act, estudiante=estudiante, finalizado=False)
           .order_by("-intento").first())
    
    print(f"📝 Submission existente: {sub is not None}")
    
    if not sub:
        if intentos_usados >= intentos_max:
            print(f"❌ Sin intentos disponibles")
            messages.info(request, "Ya no tienes intentos disponibles.")
            return redirect("resolver_resultado", pk=act.pk)
        
        sub = Submission.objects.create(
            actividad=act,
            estudiante=estudiante,
            intento=intentos_usados + 1
        )
        print(f"✅ Nuevo submission creado: ID {sub.pk}")
    
    print(f"\n📦 PROCESANDO ÍTEMS:")
    print(f"{'='*60}")
    
    # === DECISIÓN DE TEMPLATE SEGÚN TIPO ===
    if act.tipo == "game":
        # MISIÓN: Redirigir al motor de videojuego
        print(f"🎮 Tipo GAME (misión) - Redirigiendo al motor")
        return redirect(f"{reverse('misiones_jugar', args=['bosque', 1])}?actividad={act.pk}")
    
    else:
        # QUIZ: Cargar ítems de minijuegos y usar play.html con loader
        items_qs = act.items.filter(tipo="game").order_by("orden", "id")
        total_items = items_qs.count()
        
        print(f"📊 Total ítems tipo game: {total_items}")
        
        # Serializar items con sus datos JSON
        items = []
        for idx, item in enumerate(items_qs, 1):
            print(f"\n  📋 Ítem {idx}/{total_items}:")
            print(f"     • ID: {item.id}")
            print(f"     • Orden: {item.orden}")
            print(f"     • Tipo: {item.tipo}")
            print(f"     • Enunciado: {item.enunciado[:50]}...")
            print(f"     • Puntaje: {item.puntaje}")
            
            # Obtener datos del ítem
            datos = item.datos or {}
            kind = datos.get('kind', 'trivia')
            
            print(f"     • Kind: {kind}")
            print(f"     • Keys en datos: {list(datos.keys())}")
            
            # Diagnóstico específico por tipo
            if kind == 'trivia':
                questions = datos.get('questions', [])
                trivia = datos.get('trivia', [])
                print(f"     • questions: {len(questions) if isinstance(questions, list) else 'NO ES LISTA'}")
                print(f"     • trivia: {len(trivia) if isinstance(trivia, list) else 'NO ES LISTA'}")
                
                if questions:
                    print(f"     • Primera question: {questions[0]}")
                if trivia:
                    print(f"     • Primera trivia: {trivia[0]}")
                    
            elif kind in ('memory', 'dragmatch'):
                pairs = datos.get('pairs', [])
                print(f"     • pairs: {len(pairs) if isinstance(pairs, list) else 'NO ES LISTA'}")
                if pairs:
                    print(f"     • Primer par: {pairs[0]}")
                    
            elif kind == 'ordering':
                items_data = datos.get('items', [])
                correct = datos.get('correct_order', [])
                print(f"     • items: {len(items_data) if isinstance(items_data, list) else 'NO ES LISTA'}")
                print(f"     • correct_order: {len(correct) if isinstance(correct, list) else 'NO ES LISTA'}")
                
            elif kind == 'classify':
                bins = datos.get('bins', [])
                items_data = datos.get('items', [])
                answers = datos.get('answers', {})
                print(f"     • bins: {len(bins) if isinstance(bins, list) else 'NO ES LISTA'}")
                print(f"     • items: {len(items_data) if isinstance(items_data, list) else 'NO ES LISTA'}")
                print(f"     • answers: {len(answers) if isinstance(answers, dict) else 'NO ES DICT'}")
            
            # Preparar JSON para el template
            try:
                datos_json = json.dumps(datos, ensure_ascii=False, indent=2)
                print(f"     ✅ JSON serializado OK ({len(datos_json)} chars)")
            except Exception as e:
                print(f"     ❌ Error serializando JSON: {e}")
                datos_json = json.dumps({"kind": kind, "error": str(e)})
            
            items.append({
                "id": item.id,
                "tipo": item.tipo,
                "enunciado": item.enunciado,
                "datos": datos,
                "datos_json": datos_json,
                "puntaje": item.puntaje
            })
        
        print(f"\n{'='*60}")
        print(f"✅ Procesamiento completo: {len(items)} ítems serializados")
        print(f"{'='*60}\n")
        
        ctx = {
            "actividad": act,
            "submission": sub,
            "items": items,
            "total_items": len(items),
            "xp_total": act.xp_total or 0,
            "intento_actual": sub.intento,
            "intentos_max": intentos_max,
        }
        
        return render(request, "LevelUp/actividades/play.html", ctx)
    
@login_required
@require_POST
def api_item_answer(request, pk, item_id):
    """
    API para guardar respuesta de un ítem individual
    """
    print(f"\n{'='*60}")
    print(f"📥 API ANSWER - Actividad: {pk}, Item: {item_id}")
    print(f"{'='*60}")
    
    try:
        body = json.loads(request.body.decode("utf-8"))
        print(f"📦 Body recibido: {body}")
    except Exception as e:
        print(f"❌ Error parseando body: {e}")
        return HttpResponseBadRequest("JSON inválido")

    payload = body.get("payload") or {}
    meta = payload.get("meta") or {}
    completado = bool(payload.get("completado"))
    kind = (payload.get("kind") or "").lower()
    
    print(f"📋 Payload procesado:")
    print(f"   • completado: {completado}")
    print(f"   • kind: {kind}")
    print(f"   • meta: {meta}")

    actividad = get_object_or_404(Actividad, pk=pk)
    estudiante = get_object_or_404(Estudiante, usuario=request.user)
    
    print(f"✅ Actividad: {actividad.titulo}")
    print(f"✅ Estudiante: {estudiante.usuario.username}")

    # Buscar o crear submission
    sub = Submission.objects.filter(
        actividad=actividad,
        estudiante=estudiante,
        finalizado=False
    ).order_by('-intento').first()
    
    if not sub:
        # Crear nuevo submission
        intentos_count = Submission.objects.filter(
            actividad=actividad,
            estudiante=estudiante
        ).count()
        
        sub = Submission.objects.create(
            actividad=actividad,
            estudiante=estudiante,
            intento=intentos_count + 1,
            started_at=timezone.now()
        )
        print(f"✅ Nuevo submission creado: #{sub.pk}")
    else:
        print(f"✅ Submission existente: #{sub.pk}")

    # Si item_id == 0, es señal de finalizar
    if item_id == 0 or str(item_id) == "0":
        print(f"🏁 Finalizando submission...")
        sub.finalizado = True
        sub.finished_at = timezone.now()
        sub.save()
        print(f"✅ Submission finalizado")
        return JsonResponse({"ok": True, "message": "Intento finalizado"})

    # Buscar el item
    try:
        item = ItemActividad.objects.get(pk=item_id, actividad=actividad)
        print(f"✅ Item encontrado: {item.enunciado[:30]}...")
    except ItemActividad.DoesNotExist:
        print(f"❌ Item no encontrado")
        return JsonResponse({"ok": False, "error": "Item no encontrado"}, status=404)

    # Crear o actualizar Answer
    answer, created = Answer.objects.get_or_create(
        submission=sub,
        item=item,
        defaults={
            'respuesta': payload,
            'es_correcta': completado,
            'puntaje_obtenido': meta.get('correctas', 0) * 10
        }
    )
    
    if not created:
        # Actualizar existente
        answer.respuesta = payload
        answer.es_correcta = completado
        answer.puntaje_obtenido = meta.get('correctas', 0) * 10
        answer.save()
        print(f"✅ Answer actualizado: #{answer.pk}")
    else:
        print(f"✅ Answer creado: #{answer.pk}")

    # Actualizar score del submission
    total_correctas = meta.get('correctas', 0)
    total_incorrectas = meta.get('misses', 0)
    
    if hasattr(sub, 'score'):
        sub.score = (sub.score or 0) + (total_correctas * 10)
    if hasattr(sub, 'correctas'):
        sub.correctas = (sub.correctas or 0) + total_correctas
    if hasattr(sub, 'incorrectas'):
        sub.incorrectas = (sub.incorrectas or 0) + total_incorrectas
    
    sub.finished_at = timezone.now()
    sub.save()
    
    print(f"✅ Submission actualizado: score={getattr(sub, 'score', 'N/A')}")

    # Calcular recompensas
    outcome = compute_rewards(meta)
    res = apply_rewards(estudiante, outcome)

    print(f"🎁 Recompensas aplicadas: XP={outcome.xp}, Coins={outcome.coins}")
    print(f"{'='*60}\n")

    return JsonResponse({
        "ok": True,
        "submission_id": sub.id,
        "answer_id": answer.id,
        "reward": {
            "xp": outcome.xp, 
            "coins": outcome.coins, 
            "unlocks": outcome.unlocks, 
            **res
        },
    })

@require_POST
@login_required
def api_item_hint(request, pk, item_id):
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
# Portal estudiante (info curso y docentes de refuerzo)
# -------------------------------------------------------------------
def _nombre_docente(obj):
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

    matricula = (Matricula.objects.select_related("curso").filter(estudiante=u).order_by("-fecha").first())

    curso_str = None
    if matricula and matricula.curso:
        c = matricula.curso
        try:
            nivel_display = c.get_nivel_display()
        except Exception:
            nivel_display = f"{c.nivel}° Básico"
        curso_str = f'{nivel_display} {c.letra}'

    docente_matematicas = None
    docente_ingles = None

    gr_alum = (GrupoRefuerzoNivelAlumno.objects.select_related("grupo").filter(alumno=u).first())
    if gr_alum and gr_alum.grupo:
        g = gr_alum.grupo
        dm = getattr(g, "docente_matematicas", None) or getattr(g, "profesor_matematicas", None)
        di = getattr(g, "docente_ingles", None) or getattr(g, "profesor_ingles", None)
        docente_matematicas = _nombre_docente(dm)
        docente_ingles = _nombre_docente(di)

    if (not docente_matematicas or not docente_ingles) and matricula and matricula.curso:
        g = GrupoRefuerzoNivel.objects.filter(nivel=matricula.curso.nivel).first()
        if g:
            dm = getattr(g, "docente_matematicas", None) or getattr(g, "profesor_matematicas", None)
            di = getattr(g, "docente_ingles", None) or getattr(g, "profesor_ingles", None)
            if not docente_matematicas:
                docente_matematicas = _nombre_docente(dm)
            if not docente_ingles:
                docente_ingles = _nombre_docente(di)

    context = {"curso": curso_str, "docente_matematicas": docente_matematicas, "docente_ingles": docente_ingles}
    return render(request, "LevelUp/estudiante_portal.html", context)

# =============================================================
# Misiones
# =============================================================
def _load_static_map(path):
    try:
        real = finders.find(path)
        if real:
            with open(real, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return {"name": "default", "questions": []}

# Mapeo simple: (mundo, nivel) -> archivo de mapa (dentro de static)
MAPS = {
    ("bosque", 1): "LevelUp/maps/escenario1.json",
}

@xframe_options_exempt
@login_required
def misiones_mapa(request, actividad_pk=None, slug=None, nivel=None):
    """
    Devuelve el mapa Tiled enriquecido con preguntas de la actividad.
    """
    # Permitir ?actividad=ID si no vino por URL
    if not actividad_pk:
        qs_id = request.GET.get("actividad")
        if qs_id:
            try:
                actividad_pk = int(qs_id)
            except (TypeError, ValueError):
                actividad_pk = None

    # Cargar mapa base
    default_map = MAPS.get((slug, int(nivel))) if slug and nivel else next(iter(MAPS.values()))
    base = _load_static_map(default_map)

    # Si viene actividad, inyectar preguntas
    if actividad_pk:
        try:
            act = Actividad.objects.get(pk=int(actividad_pk))
        except Actividad.DoesNotExist:
            return JsonResponse({"error": "Actividad no encontrada"}, status=404)

        # Solo ítems tipo GAME (preguntas del minijuego)
        items_qs = act.items.filter(tipo__iexact="game").order_by("orden", "id")

        questions = []
        
        def _to_trivia(it):
            """
            Normaliza ItemActividad(tipo='game') a formato trivia:
            { id, q, options, correct }
            """
            datos = it.datos or {}
            kind = str(datos.get("kind") or "").lower()

            # === TRIVIA (formato array) ===
            if kind == "trivia" and isinstance(datos.get("questions"), list):
                qs_list = datos["questions"]
                if qs_list:
                    first = qs_list[0] or {}
                    qtxt = (first.get("q") or it.enunciado or "Pregunta").strip()
                    opts = list(first.get("opts") or first.get("options") or [])
                    ans = first.get("ans", 0)
                    
                    if not opts or len(opts) < 2:
                        opts = ["Opción 1", "Opción 2"]
                    if not isinstance(ans, int) or ans < 0 or ans >= len(opts):
                        ans = 0
                    
                    return {
                        "id": it.pk,
                        "q": qtxt,
                        "options": opts,
                        "correct": ans
                    }

            # === TRIVIA (formato plano) ===
            if kind == "trivia":
                qtxt = (datos.get("question") or it.enunciado or "Pregunta").strip()
                opts = list(datos.get("options") or [])
                ans = datos.get("answer", 0)
                
                if not opts or len(opts) < 2:
                    opts = ["Opción 1", "Opción 2"]
                if not isinstance(ans, int) or ans < 0 or ans >= len(opts):
                    ans = 0
                
                return {
                    "id": it.pk,
                    "q": qtxt,
                    "options": opts,
                    "correct": ans
                }

            # === FALLBACK GENÉRICO ===
            return {
                "id": it.pk,
                "q": it.enunciado or "¿Pregunta?",
                "options": ["Opción A", "Opción B", "Opción C"],
                "correct": 1
            }

        # Construir lista de preguntas
        for it in items_qs:
            questions.append(_to_trivia(it))

        # Renumerar con id secuencial 1..N para mapear a qid
        questions = [
            {**q, "item_pk": q.get("id"), "id": i + 1}
            for i, q in enumerate(questions)
        ]

        # Inyectar en el mapa
        new_map = dict(base)
        new_map["questions"] = questions
        new_map["actividad_id"] = act.pk

        # Auto-asignar qid a enemigos sin ese property
        idx = 1
        for layer in new_map.get("layers", []) or []:
            if layer.get("type") != "objectgroup":
                continue
            for obj in layer.get("objects", []) or []:
                name = (obj.get("name") or "").lower()
                if name != "enemy":
                    continue
                props_list = obj.get("properties") or []
                has_qid = any(p.get("name") == "qid" for p in props_list)
                if not has_qid:
                    props_list.append({"name": "qid", "type": "int", "value": idx})
                    obj["properties"] = props_list
                    idx += 1

        return JsonResponse(new_map, safe=False)

    # Sin actividad: mapa base
    return JsonResponse(base, safe=False)


@xframe_options_exempt
def misiones_jugar(request, slug, nivel):
    actividad_pk = request.GET.get("actividad")
    if actividad_pk:
        map_url = reverse("misiones_mapa_actividad", args=[actividad_pk])
    else:
        map_path = MAPS.get((slug, int(nivel)), "LevelUp/maps/escenario1.json")
        map_url = static(map_path)
    return render(request, "LevelUp/misiones/jugar.html", {"map_url": map_url, "mundo": slug, "nivel": nivel})

# -------------------------------------------------------------
# Atajo para crear misión base y llevar al editor
# -------------------------------------------------------------

@login_required
def actividad_crear_mision(request):
    if getattr(request.user, "rol", None) != "DOCENTE":
        raise Http404

    docente = get_object_or_404(Docente, usuario=request.user)

    with transaction.atomic():
        act = Actividad.objects.create(
            titulo="Misión sin título",
            descripcion="Videojuego con preguntas editables por el docente.",
            tipo="game",
            dificultad="medio",      # ajusta al valor real de tu Choice
            docente=docente,
            es_publicada=False,
            xp_total=100,
            intentos_max=3,
        )
        ItemActividad.objects.create(
            actividad=act,
            tipo="game",
            enunciado="Pregunta de ejemplo (edítame)",
            datos={
                "kind": "trivia",
                "questions": [{
                    "q": "¿Cuánto es 12 × 12?",
                    "opts": ["122", "124", "144", "132"],
                    "ans": 2
                }],
                "timeLimit": 60
            },
            puntaje=10,
        )

    # si viene ?preview=1, abre el editor con la vista previa automáticamente
    open_preview = "1" if request.GET.get("preview") == "1" else "0"
    return redirect(f"{reverse('actividad_editar', args=[act.pk])}?open_preview={open_preview}")