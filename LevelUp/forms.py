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

class ItemActividadForm(forms.ModelForm):
    # Alternativas (máx 6) + correcta
    alt_1 = forms.CharField(label="Alternativa A", required=False, widget=forms.TextInput(attrs={"class": "form-control"}))
    alt_2 = forms.CharField(label="Alternativa B", required=False, widget=forms.TextInput(attrs={"class": "form-control"}))
    alt_3 = forms.CharField(label="Alternativa C", required=False, widget=forms.TextInput(attrs={"class": "form-control"}))
    alt_4 = forms.CharField(label="Alternativa D", required=False, widget=forms.TextInput(attrs={"class": "form-control"}))
    alt_5 = forms.CharField(label="Alternativa E", required=False, widget=forms.TextInput(attrs={"class": "form-control"}))
    alt_6 = forms.CharField(label="Alternativa F", required=False, widget=forms.TextInput(attrs={"class": "form-control"}))

    correcta = forms.ChoiceField(
        label="¿Cuál es la correcta?",
        required=False,
        choices=[("1","A"),("2","B"),("3","C"),("4","D"),("5","E"),("6","F")],
        widget=forms.RadioSelect(attrs={"class": "form-check-input"})
    )

    # Verdadero / Falso
    tf_respuesta = forms.ChoiceField(
        label="Respuesta",
        required=False,
        choices=[("true","Verdadero"),("false","Falso")],
        widget=forms.RadioSelect(attrs={"class": "form-check-input"})
    )

    class Meta:
        model = ItemActividad
        fields = ["tipo", "enunciado", "puntaje", "imagen"]
        labels = {"enunciado": "Pregunta"}
        widgets = {
            "tipo": forms.Select(attrs={"class": "form-select"}),
            "enunciado": forms.Textarea(attrs={"class": "form-control", "rows": 2, "placeholder": "Escribe la pregunta…"}),
            "puntaje": forms.NumberInput(attrs={"class": "form-control", "min": "0"}),
            "imagen": forms.ClearableFileInput(attrs={"class": "form-control"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # Precargar desde datos (si el ítem existe)
        datos = getattr(self.instance, "datos", None) or {}
        t = (getattr(self.instance, "tipo", "") or "").lower()

        if self.instance and self.instance.pk:
            if t == "mcq":
                opciones = datos.get("opciones", [])
                for i in range(6):
                    self.fields[f"alt_{i+1}"].initial = opciones[i] if i < len(opciones) else ""
                corr = datos.get("correcta")
                if isinstance(corr, int) and 1 <= corr <= 6:
                    self.fields["correcta"].initial = str(corr)
            elif t == "tf":
                val = datos.get("respuesta")
                if isinstance(val, bool):
                    self.fields["tf_respuesta"].initial = "true" if val else "false"

    def clean(self):
        cleaned = super().clean()
        t = (cleaned.get("tipo") or "").lower()

        if t == "mcq":
            alternativas = []
            for i in range(6):
                v = (cleaned.get(f"alt_{i+1}") or "").strip()
                if v:
                    alternativas.append((i+1, v))
            if len(alternativas) < 2:
                raise forms.ValidationError("En opción múltiple, ingresa al menos 2 alternativas.")

            correcta = cleaned.get("correcta")
            if not correcta:
                raise forms.ValidationError("Selecciona la alternativa correcta.")
            correcta_idx = int(correcta)

            idxs = [idx for idx, _ in alternativas]
            if correcta_idx not in idxs:
                raise forms.ValidationError("La correcta debe apuntar a una alternativa ingresada.")

            # Normalizar a 6 posiciones
            opciones = [""] * 6
            for idx, texto in alternativas:
                opciones[idx-1] = texto

            cleaned["_datos_payload"] = {"opciones": opciones, "correcta": correcta_idx}

        elif t == "tf":
            ans = cleaned.get("tf_respuesta")
            if ans not in ("true","false"):
                raise forms.ValidationError("Selecciona Verdadero o Falso.")
            cleaned["_datos_payload"] = {"respuesta": True if ans == "true" else False}

        elif t == "text":
            cleaned["_datos_payload"] = {"abierta": True}

        # otros tipos: puedes añadir metadata si quieres
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
    form=ItemActividadForm,   # <- importante
    extra=0,
    can_delete=True
)