from django import forms
from django.contrib.auth.forms import UserCreationForm, PasswordChangeForm, PasswordResetForm
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.forms import inlineformset_factory
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
        # username desde el email
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
        user.rut = self.cleaned_data["rut"]          # ya normalizado por clean_rut
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
        # proteger backend: conservar el RUT original
        return getattr(self.instance, "rut", self.initial.get("rut", ""))


class ProfilePasswordForm(PasswordChangeForm):
    old_password  = forms.CharField(label="Contraseña actual", widget=forms.PasswordInput(attrs={"class":"form-input"}))
    new_password1 = forms.CharField(label="Nueva contraseña", widget=forms.PasswordInput(attrs={"class":"form-input"}), help_text="")
    new_password2 = forms.CharField(label="Confirmar nueva contraseña", widget=forms.PasswordInput(attrs={"class":"form-input"}), help_text="")


# ==============================
# Actividades (contenedor)
# ==============================
class ActividadForm(forms.ModelForm):
    class Meta:
        model = Actividad
        fields = ["titulo","descripcion","tipo","dificultad","recurso","recompensa","es_publicada","fecha_cierre","xp_total","intentos_max"]
        widgets = {
            "titulo": forms.TextInput(attrs={"class":"form-control"}),
            "descripcion": forms.Textarea(attrs={"class":"form-control","rows":3}),
            "tipo": forms.Select(attrs={"class":"form-select"}),
            "dificultad": forms.Select(attrs={"class":"form-select"}),
            "recurso": forms.Select(attrs={"class":"form-select"}),
            "recompensa": forms.Select(attrs={"class":"form-select"}),
            "es_publicada": forms.CheckboxInput(attrs={"class":"form-check-input"}),
            "fecha_cierre": forms.DateTimeInput(attrs={"class":"form-control","type":"datetime-local"}),
            "xp_total": forms.NumberInput(attrs={"class":"form-control","min":"0"}),
            "intentos_max": forms.NumberInput(attrs={"class":"form-control","min":"1","max":"20"}),
        }


# ==============================
# Ítems de actividad (incluye Juego/Interactivo)
# ==============================
# ... imports de arriba ...
import json  # <-- asegúrate de tener este import

class ItemActividadForm(forms.ModelForm):
    # --- MCQ (opcional) ---
    alt_1 = forms.CharField(label="Alternativa A", required=False, widget=forms.TextInput(attrs={"class":"form-control"}))
    alt_2 = forms.CharField(label="Alternativa B", required=False, widget=forms.TextInput(attrs={"class":"form-control"}))
    alt_3 = forms.CharField(label="Alternativa C", required=False, widget=forms.TextInput(attrs={"class":"form-control"}))
    alt_4 = forms.CharField(label="Alternativa D", required=False, widget=forms.TextInput(attrs={"class":"form-control"}))
    alt_5 = forms.CharField(label="Alternativa E", required=False, widget=forms.TextInput(attrs={"class":"form-control"}))
    alt_6 = forms.CharField(label="Alternativa F", required=False, widget=forms.TextInput(attrs={"class":"form-control"}))

    allow_multiple = forms.BooleanField(label="Permitir múltiples correctas", required=False, widget=forms.CheckboxInput(attrs={"class":"form-check-input"}))
    correcta = forms.ChoiceField(label="¿Cuál es la correcta? (si no usas múltiples)", required=False,
                                 choices=[("1","A"),("2","B"),("3","C"),("4","D"),("5","E"),("6","F")],
                                 widget=forms.RadioSelect(attrs={"class":"form-check-input"}))
    correctas_multi = forms.MultipleChoiceField(label="Marca las correctas (si usas múltiples)", required=False,
                                 choices=[("1","A"),("2","B"),("3","C"),("4","D"),("5","E"),("6","F")],
                                 widget=forms.CheckboxSelectMultiple(attrs={"class":"form-check-input"}))

    # --- TF ---
    tf_respuesta = forms.ChoiceField(label="Respuesta (Verdadero/Falso)", required=False,
                                     choices=[("true","Verdadero"),("false","Falso")],
                                     widget=forms.RadioSelect(attrs={"class":"form-check-input"}))

    # --- FIB ---
    fib_respuestas = forms.CharField(label="Respuestas aceptadas (una por línea)", required=False,
                                     widget=forms.Textarea(attrs={"class":"form-control","rows":3}),
                                     help_text="Se aceptará cualquiera; puedes poner '4' y 'cuatro'.")
    fib_case_insensitive = forms.BooleanField(label="Ignorar mayúsculas/minúsculas", required=False, initial=True,
                                              widget=forms.CheckboxInput(attrs={"class":"form-check-input"}))

    # --- SORT ---
    sort_items = forms.CharField(label="Elementos a ordenar (uno por línea, en el orden correcto)", required=False,
                                 widget=forms.Textarea(attrs={"class":"form-control","rows":4}),
                                 help_text="El orden que ingreses aquí se considera el correcto.")

    # --- MATCH ---
    match_left  = forms.CharField(label="Columna izquierda (uno por línea)", required=False,
                                  widget=forms.Textarea(attrs={"class":"form-control","rows":4}))
    match_right = forms.CharField(label="Columna derecha (uno por línea, mismo número de líneas que izquierda)", required=False,
                                  widget=forms.Textarea(attrs={"class":"form-control","rows":4}))

    # --- TEXT ---
    text_keywords = forms.CharField(label="Palabras clave (opcional, separadas por coma)", required=False,
                                    widget=forms.TextInput(attrs={"class":"form-control"}))
    text_minlen   = forms.IntegerField(label="Largo mínimo (opcional)", required=False, min_value=0,
                                       widget=forms.NumberInput(attrs={"class":"form-control"}))

    # --- INTERACTIVE (embed) ---
    ext_url = forms.URLField(label="URL del recurso (embed)", required=False, widget=forms.URLInput(attrs={"class":"form-control"}))
    ext_provider = forms.CharField(label="Proveedor (ej: itch.io, youtube, genially)", required=False, widget=forms.TextInput(attrs={"class":"form-control"}))

    # --- GAME BUILDER (unificado) ---
    GAME_CHOICES = [
        ("memory",    "Memoria (Parejas)"),
        ("dragmatch", "Arrastrar y Soltar"),
        ("trivia",    "Trivia"),
        # nuevos (todos juntos, sin categorías)
        ("ordering",  "Ordena la secuencia"),
        ("classify",  "Clasifica en canastas"),
        ("cloze",     "Cloze (rellena huecos)"),
        ("vf",        "Verdadero/Falso (+ justificación)"),
        ("labyrinth", "Laberinto de puertas"),
        ("shop",      "Tiendita (Matemáticas)"),
    ]
    game_kind = forms.ChoiceField(label="Tipo de juego", required=False,
                                  choices=GAME_CHOICES,
                                  widget=forms.Select(attrs={"class":"form-select"}))
    game_time_limit = forms.IntegerField(label="Tiempo límite (s)", required=False, min_value=0, initial=60,
                                         widget=forms.NumberInput(attrs={"class":"form-control"}))
    # El builder/JSON editor escribe aquí
    game_pairs = forms.CharField(label="(Avanzado) Texto del contenido", required=False,
                                 widget=forms.Textarea(attrs={"class":"form-control","rows":6}))

    class Meta:
        model = ItemActividad
        fields = ["tipo","enunciado","puntaje","imagen"]
        labels = {"enunciado":"Enunciado / Consigna"}
        widgets = {
            "tipo": forms.Select(attrs={"class":"form-select"}),
            "enunciado": forms.Textarea(attrs={"class":"form-control","rows":2,"placeholder":"Describe qué debe hacer el alumno…"}),
            "puntaje": forms.NumberInput(attrs={"class":"form-control","min":"0"}),
            "imagen": forms.ClearableFileInput(attrs={"class":"form-control"}),
        }

    # ---------- utilidades ----------
    def _looks_like_json(self, txt: str) -> bool:
        return bool(txt and txt.strip() and txt.strip()[0] in "{[")

    def _parse_pairs_text(self, raw: str):
        out = []
        for ln in (raw or "").splitlines():
            ln = (ln or "").strip()
            if not ln: continue
            parts = [x.strip() for x in ln.split("|")]
            if len(parts) >= 2 and parts[0] and parts[1]:
                out.append([parts[0], parts[1]])
        return out

    def _parse_trivia_text(self, raw: str):
        out = []
        for ln in (raw or "").splitlines():
            ln = (ln or "").strip()
            if not ln: continue
            parts = [x.strip() for x in ln.split("|") if x.strip()]
            if len(parts) < 3: continue
            q = parts[0]; rest = parts[1:]
            ans = 0; opts = []
            for i, t in enumerate(rest):
                if t.endswith("*"): ans = i; t = t[:-1].strip()
                opts.append(t)
            out.append({"q": q, "opts": opts, "ans": ans})
        return out

    # ---------- precarga (edición) ----------
    def _load_ext_initial(self, datos):
        if "url" in datos: self.fields["ext_url"].initial = datos["url"]
        if "proveedor" in datos: self.fields["ext_provider"].initial = datos["proveedor"]

    def _load_game_initial(self, datos):
        if "kind" in datos:
            self.fields["game_kind"].initial = datos["kind"]
        if "time_limit" in datos:
            self.fields["game_time_limit"].initial = datos.get("time_limit") or 60
        elif "timeLimit" in datos:
            self.fields["game_time_limit"].initial = datos.get("timeLimit") or 60

        # Si viene texto guardado, respétalo
        if datos.get("text"):
            self.fields["game_pairs"].initial = datos["text"]; return

        # Pares o Trivia → serializar a texto plano
        if datos.get("pairs"):
            self.fields["game_pairs"].initial = "\n".join(f"{a}|{b}" for a,b in datos["pairs"]); return
        if datos.get("trivia") or datos.get("questions"):
            qs = datos.get("trivia") or datos.get("questions") or []
            lines = []
            for q in qs:
                ans = q.get("ans") or 0
                opts = [f"{t}{'*' if i==ans else ''}" for i,t in enumerate(q.get("opts", []))]
                lines.append(" | ".join([q.get("q","")] + opts))
            self.fields["game_pairs"].initial = "\n".join(lines); return

        # Cualquier otro contenido → mostrar JSON completo
        self.fields["game_pairs"].initial = json.dumps(datos, ensure_ascii=False, indent=2)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        datos = getattr(self.instance, "datos", {}) or {}
        t = ((getattr(self.instance, "tipo", "") or "").lower()) or (self.data.get("tipo", "").lower())
        if self.instance and self.instance.pk and datos:
            if t == "interactive":
                self._load_ext_initial(datos)
            elif t == "game":
                self._load_game_initial(datos)

    # ---------- validación unificada ----------
    def clean(self):
        cleaned = super().clean()
        t = (cleaned.get("tipo") or "").lower()

        # INTERACTIVE
        if t == "interactive":
            url = (cleaned.get("ext_url") or "").strip()
            if not url:
                raise forms.ValidationError("Ingresa la URL del recurso a embeber.")
            prov = (cleaned.get("ext_provider") or "").strip()
            cleaned["_datos_payload"] = {"url": url, "proveedor": prov}
            return cleaned

        # GAME (unificado)
        if t == "game":
            kind = (cleaned.get("game_kind") or "").lower()
            if not kind:
                raise forms.ValidationError("Selecciona el tipo de juego.")
            time_limit = int(cleaned.get("game_time_limit") or 0) or 0
            raw = (cleaned.get("game_pairs") or "").strip()

            payload = {}

            # 1) Si parece JSON, úsalo tal cual para cualquier tipo
            if self._looks_like_json(raw):
                try:
                    payload = json.loads(raw)
                except json.JSONDecodeError:
                    raise forms.ValidationError("JSON inválido en “(Avanzado) Texto del contenido”.")
            else:
                # 2) Texto plano de respaldo para tipos que lo soportan
                if kind in {"memory","dragmatch"}:
                    pairs = self._parse_pairs_text(raw)
                    if not pairs:
                        raise forms.ValidationError("Agrega al menos 1 par usando el formato A|B (uno por línea).")
                    payload["pairs"] = pairs
                    payload["text"] = raw
                elif kind == "trivia":
                    trivia = self._parse_trivia_text(raw)
                    if not trivia:
                        raise forms.ValidationError("Agrega al menos 1 pregunta: Pregunta | Opción1 | Opción2* | Opción3 …")
                    payload["trivia"] = trivia
                    payload["text"] = raw
                else:
                    # Los demás tipos requieren JSON si no hay texto válido
                    raise forms.ValidationError("Para este tipo, pega o edita el contenido en formato JSON en “(Avanzado) Texto del contenido”.")

            # 3) Normalizar metadatos comunes
            payload["kind"] = kind
            payload["timeLimit"] = time_limit

            cleaned["_datos_payload"] = payload
            return cleaned

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