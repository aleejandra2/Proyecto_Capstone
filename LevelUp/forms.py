from django import forms
from django.contrib.auth.forms import UserCreationForm, PasswordChangeForm, PasswordResetForm
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.forms import inlineformset_factory
from .models import Actividad, ItemActividad

from .validators import formatear_rut_usuario

Usuario = get_user_model()


# ------------------------------
# Registro
# ------------------------------
class RegistrationForm(UserCreationForm):
    first_name = forms.CharField(label="Nombre", max_length=30)
    last_name  = forms.CharField(label="Apellido", max_length=30)
    email      = forms.EmailField(label="Email", max_length=128)
    rut        = forms.CharField(label="RUT", max_length=12)
    rol        = forms.ChoiceField(label="Rol", choices=Usuario.Rol.choices)

    class Meta(UserCreationForm.Meta):
        model = Usuario
        fields = ("first_name", "last_name", "email", "rut", "rol", "password1", "password2")
        widgets = {
            "first_name": forms.TextInput(attrs={"class": "form-input"}),
            "last_name":  forms.TextInput(attrs={"class": "form-input"}),
            "email":      forms.EmailInput(attrs={"class": "form-input"}),
            "rut":        forms.TextInput(attrs={"class": "form-input", "placeholder": "12.345.678-9"}),
            "rol":        forms.Select(attrs={"class": "form-select"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["password1"].label = "Contraseña"
        self.fields["password2"].label = "Confirmar contraseña"
        self.fields["password1"].help_text = ""
        self.fields["password2"].help_text = ""

    def clean_email(self):
        email = (self.cleaned_data.get("email") or "").strip().lower()
        if Usuario.objects.filter(email__iexact=email).exists():
            raise ValidationError("Este email ya está registrado.")
        return email

    def clean_rut(self):
        rut_ingresado = (self.cleaned_data.get("rut") or "").strip()
        rut_fmt = formatear_rut_usuario(rut_ingresado)  # formatea y valida DV ∈ [0-9K] (sin módulo 11)
        if Usuario.objects.filter(rut__iexact=rut_fmt).exists():
            raise ValidationError("Este RUT ya está registrado.")
        return rut_fmt

    def save(self, commit=True):
        user = super().save(commit=False)
        # username derivado del email (único)
        email = self.cleaned_data["email"].lower()
        base_username = email.split("@")[0]
        username = base_username
        i = 1
        while Usuario.objects.filter(username=username).exists():
            username = f"{base_username}{i}"
            i += 1
        user.username = username

        # campos básicos
        user.email = email
        user.first_name = self.cleaned_data["first_name"]
        user.last_name = self.cleaned_data["last_name"]
        user.rut = self.cleaned_data["rut"]           # ya viene formateado por clean_rut
        user.rol = self.cleaned_data["rol"]

        if commit:
            user.save()
        return user


# ------------------------------
# Login
# ------------------------------
class LoginForm(forms.Form):
    email = forms.EmailField(
        label="Email",
        widget=forms.EmailInput(attrs={"class": "form-input"})
    )
    password = forms.CharField(
        label="Contraseña",
        widget=forms.PasswordInput(attrs={"class": "form-input"})
    )
    remember = forms.BooleanField(label="Recordarme", required=False)

# ------------------------------
# Recuperar contraseña
# ------------------------------
class PasswordResetFormVisible(PasswordResetForm):
    """
    Muestra error si el email no está registrado.
    Si el email existe, el flujo normal de PasswordResetForm enviará el correo.
    """
    def clean_email(self):
        email = (self.cleaned_data.get("email") or "").strip().lower()
        User = get_user_model()
        if not User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError("Este correo no se encuentra registrado.")
        return email

# ------------------------------
# Perfil: edición de datos
# ------------------------------
class ProfileForm(forms.ModelForm):
    first_name = forms.CharField(
        label="Nombre", max_length=30,
        widget=forms.TextInput(attrs={"class": "form-input"})
    )
    last_name  = forms.CharField(
        label="Apellido", max_length=30,
        widget=forms.TextInput(attrs={"class": "form-input"})
    )
    email      = forms.EmailField(
        label="Email", max_length=128,
        widget=forms.EmailInput(attrs={"class": "form-input"})
    )
    rut        = forms.CharField(
        label="RUT", max_length=12,
        widget=forms.TextInput(attrs={
            "class": "form-input",
            "placeholder": "12.345.678-9",
        })
    )

    class Meta:
        model = Usuario
        fields = ("first_name", "last_name", "email", "rut")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Mostrar el RUT pero impedir edición en el formulario
        self.fields["rut"].disabled = True       # no editable y no se envía en POST
        self.fields["rut"].required = False      # evita validaciones innecesarias
        self.fields["rut"].widget.attrs.update({
            "readonly": "readonly",              # apariencia de solo lectura
            "title": "El RUT no se puede modificar desde aquí.",
        })

    def clean_email(self):
        email = (self.cleaned_data.get("email") or "").strip().lower()
        if Usuario.objects.exclude(pk=self.instance.pk).filter(email__iexact=email).exists():
            raise ValidationError("Este email ya está en uso.")
        return email

    def clean_rut(self):
        # Blindaje del backend: siempre conservar el RUT original del usuario.
        # Así, aunque alguien quite el 'disabled' en el navegador, no podrá cambiarlo.
        return getattr(self.instance, "rut", self.initial.get("rut", ""))


# ------------------------------
# Perfil: cambio de contraseña
# ------------------------------
class ProfilePasswordForm(PasswordChangeForm):
    old_password  = forms.CharField(
        label="Contraseña actual",
        widget=forms.PasswordInput(attrs={"class": "form-input"})
    )
    new_password1 = forms.CharField(
        label="Nueva contraseña",
        widget=forms.PasswordInput(attrs={"class": "form-input"}),
        help_text=""
    )
    new_password2 = forms.CharField(
        label="Confirmar nueva contraseña",
        widget=forms.PasswordInput(attrs={"class": "form-input"}),
        help_text=""
    )

# ------------------------------
# Actividades
# ------------------------------    
class ActividadForm(forms.ModelForm):
    class Meta:
        model = Actividad
        fields = [
            "titulo", "descripcion", "tipo", "dificultad",
            "recurso", "recompensa", "es_publicada", "fecha_cierre", "xp_total"
        ]
        widgets = {
            "titulo": forms.TextInput(attrs={"class": "form-control"}),
            "descripcion": forms.Textarea(attrs={"class": "form-control", "rows": 3}),
            "tipo": forms.Select(attrs={"class": "form-select"}),
            "dificultad": forms.Select(attrs={"class": "form-select"}),
            "recurso": forms.Select(attrs={"class": "form-select"}),
            "recompensa": forms.Select(attrs={"class": "form-select"}),
            "es_publicada": forms.CheckboxInput(attrs={"class": "form-check-input"}),
            "fecha_cierre": forms.DateTimeInput(attrs={"class": "form-control", "type": "datetime-local"}),
            "xp_total": forms.NumberInput(attrs={"class": "form-control", "min": "0"}),
        }

from django import forms
from django.contrib.auth.forms import UserCreationForm, PasswordChangeForm, PasswordResetForm
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.forms import inlineformset_factory

from .validators import formatear_rut_usuario
from .models import Actividad, ItemActividad

Usuario = get_user_model()

# ==============================
# Registro
# ==============================
class RegistrationForm(UserCreationForm):
    first_name = forms.CharField(label="Nombre", max_length=30)
    last_name  = forms.CharField(label="Apellido", max_length=30)
    email      = forms.EmailField(label="Email", max_length=128)
    rut        = forms.CharField(label="RUT", max_length=12)
    rol        = forms.ChoiceField(label="Rol", choices=Usuario.Rol.choices)

    class Meta(UserCreationForm.Meta):
        model = Usuario
        fields = ("first_name", "last_name", "email", "rut", "rol", "password1", "password2")
        widgets = {
            "first_name": forms.TextInput(attrs={"class": "form-input"}),
            "last_name":  forms.TextInput(attrs={"class": "form-input"}),
            "email":      forms.EmailInput(attrs={"class": "form-input"}),
            "rut":        forms.TextInput(attrs={"class": "form-input", "placeholder": "12.345.678-9"}),
            "rol":        forms.Select(attrs={"class": "form-select"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["password1"].label = "Contraseña"
        self.fields["password2"].label = "Confirmar contraseña"
        self.fields["password1"].help_text = ""
        self.fields["password2"].help_text = ""

    def clean_email(self):
        email = (self.cleaned_data.get("email") or "").strip().lower()
        if Usuario.objects.filter(email__iexact=email).exists():
            raise ValidationError("Este email ya está registrado.")
        return email

    def clean_rut(self):
        rut_ingresado = (self.cleaned_data.get("rut") or "").strip()
        rut_fmt = formatear_rut_usuario(rut_ingresado)  # formatea y valida DV
        if Usuario.objects.filter(rut__iexact=rut_fmt).exists():
            raise ValidationError("Este RUT ya está registrado.")
        return rut_fmt

    def save(self, commit=True):
        user = super().save(commit=False)
        # username derivado del email
        email = self.cleaned_data["email"].lower()
        base_username = email.split("@")[0]
        username = base_username
        i = 1
        while Usuario.objects.filter(username=username).exists():
            username = f"{base_username}{i}"
            i += 1
        user.username = username

        # campos básicos
        user.email = email
        user.first_name = self.cleaned_data["first_name"]
        user.last_name = self.cleaned_data["last_name"]
        user.rut = self.cleaned_data["rut"]           # ya normalizado por clean_rut
        user.rol = self.cleaned_data["rol"]

        if commit:
            user.save()
        return user


# ==============================
# Login
# ==============================
class LoginForm(forms.Form):
    email = forms.EmailField(
        label="Email",
        widget=forms.EmailInput(attrs={"class": "form-input"})
    )
    password = forms.CharField(
        label="Contraseña",
        widget=forms.PasswordInput(attrs={"class": "form-input"})
    )
    remember = forms.BooleanField(label="Recordarme", required=False)


# ==============================
# Recuperar contraseña (visible)
# ==============================
class PasswordResetFormVisible(PasswordResetForm):
    """
    Muestra error si el email no está registrado.
    Si existe, PasswordResetForm enviará el correo.
    """
    def clean_email(self):
        email = (self.cleaned_data.get("email") or "").strip().lower()
        User = get_user_model()
        if not User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError("Este correo no se encuentra registrado.")
        return email


# ==============================
# Perfil: edición
# ==============================
class ProfileForm(forms.ModelForm):
    first_name = forms.CharField(
        label="Nombre", max_length=30,
        widget=forms.TextInput(attrs={"class": "form-input"})
    )
    last_name  = forms.CharField(
        label="Apellido", max_length=30,
        widget=forms.TextInput(attrs={"class": "form-input"})
    )
    email      = forms.EmailField(
        label="Email", max_length=128,
        widget=forms.EmailInput(attrs={"class": "form-input"})
    )
    rut        = forms.CharField(
        label="RUT", max_length=12,
        widget=forms.TextInput(attrs={
            "class": "form-input",
            "placeholder": "12.345.678-9",
        })
    )

    class Meta:
        model = Usuario
        fields = ("first_name", "last_name", "email", "rut")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Mostrar RUT pero impedir edición
        self.fields["rut"].disabled = True
        self.fields["rut"].required = False
        self.fields["rut"].widget.attrs.update({
            "readonly": "readonly",
            "title": "El RUT no se puede modificar desde aquí.",
        })

    def clean_email(self):
        email = (self.cleaned_data.get("email") or "").strip().lower()
        if Usuario.objects.exclude(pk=self.instance.pk).filter(email__iexact=email).exists():
            raise ValidationError("Este email ya está en uso.")
        return email

    def clean_rut(self):
        # Blindaje backend: conserva el RUT original
        return getattr(self.instance, "rut", self.initial.get("rut", ""))


# ==============================
# Perfil: cambio de contraseña
# ==============================
class ProfilePasswordForm(PasswordChangeForm):
    old_password  = forms.CharField(
        label="Contraseña actual",
        widget=forms.PasswordInput(attrs={"class": "form-input"})
    )
    new_password1 = forms.CharField(
        label="Nueva contraseña",
        widget=forms.PasswordInput(attrs={"class": "form-input"}),
        help_text=""
    )
    new_password2 = forms.CharField(
        label="Confirmar nueva contraseña",
        widget=forms.PasswordInput(attrs={"class": "form-input"}),
        help_text=""
    )


# ==============================
# Actividades (contenedor)
# ==============================
class ActividadForm(forms.ModelForm):
    class Meta:
        model = Actividad
        fields = [
            "titulo", "descripcion", "tipo", "dificultad",
            "recurso", "recompensa", "es_publicada", "fecha_cierre", "xp_total", "intentos_max", 
        ]
        widgets = {
            "titulo": forms.TextInput(attrs={"class": "form-control"}),
            "descripcion": forms.Textarea(attrs={"class": "form-control", "rows": 3}),
            "tipo": forms.Select(attrs={"class": "form-select"}),
            "dificultad": forms.Select(attrs={"class": "form-select"}),
            "recurso": forms.Select(attrs={"class": "form-select"}),
            "recompensa": forms.Select(attrs={"class": "form-select"}),
            "es_publicada": forms.CheckboxInput(attrs={"class": "form-check-input"}),
            "fecha_cierre": forms.DateTimeInput(attrs={"class": "form-control", "type": "datetime-local"}),
            "xp_total": forms.NumberInput(attrs={"class": "form-control", "min": "0"}),
            "intentos_max": forms.NumberInput(attrs={"class": "form-control", "min": "1", "max": "20"}),
        }


# ==============================
# Ítems de actividad (interactivos)
# ==============================
class ItemActividadForm(forms.ModelForm):
    # --- MCQ: alternativas (máx 6) ---
    alt_1 = forms.CharField(label="Alternativa A", required=False, widget=forms.TextInput(attrs={"class": "form-control"}))
    alt_2 = forms.CharField(label="Alternativa B", required=False, widget=forms.TextInput(attrs={"class": "form-control"}))
    alt_3 = forms.CharField(label="Alternativa C", required=False, widget=forms.TextInput(attrs={"class": "form-control"}))
    alt_4 = forms.CharField(label="Alternativa D", required=False, widget=forms.TextInput(attrs={"class": "form-control"}))
    alt_5 = forms.CharField(label="Alternativa E", required=False, widget=forms.TextInput(attrs={"class": "form-control"}))
    alt_6 = forms.CharField(label="Alternativa F", required=False, widget=forms.TextInput(attrs={"class": "form-control"}))

    # MCQ: single / multiple correctas
    allow_multiple = forms.BooleanField(
        label="Permitir múltiples correctas",
        required=False,
        widget=forms.CheckboxInput(attrs={"class": "form-check-input"})
    )
    correcta = forms.ChoiceField(
        label="¿Cuál es la correcta? (si no usas múltiples)",
        required=False,
        choices=[("1","A"),("2","B"),("3","C"),("4","D"),("5","E"),("6","F")],
        widget=forms.RadioSelect(attrs={"class": "form-check-input"})
    )
    correctas_multi = forms.MultipleChoiceField(
        label="Marca las correctas (si usas múltiples)",
        required=False,
        choices=[("1","A"),("2","B"),("3","C"),("4","D"),("5","E"),("6","F")],
        widget=forms.CheckboxSelectMultiple(attrs={"class": "form-check-input"})
    )

    # --- TF ---
    tf_respuesta = forms.ChoiceField(
        label="Respuesta (Verdadero/Falso)",
        required=False,
        choices=[("true","Verdadero"),("false","Falso")],
        widget=forms.RadioSelect(attrs={"class": "form-check-input"})
    )

    # --- FIB (Completar) ---
    fib_respuestas = forms.CharField(
        label="Respuestas aceptadas (una por línea)",
        required=False,
        widget=forms.Textarea(attrs={"class": "form-control", "rows": 3}),
        help_text="Se aceptará cualquiera; puedes poner variantes como '4' y 'cuatro'."
    )
    fib_case_insensitive = forms.BooleanField(
        label="Ignorar mayúsculas/minúsculas",
        required=False,
        initial=True,
        widget=forms.CheckboxInput(attrs={"class": "form-check-input"})
    )

    # --- SORT (Ordenar) ---
    sort_items = forms.CharField(
        label="Elementos a ordenar (uno por línea, en el orden correcto)",
        required=False,
        widget=forms.Textarea(attrs={"class": "form-control", "rows": 4}),
        help_text="El orden que ingreses aquí se considera el correcto."
    )

    # --- MATCH (Emparejar) ---
    match_left = forms.CharField(
        label="Columna izquierda (uno por línea)",
        required=False,
        widget=forms.Textarea(attrs={"class": "form-control", "rows": 4})
    )
    match_right = forms.CharField(
        label="Columna derecha (uno por línea, mismo número de líneas que izquierda)",
        required=False,
        widget=forms.Textarea(attrs={"class": "form-control", "rows": 4})
    )

    # --- TEXT (respuesta abierta) ---
    text_keywords = forms.CharField(
        label="Palabras clave (opcional, separadas por coma)",
        required=False,
        widget=forms.TextInput(attrs={"class": "form-control"})
    )
    text_minlen = forms.IntegerField(
        label="Largo mínimo (opcional)",
        required=False,
        min_value=0,
        widget=forms.NumberInput(attrs={"class": "form-control"})
    )

    # --- INTERACTIVE/GAME ---
    ext_url = forms.URLField(
        label="URL del recurso (embed)",
        required=False,
        widget=forms.URLInput(attrs={"class": "form-control"})
    )
    ext_provider = forms.CharField(
        label="Proveedor (ej: itch.io, youtube, genially)",
        required=False,
        widget=forms.TextInput(attrs={"class": "form-control"})
    )

    class Meta:
        model = ItemActividad
        fields = ["tipo", "enunciado", "puntaje", "imagen"]
        labels = {"enunciado": "Enunciado / Pregunta"}
        widgets = {
            "tipo": forms.Select(attrs={"class": "form-select"}),
            "enunciado": forms.Textarea(attrs={"class": "form-control", "rows": 2, "placeholder": "Escribe la consigna…"}),
            "puntaje": forms.NumberInput(attrs={"class": "form-control", "min": "0"}),
            "imagen": forms.ClearableFileInput(attrs={"class": "form-control"}),
        }

    # -------- helpers de precarga --------
    def _load_mcq_initial(self, datos):
        # soporta {"correctas":[...]} (0-based) o {"correcta": n} (1-based)
        opciones = datos.get("opciones", [])
        for i, txt in enumerate(opciones[:6]):
            self.fields[f"alt_{i+1}"].initial = txt or ""
        if "correctas" in datos:
            self.fields["allow_multiple"].initial = len(datos.get("correctas", [])) > 1
            self.fields["correctas_multi"].initial = [str(i+1) for i in datos.get("correctas", [])]
            if len(datos.get("correctas", [])) == 1:
                self.fields["correcta"].initial = str(datos["correctas"][0] + 1)
        elif "correcta" in datos:
            self.fields["correcta"].initial = str(int(datos["correcta"]))
            self.fields["allow_multiple"].initial = False

    def _load_tf_initial(self, datos):
        val = datos.get("respuesta", None)
        if isinstance(val, bool):
            self.fields["tf_respuesta"].initial = "true" if val else "false"

    def _load_fib_initial(self, datos):
        resps = datos.get("respuestas", [])
        if resps:
            self.fields["fib_respuestas"].initial = "\n".join(resps)
        self.fields["fib_case_insensitive"].initial = bool(datos.get("case_insensitive", True))

    def _load_sort_initial(self, datos):
        items = datos.get("items", [])
        if items:
            self.fields["sort_items"].initial = "\n".join([it.get("texto", "") for it in items])

    def _load_match_initial(self, datos):
        pares = datos.get("pares", [])
        if pares:
            left = [p.get("left", {}).get("texto", "") for p in pares]
            right = [p.get("right", {}).get("texto", "") for p in pares]
            self.fields["match_left"].initial = "\n".join(left)
            self.fields["match_right"].initial = "\n".join(right)

    def _load_text_initial(self, datos):
        kws = datos.get("palabras_clave", [])
        if kws:
            self.fields["text_keywords"].initial = ", ".join(kws)
        if "long_min" in datos:
            self.fields["text_minlen"].initial = datos.get("long_min")

    def _load_ext_initial(self, datos):
        if "url" in datos:
            self.fields["ext_url"].initial = datos["url"]
        if "proveedor" in datos:
            self.fields["ext_provider"].initial = datos["proveedor"]

    # -------- lifecycle --------
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # Precargar desde datos (si el ítem existe)
        datos = getattr(self.instance, "datos", None) or {}
        # si viene tipo en POST, úsalo; si no, usa el del instance
        t = ((getattr(self.instance, "tipo", "") or "").lower()) or (self.data.get("tipo", "").lower())

        if self.instance and self.instance.pk and datos:
            if t == "mcq":
                self._load_mcq_initial(datos)
            elif t == "tf":
                self._load_tf_initial(datos)
            elif t == "fib":
                self._load_fib_initial(datos)
            elif t == "sort":
                self._load_sort_initial(datos)
            elif t == "match":
                self._load_match_initial(datos)
            elif t == "text":
                self._load_text_initial(datos)
            elif t in ("interactive", "game"):
                self._load_ext_initial(datos)

    def clean(self):
        cleaned = super().clean()
        t = (cleaned.get("tipo") or "").lower()

        # --- MCQ ---
        if t == "mcq":
            alternativas = []
            for i in range(6):
                v = (cleaned.get(f"alt_{i+1}") or "").strip()
                if v:
                    alternativas.append((i+1, v))
            if len(alternativas) < 2:
                raise forms.ValidationError("En opción múltiple, ingresa al menos 2 alternativas.")

            allow_multi = bool(cleaned.get("allow_multiple"))
            if allow_multi:
                marcadas = cleaned.get("correctas_multi") or []
                if not marcadas:
                    raise forms.ValidationError("Marca al menos una alternativa correcta.")
                idx_validos = [idx for idx, _ in alternativas]  # 1-based válidos
                for m in marcadas:
                    if int(m) not in idx_validos:
                        raise forms.ValidationError("Las correctas deben existir entre las alternativas.")
                # mapear a 0-based respecto de la lista compacta
                map_1based_to_compact = {idx: k for k, (idx, _) in enumerate(alternativas)}
                correctas = sorted(map_1based_to_compact[int(m)] for m in marcadas)
            else:
                c = cleaned.get("correcta")
                if not c:
                    raise forms.ValidationError("Selecciona la alternativa correcta.")
                idx_validos = [idx for idx, _ in alternativas]
                if int(c) not in idx_validos:
                    raise forms.ValidationError("La correcta debe apuntar a una alternativa ingresada.")
                map_1based_to_compact = {idx: k for k, (idx, _) in enumerate(alternativas)}
                correctas = [map_1based_to_compact[int(c)]]

            opciones = [texto for _, texto in alternativas]
            cleaned["_datos_payload"] = {
                "opciones": opciones,
                "correctas": correctas,   # índices 0-based en la lista compacta
                "multiple": allow_multi
            }

        # --- TF ---
        elif t == "tf":
            ans = cleaned.get("tf_respuesta")
            if ans not in ("true", "false"):
                raise forms.ValidationError("Selecciona Verdadero o Falso.")
            cleaned["_datos_payload"] = {"respuesta": (ans == "true")}

        # --- FIB ---
        elif t == "fib":
            raw = (cleaned.get("fib_respuestas") or "").strip()
            if not raw:
                raise forms.ValidationError("Ingresa al menos una respuesta aceptada (una por línea).")
            respuestas = [ln.strip() for ln in raw.splitlines() if ln.strip()]
            if not respuestas:
                raise forms.ValidationError("Debes ingresar respuestas válidas.")
            cleaned["_datos_payload"] = {
                "respuestas": respuestas,
                "case_insensitive": bool(cleaned.get("fib_case_insensitive", True)),
            }

        # --- SORT ---
        elif t == "sort":
            raw = (cleaned.get("sort_items") or "").strip()
            items = [ln.strip() for ln in raw.splitlines() if ln.strip()]
            if len(items) < 2:
                raise forms.ValidationError("Ingresa al menos 2 elementos para ordenar.")
            objs = [{"id": f"s{i+1}", "texto": txt} for i, txt in enumerate(items)]
            orden = [f"s{i+1}" for i in range(len(items))]
            cleaned["_datos_payload"] = {"items": objs, "orden_correcto": orden}

        # --- MATCH ---
        elif t == "match":
            left_raw = (cleaned.get("match_left") or "").strip()
            right_raw = (cleaned.get("match_right") or "").strip()
            left = [ln.strip() for ln in left_raw.splitlines() if ln.strip()]
            right = [ln.strip() for ln in right_raw.splitlines() if ln.strip()]
            if not left or not right:
                raise forms.ValidationError("Ingresa ambas columnas (izquierda y derecha).")
            if len(left) != len(right):
                raise forms.ValidationError("Las columnas deben tener el mismo número de líneas.")
            pares = []
            for i, (l, r) in enumerate(zip(left, right), start=1):
                pares.append({"left": {"id": f"l{i}", "texto": l}, "right": {"id": f"r{i}", "texto": r}})
            cleaned["_datos_payload"] = {"pares": pares}

        # --- TEXT ---
        elif t == "text":
            kw_raw = (cleaned.get("text_keywords") or "").strip()
            kws = [x.strip() for x in kw_raw.split(",") if x.strip()] if kw_raw else []
            long_min = cleaned.get("text_minlen")
            cleaned["_datos_payload"] = {"palabras_clave": kws, "long_min": int(long_min or 0)}

        # --- INTERACTIVE / GAME ---
        elif t in ("interactive", "game"):
            url = (cleaned.get("ext_url") or "").strip()
            if not url:
                raise forms.ValidationError("Ingresa la URL del recurso a embeber.")
            prov = (cleaned.get("ext_provider") or "").strip()
            cleaned["_datos_payload"] = {"url": url, "proveedor": prov}

        # --- IMAGE u otros sin datos estructurados ---
        else:
            cleaned["_datos_payload"] = cleaned.get("_datos_payload") or {}

        return cleaned

    def save(self, commit=True):
        obj = super().save(commit=False)
        payload = self.cleaned_data.get("_datos_payload")
        if payload is not None:
            obj.datos = payload
        if commit:
            obj.save()
        return obj


ItemFormSet = inlineformset_factory(
    Actividad,
    ItemActividad,
    form=ItemActividadForm,
    extra=0,
    can_delete=True
)