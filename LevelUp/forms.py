from django import forms
from django.contrib.auth.forms import UserCreationForm, PasswordChangeForm, PasswordResetForm
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.forms import inlineformset_factory, BaseInlineFormSet
from typing import Any, Dict, List
import json

from .models import Actividad, ItemActividad
from .validators import formatear_rut_usuario

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
        rut_fmt = formatear_rut_usuario(rut_ingresado)
        if Usuario.objects.filter(rut__iexact=rut_fmt).exists():
            raise ValidationError("Este RUT ya está registrado.")
        return rut_fmt

    def save(self, commit=True):
        user = super().save(commit=False)
        email = self.cleaned_data["email"].lower()
        base_username = email.split("@")[0]
        username = base_username
        i = 1
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


# ==============================
# Login
# ==============================
class LoginForm(forms.Form):
    email = forms.EmailField(
        label="Email",
        widget=forms.EmailInput(attrs={"class": "form-input", "placeholder": "Correo electrónico"})
    )
    password = forms.CharField(
        label="Contraseña",
        widget=forms.PasswordInput(attrs={"class": "form-input", "placeholder": "Contraseña"})
    )
    remember = forms.BooleanField(label="Recordarme", required=False)


# ==============================
# Recuperar contraseña (visible)
# ==============================
class PasswordResetFormVisible(PasswordResetForm):
    def clean_email(self):
        email = (self.cleaned_data.get("email") or "").strip().lower()
        User = get_user_model()
        if not User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError("Este correo no se encuentra registrado.")
        return email


# ==============================
# Perfil
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
        widget=forms.TextInput(attrs={"class": "form-input","placeholder":"12.345.678-9"})
    )

    class Meta:
        model = Usuario
        fields = ("first_name", "last_name", "email", "rut")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["rut"].disabled = True
        self.fields["rut"].required = False
        self.fields["rut"].widget.attrs.update({"readonly": "readonly"})

    def clean_email(self):
        email = (self.cleaned_data.get("email") or "").strip().lower()
        if Usuario.objects.exclude(pk=self.instance.pk).filter(email__iexact=email).exists():
            raise ValidationError("Este email ya está en uso.")
        return email

    def clean_rut(self):
        return getattr(self.instance, "rut", self.initial.get("rut", ""))


class ProfilePasswordForm(PasswordChangeForm):
    old_password  = forms.CharField(label="Contraseña actual", widget=forms.PasswordInput(attrs={"class":"form-input"}))
    new_password1 = forms.CharField(label="Nueva contraseña", widget=forms.PasswordInput(attrs={"class":"form-input"}), help_text="")
    new_password2 = forms.CharField(label="Confirmar nueva contraseña", widget=forms.PasswordInput(attrs={"class":"form-input"}), help_text="")


# ---------------------------------------------------------
# Actividad
# ---------------------------------------------------------
class ActividadForm(forms.ModelForm):
    class Meta:
        model = Actividad
        fields = [
            "titulo", "descripcion", "tipo", "dificultad",
            "xp_total", "intentos_max", "es_publicada", "fecha_cierre"
        ]
        widgets = {
            "titulo": forms.TextInput(attrs={"class": "form-control"}),
            "descripcion": forms.Textarea(attrs={"class": "form-control", "rows": 3}),
            "tipo": forms.Select(attrs={"class": "form-select"}),
            "dificultad": forms.Select(attrs={"class": "form-select"}),
            "xp_total": forms.NumberInput(attrs={"class": "form-control", "min": "0"}),
            "intentos_max": forms.NumberInput(attrs={"class": "form-control", "min": "1", "max": "20"}),
            "es_publicada": forms.CheckboxInput(attrs={"class": "form-check-input"}),
            "fecha_cierre": forms.DateTimeInput(attrs={"class": "form-control", "type": "datetime-local"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["tipo"].choices = [("quiz", "Quiz"), ("game", "Juego")]


# ---------------------------------------------------------
# Ítems (Game Builder) — helpers
# ---------------------------------------------------------
def _norm_kind(v: str) -> str:
    s = (v or "").strip().lower()
    if s in {"drag & match", "drag and match", "dragmatch"}: return "dragmatch"
    if "mem" in s: return "memory"
    if "trivia" in s: return "trivia"
    if "clasif" in s: return "classify"
    if "cloze" in s or "completar" in s: return "cloze"
    if "orden" in s: return "ordering"
    if s in {"vf", "verdadero", "falso", "verdadero / falso"}: return "vf"
    if "laberinto" in s: return "labyrinth"
    if "tiend" in s or "precio" in s or s == "shop": return "shop"
    return s

GAME_KIND_CHOICES = [
    ("dragmatch", "Drag & Match"),
    ("memory",    "Memoria (pares)"),
    ("trivia",    "Trivia (opción múltiple)"),
    ("vf",        "Verdadero / Falso"),
    ("classify",  "Clasificar en categorías"),
    ("cloze",     "Completar (cloze)"),
    ("ordering",  "Ordenar pasos"),
    ("labyrinth", "Laberinto de puertas"),
    ("shop",      "Tiendita (precios)"),
]
ALLOWED_KINDS = {k for k, _ in GAME_KIND_CHOICES}


class ItemForm(forms.ModelForm):
    # Controles visibles del builder (no son campos del modelo)
    game_kind = forms.ChoiceField(
        label="Tipo de juego",
        choices=GAME_KIND_CHOICES,
        required=True,
        widget=forms.Select(attrs={"class": "form-select"})
    )
    game_time_limit = forms.IntegerField(
        label="Tiempo límite (s)",
        required=False, min_value=5, max_value=3600, initial=60,
        widget=forms.NumberInput(attrs={"class": "form-control"})
    )
    # JSON oculto que sincroniza el builder
    game_pairs = forms.CharField(
        label="Contenido del juego (oculto)",
        required=False,
        widget=forms.Textarea(attrs={"rows": 4, "class": "form-control d-none"})
    )

    class Meta:
        model = ItemActividad
        fields = ["tipo", "enunciado", "puntaje"]  # ← nunca incluir "DELETE"
        widgets = {
            "tipo": forms.HiddenInput(),
            "enunciado": forms.Textarea(attrs={
                "class": "form-control", "rows": 2,
                "placeholder": "Describe qué debe hacer el alumno…"
            }),
            "puntaje": forms.NumberInput(attrs={"class": "form-control", "min": "0"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # Si viene marcado para eliminar, no exigir nada
        if self.is_bound and self.data.get(self.add_prefix("DELETE")):
            for f in self.fields.values():
                f.required = False

        # Iniciales desde instancia
        inst = self.instance
        if inst and inst.pk and (inst.tipo or "").lower() == "game":
            data = inst.datos or {}
            kind = data.get("kind") or "dragmatch"
            self.fields["game_kind"].initial = kind if kind in ALLOWED_KINDS else "dragmatch"
            self.fields["game_time_limit"].initial = data.get("timeLimit") or data.get("time_limit") or 60
            try:
                self.fields["game_pairs"].initial = json.dumps(data, ensure_ascii=False, indent=2)
            except Exception:
                self.fields["game_pairs"].initial = "{}"

    def clean(self):
        cleaned = super().clean()

        # Si está marcado para borrar, no validar
        if (self.data.get(self.add_prefix("DELETE")) or
                self.cleaned_data.get("DELETE")):
            for f in self.fields.values():
                f.required = False
            self.instance.tipo = "game"
            self.instance.datos = {"__deleted__": True}
            return cleaned

        kind = _norm_kind(self.cleaned_data.get("game_kind") or "")
        if kind not in ALLOWED_KINDS:
            raise ValidationError(f"Tipo de juego no soportado: {kind}")

        raw_json = (self.cleaned_data.get("game_pairs") or "").strip()
        try:
            payload = json.loads(raw_json) if raw_json else {}
        except Exception:
            raise ValidationError("El contenido del juego no es un JSON válido.")

        datos: Dict[str, Any] = {"kind": kind}
        tl = self.cleaned_data.get("game_time_limit")
        if tl:
            datos["timeLimit"] = int(tl)

        def _require(cond: bool, msg: str):
            if not cond:
                raise ValidationError(msg)

        if kind in {"dragmatch", "memory"}:
            pairs = payload.get("pairs")
            ok_pairs = isinstance(pairs, list) and len(pairs) >= 1 and all(
                isinstance(pair, list) and len(pair) == 2 and str(pair[0]).strip() and str(pair[1]).strip()
                for pair in pairs
            )
            _require(ok_pairs, "Debes definir al menos 1 par válido (A y B).")
            datos["pairs"] = pairs

        elif kind == "trivia":
            qs = payload.get("questions")
            _require(isinstance(qs, list) and len(qs) >= 1, "Agrega al menos 1 pregunta.")
            for q in qs:
                _require(
                    isinstance(q, dict) and str(q.get("q", "")).strip()
                    and isinstance(q.get("opts"), list) and len(q["opts"]) >= 2
                    and all(str(o).strip() for o in q["opts"]),
                    "Cada pregunta debe tener texto y ≥2 opciones."
                )
                if "ans" in q:
                    _require(isinstance(q["ans"], int) and 0 <= q["ans"] < len(q["opts"]), "Índice 'ans' fuera de rango.")
            datos["questions"] = qs

        elif kind == "classify":
            cats = payload.get("categories") or []
            items = payload.get("items") or []
            _require(isinstance(cats, list) and len(cats) >= 2, "Define al menos 2 categorías.")
            _require(isinstance(items, list) and len(items) > 0, "Agrega ítems para clasificar.")
            datos["categories"] = cats
            datos["items"] = items

        elif kind == "cloze":
            txt = str(payload.get("text") or "")
            ans = payload.get("answers") or []
            _require(txt != "", "Escribe el texto base para cloze.")
            holes = txt.count("___")
            if holes > 0:
                _require(isinstance(ans, list) and len(ans) == holes,
                         "La cantidad de respuestas debe coincidir con los huecos ___.")
            datos["text"] = txt
            datos["answers"] = ans
            if "bank" in payload:
                datos["bank"] = payload.get("bank") or []

        elif kind == "ordering":
            steps = payload.get("steps") or []
            _require(isinstance(steps, list) and len(steps) >= 2 and all(str(s).strip() for s in steps),
                     "Agrega al menos 2 pasos.")
            datos["steps"] = steps

        elif kind == "vf":
            items = payload.get("items") or []
            _require(isinstance(items, list) and len(items) >= 1, "Agrega al menos 1 afirmación.")
            datos["items"] = items

        elif kind in {"labyrinth", "shop"}:
            datos.update(payload or {})

        self.instance.tipo = "game"
        self.instance.datos = datos
        return cleaned

    def save(self, commit: bool = True):
        inst = super().save(commit=False)
        inst.tipo = "game"
        if commit:
            inst.save()
        return inst


# ---------------------------------------------------------
# Formset — can_delete True (Django añade el campo DELETE automáticamente)
# ---------------------------------------------------------
class ItemInlineFormSet(BaseInlineFormSet):
    def clean(self):
        super().clean()
        for form in self.forms:
            if form.cleaned_data.get("DELETE"):
                form._errors.clear()

ItemFormSet = inlineformset_factory(
    Actividad, ItemActividad,
    form=ItemForm,
    formset=ItemInlineFormSet,
    extra=0,
    can_delete=True,
)