from django.urls import reverse
from .models import Asignatura
from .models import Estudiante
from gamificacion.services import obtener_o_crear_perfil
from .models import Usuario


def user_home_url(request):
    user = request.user
    url = reverse('home')
    if user.is_authenticated:
        if getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False):
            try: url = reverse('admin:index')
            except: pass
        elif getattr(user, 'es_docente', False) or getattr(user, 'is_docente', False) or str(getattr(user, 'rol', '')).lower() == 'docente':
            url = reverse('dashboard')
        elif getattr(user, 'es_estudiante', False) or getattr(user, 'is_estudiante', False) or str(getattr(user, 'rol', '')).lower() == 'estudiante':
            url = reverse('dashboard')
        elif str(getattr(user, 'rol', '')).lower() in ('administrador','admin'):
            url = reverse('dashboard')
    return {"user_home_url": url}

def navbar_asignaturas(request):
    if not request.user.is_authenticated:
        return {}
    # Ajusta el queryset a tu lógica (por curso/rol)
    qs = Asignatura.objects.all().order_by('nombre')
    # Puedes decidir la asignatura actual aquí si corresponde
    actual = getattr(request, "asignatura_actual", None)
    icono = getattr(request, "asignatura_icono", None)
    return {
        "asignaturas": qs,
        "asignatura_actual": getattr(actual, "nombre", None),
        "asignatura_icono": icono,
    }

def estudiante_actual(request):
    if not request.user.is_authenticated:
        return {}
    try:
        est = Estudiante.objects.select_related("usuario").get(usuario=request.user)
    except Estudiante.DoesNotExist:
        return {}
    return {"estudiante_actual": est}

from gamificacion.models import RecompensaUsuario

def gamificacion_context(request):

    if not request.user.is_authenticated:
        return {}

    try:
        rol = getattr(request.user, "rol", None)
    except Exception:
        rol = None

    ctx = {}

    if rol == Usuario.Rol.ESTUDIANTE:
        # Estudiante "dueño" de los puntos/XP
        est = Estudiante.objects.select_related("usuario").filter(usuario=request.user).first()
        perfil = obtener_o_crear_perfil(request.user)

        ctx["estudiante_actual"] = est
        ctx["perfil"] = perfil

        # 🔔 Leer de la sesión los IDs de recompensas nuevas
        nuevas_ids = request.session.get("nuevas_recompensas_ids") or []
        if nuevas_ids:
            nuevas_recompensas = list(
                RecompensaUsuario.objects
                .filter(perfil=perfil, recompensa_id__in=nuevas_ids)
                .select_related("recompensa")
            )
            ctx["nuevas_recompensas"] = nuevas_recompensas

            # Limpiar para que no se repita el popup
            request.session["nuevas_recompensas_ids"] = []
            request.session.modified = True

    return ctx

