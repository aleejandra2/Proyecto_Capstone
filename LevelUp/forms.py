# LevelUp/forms.py
from typing import Any, Dict
import json

from django import forms
from django.core.exceptions import ValidationError
from django.contrib.auth.forms import (
    UserCreationForm, PasswordChangeForm, PasswordResetForm
)
from django.forms import BaseInlineFormSet
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
        fields = ("nombre", "slug", "icono")
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
        
# =====================================================
# Formulario ADMIN para editar usuarios (docentes/alumnos)
# =====================================================
class AdminUsuarioForm(forms.ModelForm):
    class Meta:
        model = Usuario
        fields = ("first_name", "last_name", "email")
        widgets = {
            "first_name": forms.TextInput(attrs={"class": "form-control"}),
            "last_name":  forms.TextInput(attrs={"class": "form-control"}),
            "email":      forms.EmailInput(attrs={"class": "form-control"}),
        }

    def clean_email(self):
        email = (self.cleaned_data.get("email") or "").strip().lower()
        qs = Usuario.objects.filter(email__iexact=email)
        if self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise ValidationError("Este email ya está registrado.")
        return email
    
# ---------------------------------------------------------
# Actividad
# ---------------------------------------------------------
class ActividadForm(forms.ModelForm):
    intentos_ilimitados = forms.BooleanField(
        required=False,
        label="Intentos ilimitados",
        widget=forms.CheckboxInput(attrs={"class": "form-check-input", "id": "id_intentos_ilimitados"}),
        help_text="Si está activo, se ignora 'Intentos máximos'."
    )

    # 👇 CLAVE: que NO sea requerido aquí
    intentos_max = forms.IntegerField(
        required=False,
        min_value=1,
        max_value=1000,
        widget=forms.NumberInput(attrs={
            "class": "form-control",
            "min": "1",
            "max": "1000",
            "id": "id_intentos_max"
        })
    )
    
    tipo = forms.ChoiceField(
        choices=[("quiz", "Quiz")],
        widget=forms.Select(attrs={"class": "form-select", "id": "id_tipo"})
    )
    class Meta:
        model = Actividad
        fields = [
            "titulo", "descripcion", "tipo", "dificultad",
            "intentos_ilimitados", "intentos_max",
            "es_publicada", "fecha_cierre"
        ]
        widgets = {
            "titulo": forms.TextInput(attrs={"class": "form-control", "id": "id_titulo"}),
            "descripcion": forms.Textarea(attrs={"class": "form-control", "rows": 3}),
            #"tipo": forms.Select(attrs={"class": "form-select", "id": "id_tipo"}),
            "dificultad": forms.Select(attrs={"class": "form-select"}),
            #"xp_total": forms.NumberInput(attrs={"class": "form-control", "min": "0"}),
            "es_publicada": forms.CheckboxInput(attrs={"class": "form-check-input"}),
            "fecha_cierre": forms.DateTimeInput(attrs={"class": "form-control", "type": "datetime-local"}),
        }

    def clean_intentos_max(self):
        ilimitado = bool(self.cleaned_data.get("intentos_ilimitados"))
        val = self.cleaned_data.get("intentos_max")

        if ilimitado:
            # Si es ilimitado, no exigimos valor y devolvemos un sentinel (p.ej. 1)
            # para satisfacer el modelo sin molestar al usuario.
            return val or 1

        # Si NO es ilimitado, ahora sí es obligatorio y con rango 1..1000
        if val is None:
            raise forms.ValidationError("Este campo es obligatorio si no es ilimitado.")
        if not (1 <= int(val) <= 1000):
            raise forms.ValidationError("Debe estar entre 1 y 1000.")
        return val

# ---------------------------------------------------------
# Ítems (Game Builder) — helpers y ItemForm (builder)
# ---------------------------------------------------------

# Tipos de minijuegos para QUIZ
GAME_KIND_CHOICES = [
    ("dragmatch", "Drag & Match"),
    ("memory",    "Memoria (pares)"),
    ("trivia",    "Trivia (opción múltiple)"),
    ("vf",        "Verdadero / Falso"),
    ("classify",  "Clasificar en categorías"),
    ("cloze",     "Completar (cloze)"),
    ("ordering",  "Ordenar pasos"),
    #("labyrinth", "Laberinto de puertas"),
    #("shop",      "Tiendita (precios)"),
]

def _norm(s): return (s or "").strip().lower()

def _parse_pairs_raw(raw: str):
    pairs = []
    for line in (raw or "").splitlines():
        line = line.strip()
        if not line:
            continue
        parts = [p.strip() for p in line.split("|")]
        if len(parts) >= 2 and parts[0] and parts[1]:
            pairs.append([parts[0], parts[1]])
    return pairs

def _parse_trivia_raw(raw: str):
    """Formato: Pregunta | Opción1 | Opción2* | Opción3
       El asterisco marca la correcta."""
    items = []
    for line in (raw or "").splitlines():
        line = line.strip()
        if not line:
            continue
        parts = [p.strip() for p in line.split("|") if p.strip()]
        if len(parts) < 3:
            continue
        q = parts[0]
        ans = 0
        opts = []
        for i, opt in enumerate(parts[1:]):
            if opt.endswith("*"):
                ans = i
                opt = opt[:-1].rstrip()
            opts.append(opt)
        if q and len(opts) >= 2:
            items.append({"q": q, "opts": opts, "ans": ans})
    return items

class ItemInlineFormSet(BaseInlineFormSet):
    """
    Evita que Django trate como 'vacíos' los formularios nuevos
    cuando el builder trae datos (game_pairs/datos).
    Además, exige enunciado y puntaje cuando corresponda.
    """
    
    def add_fields(self, form, index):
        """Override para asegurar que los campos extra se agreguen correctamente"""
        super().add_fields(form, index)
        # Asegurar que el form tenga acceso al tipo de actividad
        if hasattr(self, 'actividad_tipo'):
            form.actividad_tipo = self.actividad_tipo
    
    def full_clean(self):
        """
        Override completo de full_clean para forzar validación de extra_forms con contenido
        """
        # Antes de la validación normal, marcar forms con contenido
        if hasattr(self, 'data') and self.data:
            for i, form in enumerate(self.forms):
                if i >= self.initial_form_count():
                    # Es extra_form
                    prefix = form.prefix
                    payload = self.data.get(f"{prefix}-game_pairs", "").strip()
                    enun = self.data.get(f"{prefix}-enunciado", "").strip()
                    punt = self.data.get(f"{prefix}-puntaje", "").strip()
                    
                    if payload or enun or punt:
                        form.empty_permitted = False
                        print(f"   🔧 full_clean: Form {i} tiene contenido, forzando validación")
        
        # Llamar al full_clean original
        super().full_clean()
    
    def _construct_form(self, i, **kwargs):
        """Override para configurar cada form antes de validación"""
        form = super()._construct_form(i, **kwargs)
        
        # 🔑 CRÍTICO: Para extra_forms con contenido, desactivar empty_permitted
        if i >= self.initial_form_count():
            # Es un extra_form
            if hasattr(self, 'data') and self.data:
                # Verificar si tiene contenido en POST
                prefix = form.prefix
                payload = self.data.get(f"{prefix}-game_pairs", "").strip()
                enun = self.data.get(f"{prefix}-enunciado", "").strip()
                punt = self.data.get(f"{prefix}-puntaje", "").strip()
                
                if payload or enun or punt:
                    form.empty_permitted = False
                    print(f"   🔧 Form {i} ({prefix}): Desactivando empty_permitted")
        
        return form
    
    def clean(self):
        super().clean()
        
        print(f"\n🔍 ItemInlineFormSet.clean() - Validando formset:")
        print(f"   Total forms: {len(self.forms)}")
        print(f"   Errores previos: {any(self.errors)}")
        
        if any(self.errors):
            # Si ya hay errores de validación individual, no agregar más
            print(f"   ⚠️ Hay errores previos, abortando clean()")
            for i, form_errors in enumerate(self.errors):
                if form_errors:
                    print(f"      Form {i}: {form_errors}")
            return

        for i, form in enumerate(self.forms):
            # Si no hay cleaned_data (form ultra vacío) o está marcado para borrar, sáltalo
            if not getattr(form, "cleaned_data", None):
                print(f"   Form {i}: Sin cleaned_data, saltando")
                continue
            if form.cleaned_data.get("DELETE"):
                print(f"   Form {i}: Marcado DELETE, saltando")
                continue

            # Campos del form
            enun = (form.cleaned_data.get("enunciado") or "").strip()
            punt = form.cleaned_data.get("puntaje")

            # Payload del builder (tu CharField oculto)
            payload = (form.cleaned_data.get("game_pairs") or "").strip()
            # A veces lo guardas en otro nombre:
            if not payload:
                payload = (form.cleaned_data.get("datos") or "").strip() if "datos" in form.fields else ""

            tiene_algo = bool(payload or enun or (punt not in (None, "")))
            
            print(f"   Form {i}: tiene_algo={tiene_algo}, enun={len(enun)}, punt={punt}, payload={len(payload)}")

            # 🔑 CLAVE: Si HAY payload del builder, este form NO es vacío
            if payload:
                form.empty_permitted = False
                # Forzar que Django lo considere válido aunque esté en extra_forms
                form.has_changed = lambda: True
                print(f"      → Forzando empty_permitted=False y has_changed=True")

            if tiene_algo:
                # Desactivar empty_permitted para forzar validación
                form.empty_permitted = False
                
                if not enun:
                    form.add_error("enunciado", "Este campo es obligatorio cuando el ítem tiene contenido.")
                    print(f"      → ERROR: Falta enunciado")
                if punt in (None, ""):
                    form.add_error("puntaje", "Este campo es obligatorio cuando el ítem tiene contenido.")
                    print(f"      → ERROR: Falta puntaje")
                    
    def save(self, commit=True):
        """
        Override save para asegurar que TODOS los forms con contenido se guarden,
        incluso los que Django considera 'extra_forms'
        """
        # Primero guardamos normalmente (esto guarda initial forms y algunos extra)
        instances = super().save(commit=False)
        
        # Ahora forzamos el guardado de TODOS los extra_forms que tienen contenido
        saved_forms = []
        
        for form in self.forms:
            if form.cleaned_data.get("DELETE"):
                continue
                
            # Verificar si el form tiene contenido real
            payload = (form.cleaned_data.get("game_pairs") or "").strip()
            enun = (form.cleaned_data.get("enunciado") or "").strip()
            punt = form.cleaned_data.get("puntaje")
            
            tiene_contenido = bool(payload or enun or (punt not in (None, "")))
            
            if tiene_contenido:
                # Si no tiene instancia o no fue guardado por super().save()
                if not form.instance.pk:
                    instance = form.save(commit=False)
                    if not instance.datos:
                        instance.datos = {"kind": "trivia", "questions": []}
                    instance.actividad = self.instance
                    
                    if commit:
                        instance.save()
                    
                    saved_forms.append(instance)
                    print(f"✅ Form extra guardado manualmente: {instance.pk or 'NUEVO'}")
        
        # Agregar las instancias guardadas manualmente a la lista
        if saved_forms:
            instances = list(instances) + saved_forms
        
        return instances
    
class ItemForm(forms.ModelForm):
    item_kind = forms.ChoiceField(
        label="Tipo de ítem",
        choices=GAME_KIND_CHOICES,
        required=False,
        widget=forms.Select(attrs={"class": "form-select"})
    )

    game_time_limit = forms.IntegerField(
        label="Tiempo límite (s)",
        required=False,
        min_value=5,
        widget=forms.NumberInput(attrs={"class": "form-control", "min": 5})
    )

    game_pairs = forms.CharField(
        label="Contenido",
        required=False,
        widget=forms.Textarea(attrs={
            "rows": 4, 
            "class": "form-control game-pairs-data",
            "style": "display:none"
        })
    )

    class Meta:
        model = ItemActividad
        fields = ["enunciado", "puntaje"]
        widgets = {
            "enunciado": forms.Textarea(attrs={
                "class": "form-control",
                "rows": 2,
                "placeholder": "Instrucción para el alumno..."
            }),
            "puntaje": forms.NumberInput(attrs={"class": "form-control", "min": 0}),
        }

    def __init__(self, *args, **kwargs):
        self.actividad_tipo = kwargs.pop("actividad_tipo", "quiz")
        super().__init__(*args, **kwargs)

        # Ajustar opciones según tipo
        if _norm(self.actividad_tipo) == "game":
            self.fields["item_kind"].choices = [("trivia", "Pregunta del videojuego")]
            self.fields["item_kind"].initial = "trivia"
        else:
            self.fields["item_kind"].choices = GAME_KIND_CHOICES

        # ⚠️ PRECARGA DESDE INSTANCIA EXISTENTE
        if self.instance and self.instance.pk:
            datos = getattr(self.instance, "datos", None) or {}
            
            if datos:
                kind = _norm(datos.get("kind") or datos.get("tipo") or "trivia")
                
                # Establecer valores iniciales
                self.fields["item_kind"].initial = kind
                self.fields["game_time_limit"].initial = datos.get("timeLimit") or datos.get("tiempo")
                
                # ⚠️ CRÍTICO: Serializar como JSON
                try:
                    # Asegurarse de que datos es un dict válido
                    if not isinstance(datos, dict):
                        datos = {"kind": kind}
                    
                    # Agregar kind si no existe
                    if "kind" not in datos:
                        datos["kind"] = kind
                    
                    self.fields["game_pairs"].initial = json.dumps(datos, ensure_ascii=False, indent=2)
                    
                    print(f"✅ Ítem {self.instance.pk} precargado: {kind}, {len(str(datos))} chars")
                except Exception as e:
                    print(f"❌ Error serializando datos del ítem {self.instance.pk}: {e}")
                    self.fields["game_pairs"].initial = json.dumps({"kind": kind}, ensure_ascii=False)
            else:
                # Sin datos: crear estructura base
                self.fields["game_pairs"].initial = json.dumps({"kind": "trivia"}, ensure_ascii=False)

    def clean(self):
        cleaned = super().clean()
        kind = _norm(cleaned.get("item_kind") or "trivia")
        raw = cleaned.get("game_pairs") or ""

        # ⚠️ Si el textarea viene vacío pero la instancia tiene datos, preservarlos
        if not raw.strip() and self.instance.pk and self.instance.datos:
            print(f"⚠️ Textarea vacío, preservando datos existentes del ítem {self.instance.pk}")
            datos = self.instance.datos
            # Actualizar kind por si cambió
            datos["kind"] = kind
        elif not raw.strip():
            # Nuevo ítem sin datos: crear estructura base
            datos = {"kind": kind}
            if kind == "trivia":
                datos["questions"] = []
            elif kind in ("memory", "dragmatch"):
                datos["pairs"] = []
            elif kind == "vf":
                datos["items"] = []
            elif kind == "ordering":
                datos["steps"] = []
            elif kind == "classify":
                datos["bins"] = []
                datos["items"] = []
            elif kind == "labyrinth":
                datos["doors"] = []
            elif kind == "shop":
                datos["products"] = []
                datos["budget"] = 1000
        else:
            # Parsear JSON del textarea
            datos, err = self._normalize_payload(kind, raw)
            if err:
                raise ValidationError(f"Error en contenido del ítem: {err}")

        # Agregar tiempo límite
        tl = cleaned.get("game_time_limit")
        if tl:
            try:
                datos["timeLimit"] = int(tl)
            except Exception:
                pass

        # ⚠️ CRÍTICO: Guardar en la instancia
        self.instance.datos = datos
        self.instance.tipo = "game"
        
        # Log para debug
        print(f"💾 Guardando ítem: kind={datos.get('kind')}, datos={len(str(datos))} chars")
        
        return cleaned

    def save(self, commit=True):
        inst = super().save(commit=False)
        
        # Los datos ya están en inst.datos por clean()
        # Verificar que no se perdieron
        if not inst.datos or not isinstance(inst.datos, dict):
            print(f"⚠️ WARNING: Ítem {inst.pk or 'NUEVO'} sin datos válidos al guardar")
            inst.datos = {"kind": "trivia", "questions": []}
        
        if commit:
            inst.save()
            print(f"✅ Ítem guardado: ID={inst.pk}, kind={inst.datos.get('kind')}")
        
        return inst

    def _normalize_payload(self, kind: str, raw: str):
        """Devuelve (datos_normalizados, error_msg|None)"""
        kind = _norm(kind or "trivia")
        raw = (raw or "").strip()

        # Intentar parsear como JSON
        payload = None
        if raw.startswith("{") or raw.startswith("["):
            try:
                payload = json.loads(raw)
            except Exception as e:
                return None, f"JSON inválido: {str(e)}"

        datos = {"kind": kind}

        # MEMORY / DRAGMATCH
        if kind in ("memory", "dragmatch", "dragandmatch"):
            pairs = []
            if payload is not None:
                pairs = payload.get("pairs") or payload.get("items") or []
            else:
                pairs = _parse_pairs_raw(raw)

            if not isinstance(pairs, list):
                return None, "El formato de pares no es válido."
            
            datos["pairs"] = pairs
            return datos, None

        # TRIVIA
        if kind == "trivia":
            questions = []
            if payload is not None:
                questions = payload.get("questions") or []
            else:
                questions = _parse_trivia_raw(raw)

            if not isinstance(questions, list):
                return None, "El formato de preguntas no es válido."
            
            # Normalizar preguntas
            norm_qs = []
            for q in questions:
                if not isinstance(q, dict):
                    continue
                qtext = (q.get("q") or "").strip()
                opts = q.get("opts") or q.get("options") or []
                ans = q.get("ans", 0)
                
                if qtext and isinstance(opts, list) and len(opts) >= 2:
                    if not isinstance(ans, int) or ans < 0 or ans >= len(opts):
                        ans = 0
                    norm_qs.append({
                        "q": qtext,
                        "opts": [str(o) for o in opts],
                        "ans": int(ans)
                    })
            
            datos["questions"] = norm_qs
            return datos, None

        # VF
        if kind == "vf":
            items = []
            if payload is not None:
                items = payload.get("items") or []
            
            if not isinstance(items, list):
                return None, "Formato de verdadero/falso no válido."
            
            norm = []
            for it in items:
                if not isinstance(it, dict):
                    continue
                txt = (it.get("text") or "").strip()
                truth = bool(it.get("is_true") if "is_true" in it else it.get("answer"))
                if txt:
                    norm.append({"text": txt, "is_true": truth})
            
            datos["items"] = norm
            return datos, None

        # ORDERING
        if kind in ("ordering", "ordening"):
            steps = []
            if payload is not None:
                steps = payload.get("steps") or payload.get("items") or []
                if isinstance(steps, list) and steps:
                    if isinstance(steps[0], dict):
                        steps = [s.get("texto") or s.get("text") for s in steps]
            else:
                steps = [ln.strip() for ln in raw.splitlines() if ln.strip()]

            if not steps or len(steps) < 2:
                return None, "Ordenar requiere al menos 2 pasos."
            
            datos["kind"] = "ordering"
            datos["steps"] = [str(s) for s in steps if s]
            return datos, None

        # CLASSIFY
        if kind == "classify":
            if payload is None:
                return None, "Clasificar requiere formato JSON."
            cats = payload.get("bins") or payload.get("categories") or []
            items = payload.get("items") or []
            
            if not isinstance(cats, list):
                cats = []
            if not isinstance(items, list):
                items = []
            
            datos["bins"] = list(cats)
            datos["items"] = list(items)
            return datos, None

        # CLOZE
        if kind == "cloze":
            if payload is None:
                return None, "Completar requiere formato JSON."
            text = (payload.get("text") or "").strip()
            answers = payload.get("answers") or payload.get("blanks") or []
            if not text or not answers:
                return None, "Completar requiere texto y respuestas."
            datos["text"] = text
            datos["answers"] = answers
            datos["bank"] = payload.get("bank") or []
            return datos, None

        # LABYRINTH
        if kind == "labyrinth":
            if payload is None:
                return None, "Laberinto requiere formato JSON."
            doors = payload.get("doors") or []
            if not isinstance(doors, list):
                doors = []
            datos["doors"] = doors
            return datos, None

        # SHOP
        if kind == "shop":
            if payload is None:
                return None, "Tienda requiere formato JSON."
            products = payload.get("products") or []
            budget = payload.get("budget") or 1000
            if not isinstance(products, list):
                products = []
            datos["products"] = products
            datos["budget"] = budget
            return datos, None

        # Otros: pasar tal cual si es JSON
        if payload is None:
            return None, "Este tipo requiere formato JSON."
        datos.update(payload)
        return datos, None