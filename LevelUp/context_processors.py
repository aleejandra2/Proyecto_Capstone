from django.urls import reverse
from .models import Asignatura

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
