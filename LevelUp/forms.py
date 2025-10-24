from django import forms
from django.contrib.auth.forms import UserCreationForm, PasswordChangeForm, PasswordResetForm
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.forms import inlineformset_factory
from typing import Any, Dict
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


# ==============================
# Actividad (cabecera)
# ==============================
class ActividadForm(forms.ModelForm):
    class Meta:
        model = Actividad
        fields = ["titulo", "descripcion", "tipo", "dificultad",
                  "xp_total", "intentos_max", "es_publicada", "fecha_cierre"]
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
        # Mostrar solo Quiz/Juego en UI (aunque luego tratamos todos como 'game' en ítems)
        self.fields["tipo"].choices = [("quiz", "Quiz"), ("game", "Juego")]


# ==============================
# Ítems (game builder)
# ==============================
def _norm_kind(v: str) -> str:
    s = (v or "").strip().lower()
    if "drag" in s and "match" in s: return "dragmatch"
    if s in ("dragandmatch",): return "dragmatch"
    if "memoria" in s: return "dragmatch"
    if "clasific" in s: return "classify"
    if "cloze" in s or "completar" in s or "espacio" in s: return "cloze"
    if "orden" in s or s == "ordening": return "ordering"
    if s == "vf" or "verdadero" in s or "falso" in s: return "vf"
    if "laberinto" in s: return "labyrinth"
    if "tiend" in s or "precio" in s or s == "shop": return "shop"
    if "trivia" in s: return "trivia"
    return s

GAME_KIND_CHOICES = [
    ("dragmatch",  "Drag & Match / Memoria"),
    ("trivia",     "Trivia (opción múltiple)"),
    ("vf",         "Verdadero / Falso"),
    ("classify",   "Clasificar en categorías"),
    ("cloze",      "Completar (cloze)"),
    ("ordering",   "Ordenar pasos"),
    ("labyrinth",  "Laberinto de puertas"),
    ("shop",       "Tiendita (precios)"),
]

class ItemForm(forms.ModelForm):
    # Campos “virtuales” del builder
    game_kind = forms.ChoiceField(
        label="Tipo de juego",
        choices=GAME_KIND_CHOICES,
        required=True,
        widget=forms.Select(attrs={"class": "form-select"})  # <— Bootstrap
    )
    game_time_limit = forms.IntegerField(
        label="Tiempo límite (s)",
        required=False,
        min_value=5,
        max_value=3600,
        initial=60,
        widget=forms.NumberInput(attrs={"class": "form-control"})  # <— Bootstrap
    )
    game_pairs = forms.CharField(
        label="(Avanzado) Texto del contenido", required=False,
        widget=forms.Textarea(attrs={"rows": 6, "class": "form-control"})
    )

    class Meta:
        model = ItemActividad
        fields = ["tipo", "enunciado", "puntaje"]
        widgets = {
            "tipo": forms.HiddenInput(),
            "enunciado": forms.Textarea(attrs={
                "class": "form-control",
                "rows": 2,
                "placeholder": "Describe qué debe hacer el alumno…",
            }),
            "puntaje": forms.NumberInput(attrs={"class": "form-control", "min": "0"}),
        }

    # ---------- Inicialización (edición) ----------
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        inst = self.instance
        if inst and inst.pk and (inst.tipo or "").lower() == "game":
            data = inst.datos or {}
            kind = data.get("kind") or ""
            time_limit = data.get("timeLimit") or data.get("time_limit")
            payload: Dict[str, Any] = {}

            if kind == "dragmatch":
                payload = {"kind": "dragmatch", "pairs": data.get("pairs") or []}
            elif kind == "trivia":
                payload = {"kind": "trivia", "questions": data.get("questions") or []}
            elif kind == "classify":
                payload = {"kind": "classify", "categories": data.get("categories") or [], "items": data.get("items") or []}
            elif kind == "cloze":
                payload = {"kind": "cloze", "text": data.get("text") or "", "answers": data.get("answers") or [], "bank": data.get("bank") or []}
            elif kind == "ordering":
                payload = {"kind": "ordering", "steps": data.get("steps") or []}
            elif kind == "vf":
                payload = {"kind": "vf", "items": data.get("items") or []}
            elif kind == "labyrinth":
                payload = {"kind": "labyrinth", "steps": data.get("steps") or []}
            elif kind == "shop":
                payload = {"kind": "shop", "products": data.get("products") or []}

            self.fields["game_kind"].initial = kind or "dragmatch"
            self.fields["game_time_limit"].initial = time_limit or 60
            self.fields["game_pairs"].initial = json.dumps(payload, ensure_ascii=False, indent=2)

    # ---------- Validación / mapeo a .datos ----------
    def clean(self):
        cleaned = super().clean()

        # si está marcado para borrar, no validar contenido
        if self.cleaned_data.get("DELETE"):
            return cleaned

        raw_kind = self.cleaned_data.get("game_kind") or ""
        kind = _norm_kind(raw_kind)
        raw_json = (self.cleaned_data.get("game_pairs") or "").strip()
        time_limit = self.cleaned_data.get("game_time_limit")

        if not kind:
            raise ValidationError("Selecciona el tipo de juego.")
        if not raw_json:
            raise ValidationError("Completa el contenido o pega el JSON del juego.")

        try:
            payload = json.loads(raw_json)
        except Exception:
            raise ValidationError("El contenido del juego no es un JSON válido.")

        datos: Dict[str, Any] = {"kind": kind}
        if time_limit:
            datos["timeLimit"] = int(time_limit)

        def _require(cond: bool, msg: str):
            if not cond:
                raise ValidationError(msg)

        if kind == "dragmatch":
            pairs = payload.get("pairs")
            _require(isinstance(pairs, list) and len(pairs) >= 1 and all(
                isinstance(p, list) and len(p) == 2 and str(p[0]).strip() and str(p[1]).strip() for p in pairs
            ), "Debes definir al menos 1 par válido (A|B) para Drag & Match.")
            datos["pairs"] = pairs

        elif kind == "trivia":
            questions = payload.get("questions")
            _require(isinstance(questions, list) and len(questions) >= 1, "Agrega al menos 1 pregunta.")
            for q in questions:
                _require(
                    isinstance(q, dict) and str(q.get("q", "")).strip()
                    and isinstance(q.get("opts"), list) and len(q["opts"]) >= 2
                    and all(str(o).strip() for o in q["opts"]),
                    "Cada pregunta de Trivia debe tener texto y ≥2 opciones no vacías."
                )
                if "ans" in q:
                    _require(isinstance(q["ans"], int) and 0 <= q["ans"] < len(q["opts"]), "Índice 'ans' fuera de rango.")
            datos["questions"] = questions

        elif kind == "classify":
            cats = payload.get("categories") or []
            items = payload.get("items") or []
            _require(isinstance(cats, list) and len(cats) >= 2, "Define al menos 2 categorías.")
            _require(isinstance(items, list) and len(items) > 0, "Agrega ítems para clasificar.")
            datos["categories"] = cats
            datos["items"] = items

        elif kind == "cloze":
            txt = str(payload.get("text") or "")
            answers = payload.get("answers") or []
            _require(txt != "", "Escribe el texto base para cloze.")
            holes = txt.count("___")
            if holes > 0:
                _require(isinstance(answers, list) and len(answers) == holes, "La cantidad de respuestas debe coincidir con los huecos ___.")
            datos["text"] = txt
            datos["answers"] = answers
            if "bank" in payload:
                datos["bank"] = payload.get("bank") or []

        elif kind == "ordering":
            steps = payload.get("steps") or []
            _require(isinstance(steps, list) and len(steps) >= 2 and all(str(s).strip() for s in steps),
                     "Agrega al menos 2 pasos para ordenar.")
            datos["steps"] = steps

        elif kind == "vf":
            items = payload.get("items") or []
            _require(
                isinstance(items, list)
                and len(items) >= 1
                and all(
                    isinstance(i, dict)
                    and str(i.get("text", "")).strip()
                    and ("is_true" in i)
                    for i in items
                ),
                "Agrega al menos 1 afirmación con su valor Verdadero/Falso.",
            )
            datos["items"] = items

        elif kind == "labyrinth":
            steps = payload.get("steps") or []
            _require(isinstance(steps, list) and len(steps) >= 1, "Agrega al menos 1 paso del laberinto.")
            datos["steps"] = steps

        elif kind == "shop":
            products = payload.get("products") or []
            _require(
                isinstance(products, list)
                and len(products) >= 1
                and all(
                    isinstance(p, dict)
                    and str(p.get("name", "")).strip()
                    and ("price" in p)
                    for p in products
                ),
                "Agrega al menos 1 producto con nombre y precio.",
            )
            datos["products"] = products

        else:
            raise ValidationError(f"Tipo de juego no soportado: {kind}")

        # Guardar en la instancia
        self.instance.tipo = "game"
        self.instance.datos = datos
        return cleaned

    def save(self, commit: bool = True):
        inst = super().save(commit=False)
        inst.tipo = "game"
        if commit:
            inst.save()
        return inst


ItemFormSet = inlineformset_factory(
    parent_model=Actividad,
    model=ItemActividad,
    form=ItemForm,
    extra=0,
    can_delete=True,
)
