# LevelUp/forms.py
from typing import Any, Dict
import json

from django import forms
from django.core.exceptions import ValidationError
from django.contrib.auth.forms import (
    UserCreationForm, PasswordChangeForm, PasswordResetForm
)
from django.contrib.auth import get_user_model

from .models import Actividad, ItemActividad, Curso, Asignatura, AsignacionDocente, Matricula, Estudiante
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
        user.username   = username
        user.email      = email
        user.first_name = self.cleaned_data["first_name"]
        user.last_name  = self.cleaned_data["last_name"]
        user.rut        = self.cleaned_data["rut"]
        user.rol        = self.cleaned_data["rol"]
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
    first_name = forms.CharField(label="Nombre", max_length=30, widget=forms.TextInput(attrs={"class": "form-input"}))
    last_name  = forms.CharField(label="Apellido", max_length=30, widget=forms.TextInput(attrs={"class": "form-input"}))
    email      = forms.EmailField(label="Email", max_length=128, widget=forms.EmailInput(attrs={"class": "form-input"}))
    rut        = forms.CharField(label="RUT", max_length=12, widget=forms.TextInput(attrs={"class": "form-input","placeholder":"12.345.678-9"}))

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
# Crear Curso 
# ==============================
class CursoForm(forms.ModelForm):
    class Meta:
        model = Curso
        fields = ("nivel", "letra")
        widgets = {
            "nivel": forms.NumberInput(attrs={"class":"form-control", "min":1, "max":8}),
            "letra": forms.TextInput(attrs={"class":"form-control", "maxlength":1}),
        }

    def clean(self):
        data = super().clean()
        if Curso.objects.filter(nivel=data.get("nivel"), letra=data.get("letra")).exists():
            raise forms.ValidationError("Ese curso ya existe.")
        return data

# ==============================
# Crar Asignatura
# ==============================
class AsignaturaForm(forms.ModelForm):
    class Meta:
        model = Asignatura
        fields = ("nombre", "codigo")
        widgets = {
            "nombre": forms.TextInput(attrs={"class":"form-control"}),
            "codigo": forms.TextInput(attrs={"class":"form-control"}),
        }

    def clean_codigo(self):
        c = (self.cleaned_data.get("codigo") or "").strip()
        if Asignatura.objects.filter(codigo__iexact=c).exists():
            raise forms.ValidationError("Ya existe una asignatura con ese código.")
        return c

# ==============================
# Asignar Asignatura a Docente
# ==============================
class AsignacionDocenteForm(forms.ModelForm):
    profesor = forms.ModelChoiceField(
        queryset=Usuario.objects.filter(rol=Usuario.Rol.DOCENTE),
        widget=forms.Select(attrs={"class":"form-select"})
    )
    class Meta:
        model = AsignacionDocente
        fields = ("profesor", "asignatura")
        widgets = {"asignatura": forms.Select(attrs={"class":"form-select"})}


# ==============================
# Asignar Curso a Estudiante
# ==============================
class MatriculaForm(forms.ModelForm):
    """
    Matricula un USUARIO con rol ESTUDIANTE en un Curso.
    NOTA: no incluimos 'fecha' porque es auto_now_add (no editable).
    """
    estudiante = forms.ModelChoiceField(
        queryset=Usuario.objects.filter(rol=Usuario.Rol.ESTUDIANTE),
        widget=forms.Select(attrs={"class": "form-select"})
    )

    class Meta:
        model = Matricula
        fields = ("estudiante", "curso")   
        widgets = {
            "curso": forms.Select(attrs={"class": "form-select"}),
        }

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
# Ítems (Game Builder) — helpers y ItemForm (builder)
# ---------------------------------------------------------
# Mantén aquí tus helpers/constants usados por ItemForm (builder).
ALLOWED_KINDS = {
    "dragmatch", "memory", "trivia", "classify", "cloze", "ordering", "vf", "labyrinth", "shop",
}
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

def _norm_kind(s: str) -> str:
    return (s or "").strip().lower()


# forms.py — ItemForm (solo videojuego)

from django import forms
from django.core.exceptions import ValidationError
from .models import ItemActividad

# Se asume que ya tienes definidos:
# - GAME_KIND_CHOICES
# - ALLOWED_KINDS
# - _norm_kind(s: str) -> str

class ItemForm(forms.ModelForm):
    """
    Form único que permite crear/editar:
      - Ítems de juego (tipo='game') usando tu builder (game_kind, game_pairs, etc.)
      - Ítem de configuración del juego (tipo='game_config') pegando JSON en el mismo textarea (game_pairs)
    """
    # Controles del builder (ya existían)
    game_kind = forms.ChoiceField(
        label="Tipo de juego",
        choices=GAME_KIND_CHOICES,
        required=False,  # <- ahora condicional según 'tipo'
        widget=forms.Select(attrs={"class": "form-select"})
    )
    game_time_limit = forms.IntegerField(
        label="Tiempo límite (s)",
        required=False, min_value=5, max_value=3600, initial=60,
        widget=forms.NumberInput(attrs={"class": "form-control"})
    )
    # Este textarea seguirá siendo el "JSON pegado" del builder
    # y también servirá para el JSON de game_config
    game_pairs = forms.CharField(
        label="Datos (JSON)",
        required=False,
        widget=forms.Textarea(attrs={"rows": 6, "class": "form-control"})
    )

    class Meta:
        model = ItemActividad
        fields = ["tipo", "enunciado", "puntaje"]
        widgets = {
            # AHORA visible: el profe podrá elegir 'game' o 'game_config'
            "tipo": forms.Select(attrs={"class": "form-select"}),
            "enunciado": forms.Textarea(attrs={
                "class": "form-control", "rows": 2,
                "placeholder": "Describe qué debe hacer el alumno… (opcional)"
            }),
            "puntaje": forms.NumberInput(attrs={"class": "form-control", "min": "0"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # Limita choices visibles solo a lo que usamos en el builder del juego:
        self.fields["tipo"].choices = [
            (ItemActividad.ItemType.GAME, "Juego"),
            ("game_config", "Juego • Configuración"),
        ]

        inst = self.instance
        tipo_inst = (inst.tipo or "").lower() if inst and inst.pk else None

        # Precargar iniciales desde instancia existente
        if inst and inst.pk:
            data = inst.datos or {}
            # Si es game -> pre-cargar builder
            if tipo_inst == "game":
                kind = (data.get("kind") or "dragmatch").lower()
                self.fields["game_kind"].initial = kind if kind in ALLOWED_KINDS else "dragmatch"
                self.fields["game_time_limit"].initial = data.get("timeLimit") or data.get("time_limit") or 60
                try:
                    self.fields["game_pairs"].initial = json.dumps(data, ensure_ascii=False, indent=2)
                except Exception:
                    self.fields["game_pairs"].initial = "{}"

            # Si es game_config -> volcar JSON a la misma caja
            elif tipo_inst == "game_config":
                try:
                    self.fields["game_pairs"].initial = json.dumps(data, ensure_ascii=False, indent=2)
                except Exception:
                    self.fields["game_pairs"].initial = "{}"

        # Si viene vacío (nuevo ítem), sugiere 'game' por defecto
        if not tipo_inst and not self.initial.get("tipo"):
            self.fields["tipo"].initial = ItemActividad.ItemType.GAME

        # Si el form está marcado para eliminar en el formset, baja requisitos
        if self.is_bound and self.data.get(self.add_prefix("DELETE")):
            for f in self.fields.values():
                f.required = False

    def clean(self):
        cleaned = super().clean()
        tipo = (cleaned.get("tipo") or "").lower()
        raw_json = (cleaned.get("game_pairs") or "").strip()

        # Si está marcado para borrar, no validamos y guardamos marca
        if (self.data.get(self.add_prefix("DELETE")) or self.cleaned_data.get("DELETE")):
            for f in self.fields.values():
                f.required = False
            # No tocamos datos; la vista/formset decidirá
            return cleaned

        # ---- Caso 1: ÍTEM DE JUEGO (game) ----
        if tipo == "game":
            # Validar y construir 'datos' desde el builder
            try:
                payload = json.loads(raw_json) if raw_json else {}
            except Exception:
                raise ValidationError("El contenido del juego no es un JSON válido.")

            datos: Dict[str, Any] = {}
            kind = _norm_kind(self.cleaned_data.get("game_kind") or payload.get("kind") or "")
            if kind not in ALLOWED_KINDS:
                raise ValidationError(f"Tipo de juego no soportado: {kind or '(vacío)'}")
            datos["kind"] = kind

            tl = self.cleaned_data.get("game_time_limit") or payload.get("timeLimit") or payload.get("time_limit")
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
                    cond = (
                        isinstance(q, dict)
                        and isinstance(q.get("opts"), list) and len(q["opts"]) >= 2
                        and str(q.get("q", "")).strip() != ""
                        and all(str(o).strip() for o in q["opts"])
                    )
                    _require(cond, "Cada pregunta debe tener texto y ≥2 opciones.")
                    if "ans" in q:
                        _require(isinstance(q["ans"], int) and 0 <= q["ans"] < len(q["opts"]),
                                 "Índice 'ans' fuera de rango.")
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

            elif kind in {"labyrinth", "shop"}:
                # Passthrough controlado
                datos.update(payload or {})

            # Guardar en la instancia
            self.instance.tipo = "game"
            self.instance.datos = datos
            # enunciado/puntaje vienen del form
            return cleaned

        # ---- Caso 2: CONFIGURACIÓN DEL JUEGO (game_config) ----
        if tipo == "game_config":
            # El Docente pega aquí el JSON de config (usamos el mismo textarea)
            try:
                cfg = json.loads(raw_json) if raw_json else {}
            except Exception:
                raise ValidationError("El JSON de configuración no es válido.")

            # Validaciones mínimas
            mapping = (cfg.get("mapping_mode") or "id").lower()
            if mapping not in ("id", "index"):
                raise ValidationError('mapping_mode debe ser "id" o "index".')

            if "fallback_opts" in cfg:
                if not isinstance(cfg["fallback_opts"], list) or len(cfg["fallback_opts"]) < 2:
                    raise ValidationError("fallback_opts debe ser una lista con ≥ 2 opciones.")

            if "fallback_correct" in cfg:
                if not isinstance(cfg["fallback_correct"], int) or cfg["fallback_correct"] < 0:
                    raise ValidationError("fallback_correct debe ser un entero ≥ 0 (0-based).")

            # Si el enunciado está vacío, etiqueta por defecto
            if not (cleaned.get("enunciado") or "").strip():
                cleaned["enunciado"] = "Configuración del minijuego"

            # Guardar en la instancia
            self.instance.tipo = "game_config"
            self.instance.datos = cfg
            # puntaje puede ignorarse o mantenerse; lo dejamos tal cual
            return cleaned

        # ---- Otros tipos: no permitidos en este builder ----
        raise ValidationError("Este editor solo soporta ítems de tipo 'game' o 'game_config'.")

    def save(self, commit: bool = True):
        inst = super().save(commit=False)
        # 'tipo' y 'datos' se establecen en clean() según el caso
        if commit:
            inst.save()
        return inst
