from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth import get_user_model
from .validators import formatear_rut_usuario 

Usuario = get_user_model()

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
            "rut":        forms.TextInput(attrs={"class": "form-input"}),
            "rol":        forms.Select(attrs={"class": "form-select"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["password1"].label = "Contraseña"
        self.fields["password2"].label = "Confirmar contraseña"
        self.fields["password1"].help_text = ""
        self.fields["password2"].help_text = ""
        
    def clean_rut(self):
        rut_ingresado = self.cleaned_data.get("rut", "")
        # Solo FORMATEA (no valida por módulo 11): devuelve "xx.xxx.xxx-DV"
        return formatear_rut_usuario(rut_ingresado)
    
    def save(self, commit=True):
        user = super().save(commit=False)
        email = self.cleaned_data["email"].lower()
        base_username = email.split("@")[0]
        username = base_username
        i = 1
        from django.contrib.auth import get_user_model
        Usuario = get_user_model()
        while Usuario.objects.filter(username=username).exists():
            username = f"{base_username}{i}"
            i += 1
        user.username = username
        user.email = email
        user.first_name = self.cleaned_data["first_name"]
        user.last_name = self.cleaned_data["last_name"]
        user.rut = self.cleaned_data["rut"]
        user.rol = self.cleaned_data["rol"]
        if commit:
            user.save()
        return user


class LoginForm(forms.Form):
    email = forms.EmailField(label="Email", widget=forms.EmailInput(attrs={"class": "form-input"}))
    password = forms.CharField(label="Contraseña", widget=forms.PasswordInput(attrs={"class": "form-input"}))
    remember = forms.BooleanField(label="Recordarme", required=False)
