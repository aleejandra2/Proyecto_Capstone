from django import forms
from django.contrib.auth.forms import UserCreationForm, PasswordChangeForm
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

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