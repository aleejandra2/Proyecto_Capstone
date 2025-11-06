from django.urls import reverse

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
