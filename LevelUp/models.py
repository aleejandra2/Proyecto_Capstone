from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator, MaxValueValidator
from django.conf import settings
from django.core.exceptions import ValidationError
from .validators import validar_formato_rut

USER = settings.AUTH_USER_MODEL

ROL_ESTUDIANTE = "ESTUDIANTE"
ROL_DOCENTE = "DOCENTE"

NIVELES = (
    (4, "4° Básico"),
    (5, "5° Básico"),
    (6, "6° Básico"),
    (7, "7° Básico"),
    (8, "8° Básico"),
)

ITEM_TIPOS = [
    ("quiz", "Cuestionario"),
    ("game", "Juego (minijuego)"),
    ("game_config", "Juego • Configuración"),
]

# --------------------------------------------------------------------
# Utilidades JSONField (compat)
# --------------------------------------------------------------------
try:
    from django.db.models import JSONField
except Exception:  # pragma: no cover
    from django.contrib.postgres.fields import JSONField  # type: ignore


# ---------------------------------------------------------
# Usuario del sistema (Custom User)
# ---------------------------------------------------------
class Usuario(AbstractUser):
    """
    Usuario del sistema integrándose con auth de Django.
    Hereda: username, first_name, last_name, email, password, is_staff, etc.
    """
    class Rol(models.TextChoices):
        ESTUDIANTE    = "ESTUDIANTE", "Estudiante"
        DOCENTE       = "DOCENTE", "Docente"
        ADMINISTRADOR = "ADMINISTRADOR", "Administrador"

    rol = models.CharField(
        max_length=20,
        choices=Rol.choices,
        default=Rol.ESTUDIANTE,
    )

    # RUT con validación y unicidad; se guardará normalizado por señal pre_save
    rut = models.CharField(max_length=12, unique=True, validators=[validar_formato_rut])

    # Email único ("email único para login/recuperación")
    email = models.EmailField(max_length=128, unique=True)

    def __str__(self):
        nombre = f"{self.first_name} {self.last_name}".strip() or self.username
        return f"{nombre} ({self.rut}) - {self.rol}"


# ---------------------------------------------------------
# Perfiles por rol (1–1 con Usuario)
# ---------------------------------------------------------
class Administrador(models.Model):
    usuario = models.OneToOneField(Usuario, on_delete=models.CASCADE, primary_key=True)

    def __str__(self):
        return f"Administrador: {self.usuario.get_full_name() or self.usuario.username}"


class Docente(models.Model):
    usuario = models.OneToOneField(Usuario, on_delete=models.CASCADE, primary_key=True)
    asignatura = models.CharField(max_length=100)

    def __str__(self):
        return f"Docente: {self.usuario.get_full_name() or self.usuario.username} - {self.asignatura}"


class Estudiante(models.Model):
    usuario = models.OneToOneField(Usuario, on_delete=models.CASCADE, primary_key=True)
    nivel = models.IntegerField(default=1)
    curso = models.CharField(max_length=50)
    puntos = models.IntegerField(default=0)
    medallas = models.IntegerField(default=0)
    # --- nuevo: progresión y avatar ---
    xp = models.PositiveIntegerField(default=0)
    coins = models.PositiveIntegerField(default=0)
    avatar_kind = models.CharField(max_length=20, default="otter")        # especie
    avatar_slug = models.CharField(max_length=40, default="otter")        # archivo base en /static/LevelUp/img/avatars/otter.png
    accesorios_desbloqueados = models.JSONField(default=list, blank=True) # ["gafas_azules", "mochila_lvl1"]
    accesorios_equipados = models.JSONField(default=dict, blank=True)      # {"cabeza":"gorra_roja","cara":"gafas_azules","espalda":"mochila_lvl1"}
    habilidades = models.JSONField(default=dict, blank=True)               # {"memoria_boost":2}

    def nivel_calculado(self):
        # curva simple: nivel n cuando xp >= n^2 * 100
        n = 1
        while self.xp >= (n * n * 100):
            n += 1
        return max(1, n - 1)

    def add_xp(self, amount: int):
        self.xp = max(0, self.xp + int(amount))
        return self.nivel_calculado()

    def add_coins(self, amount: int):
        self.coins = max(0, self.coins + int(amount))
        return self.coins

    def equip_default_if_empty(self):
        if not self.accesorios_equipados:
            # 3 slots iniciales
            self.accesorios_equipados = {"cara": "gafas_azules", "cabeza": "", "espalda": "mochila_lvl1"}
        if "gafas_azules" not in self.accesorios_desbloqueados:
            self.accesorios_desbloqueados.append("gafas_azules")

    def __str__(self):
        u = self.usuario
        nombre = (getattr(u, "get_full_name", lambda: "")() or getattr(u, "username", "") or getattr(u, "email", "")).strip()
        return f"{nombre} · {self.curso} · Nivel {self.nivel} ({self.xp} XP)"


# ---------------------------------------------------------
# Catálogos y entidades académicas
# ---------------------------------------------------------
class Ranking(models.Model):
    descripcion = models.TextField()

    def __str__(self):
        return f"Ranking #{self.pk}"


class Recurso(models.Model):
    tipo = models.CharField(max_length=50)     # video, documento, juego, etc.
    url = models.CharField(max_length=255)

    def __str__(self):
        return f"{self.tipo}: {self.url}"


class Recompensa(models.Model):
    class Tipo(models.TextChoices):
        ESTRELLA = "estrella", "Estrella"
        MEDALLA = "medalla", "Medalla"
        PUNTOS = "puntos", "Puntos"
        NIVEL = "nivel", "Nivel"

    tipo = models.CharField(max_length=50, choices=Tipo.choices)
    descripcion = models.TextField(blank=True)

    def __str__(self):
        return f"Recompensa {self.tipo} (#{self.pk})"


# ---------------------------------------------------------
# Actividades (EXTENDIDO para publicación/XP y autor)
# ---------------------------------------------------------
class Actividad(models.Model):
    class Tipo(models.TextChoices):
        QUIZ = "quiz", "Quiz"
        JUEGO = "juego", "Juego"

    class Dificultad(models.TextChoices):
        FACIL = "FACIL", "Fácil"
        MEDIO = "MEDIO", "Medio"
        DIFICIL = "DIFICIL", "Difícil"

    # -----------------------------------------
    # Datos principales
    # -----------------------------------------
    titulo = models.CharField(max_length=150)
    descripcion = models.TextField()
    tipo = models.CharField(max_length=20, choices=Tipo.choices)

    dificultad = models.CharField(
        max_length=16,
        choices=Dificultad.choices,
        default=Dificultad.MEDIO,
    )
    
    dificultad_default = models.CharField(
        max_length=16,
        choices=Dificultad.choices,
        default=Dificultad.MEDIO,
    )

    recurso = models.ForeignKey(Recurso, on_delete=models.SET_NULL, null=True, blank=True)
    recompensa = models.ForeignKey(Recompensa, on_delete=models.SET_NULL, null=True, blank=True)

    # Autor de la actividad
    docente = models.ForeignKey(
        "LevelUp.Docente",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="actividades_creadas",
    )

    # Asignatura
    asignatura = models.ForeignKey(
        "LevelUp.Asignatura",
        on_delete=models.PROTECT,   #  PROTECT para impedir borrar asignaturas con actividades
        null=True,
        blank=True,
        related_name="actividades",
    )

    # Publicación/cierre + XP total que reparte la actividad
    es_publicada = models.BooleanField(default=False)
    fecha_publicacion = models.DateTimeField(null=True, blank=True)
    fecha_cierre = models.DateTimeField(null=True, blank=True)
    xp_total = models.PositiveIntegerField(
        default=100,
        help_text="XP base proporcional al puntaje obtenido"
    )

    # N° de Intentos
    intentos_max = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(1000)],
        help_text="Número máximo de intentos por estudiante (1–1000).",
    )

    # Asignaciones a estudiantes (vía tabla intermedia)
    estudiantes = models.ManyToManyField(
        "LevelUp.Estudiante",
        through="LevelUp.AsignacionActividad",
        related_name="actividades",
        blank=True,
    )

    class Meta:
        ordering = ["-id"]  # más nuevas primero

    def __str__(self):
        return f"{self.titulo} ({self.get_dificultad_display()})"

    @property
    def puntaje_total(self) -> int:
        """
        Suma el puntaje de los ítems asociados (si existen).
        """
        return sum(self.items.values_list("puntaje", flat=True)) or 0

    def save(self, *args, **kwargs):
        """
        - Autocompleta `asignatura` si viene vacía y tenemos `docente`:
          · Si el docente tiene exactamente 1 AsignacionDocente → usar esa asignatura.
          · Si no, intenta resolver por el string `docente.asignatura` (nombre o código slug).
        - Sella `fecha_publicacion` la primera vez que se publica.
        """
        # Sella fecha de publicación si aplica
        if self.es_publicada and not self.fecha_publicacion:
            from django.utils import timezone
            self.fecha_publicacion = timezone.now()

        # Resolver asignatura si falta y hay docente
        if self.docente and not self.asignatura:
            # Import local para evitar problemas de orden de definición
            try:
                from django.utils.text import slugify
                # Acceso directo a modelos del mismo módulo (ya definidos en runtime)
                AsignacionDocente = globals().get("AsignacionDocente")
                Asignatura = globals().get("Asignatura")
            except Exception:
                AsignacionDocente = None
                Asignatura = None

            resolved = None

            # 1) Exactamente una asignación formal del docente
            if AsignacionDocente is not None:
                rels = AsignacionDocente.objects.filter(
                    profesor=self.docente.usuario
                ).select_related("asignatura")
                if rels.count() == 1:
                    resolved = rels.first().asignatura

            # 2) Si no se pudo, intenta por el texto del perfil Docente (p.ej. "Matemáticas")
            if resolved is None and Asignatura is not None:
                nombre = (self.docente.asignatura or "").strip()
                if nombre:
                    resolved = (
                        Asignatura.objects.filter(nombre__iexact=nombre).first()
                        or Asignatura.objects.filter(codigo__iexact=slugify(nombre)).first()
                    )

            if resolved is not None:
                self.asignatura = resolved

        return super().save(*args, **kwargs)

    # --- Helpers para minijuego (serialización de preguntas) ---

    def _map_dificultad_to_slug(self) -> str:
        """
        Mapea la dificultad entera (1/2/3) a slug 'facil|medio|dificil'.
        """
        mapa = {
            self.Dificultad.FACIL: "facil",
            self.Dificultad.MEDIO: "medio",
            self.Dificultad.DIFICIL: "dificil",
        }
        return mapa.get(self.dificultad, "medio")

    def preguntas_para_juego(self, dificultad=None, limit=3):
        """
        Retorna queryset de preguntas activas filtradas por dificultad,
        ordenadas por 'orden' y 'id'. Si no pasas 'dificultad',
        usa la propia de la actividad.
        """
        dif = (dificultad or self._map_dificultad_to_slug()).strip().lower()
        qs = self.preguntas.filter(activa=True, dificultad=dif).order_by("orden", "id")
        if limit and limit > 0:
            qs = qs[:limit]
        return qs

    def build_questions_payload(self, dificultad=None, limit=3) -> dict:
        """
        Estructura JSON que el minijuego puede consumir directamente.
        {
          "difficulty": "medio",
          "count": 3,
          "questions": [
            {"id": 12, "q": "¿...?", "opts": ["A","B","C"], "ans": 1},
            ...
          ]
        }
        """
        dif = (dificultad or self._map_dificultad_to_slug()).strip().lower()
        preguntas = self.preguntas_para_juego(dificultad=dif, limit=limit)
        items = []
        for p in preguntas:
            items.append({
                "id": p.id,
                "q": p.texto,
                "opts": list(p.opciones or []),
                "ans": int(p.correcta),
            })
        return {
            "difficulty": dif,
            "count": len(items),
            "questions": items,
        }

class AsignacionActividad(models.Model):
    class Estado(models.TextChoices):
        PENDIENTE   = "pendiente",   "Pendiente"
        EN_PROGRESO = "en_progreso", "En progreso"
        COMPLETADA  = "completada",  "Completada"

    estudiante = models.ForeignKey("LevelUp.Estudiante", on_delete=models.CASCADE)
    actividad  = models.ForeignKey("LevelUp.Actividad", on_delete=models.CASCADE)

    estado = models.CharField(
        max_length=20,
        choices=Estado.choices,
        default=Estado.PENDIENTE
    )
    nota = models.FloatField(null=True, blank=True)
    fecha_asignacion = models.DateField(auto_now_add=True)
    fecha_completada = models.DateField(null=True, blank=True)

    # Si se define, reemplaza los intentos máximos de la actividad para este estudiante.
    intentos_permitidos = models.PositiveSmallIntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(20)],
        help_text="Si se define, reemplaza los intentos máximos de la actividad para este estudiante."
    )

    class Meta:
        unique_together = ("estudiante", "actividad")
        ordering = ["-fecha_asignacion", "actividad_id"]

    def __str__(self):
        return f"{self.estudiante.usuario.username} -> {self.actividad.titulo} ({self.get_estado_display()})"


# ---------------------------------------------------------
# Preguntas del minijuego (editables por docente)
# ---------------------------------------------------------
class Pregunta(models.Model):
    class Dificultad(models.TextChoices):
        FACIL   = "facil", "Fácil"
        MEDIO   = "medio", "Medio"
        DIFICIL = "dificil", "Difícil"

    actividad = models.ForeignKey(
        Actividad,
        related_name="preguntas",
        on_delete=models.CASCADE
    )
    texto = models.TextField("Pregunta")
    opciones = JSONField(
        "Opciones",
        default=list,
        help_text="Lista de 2 a 6 opciones (en orden)"
    )
    correcta = models.PositiveSmallIntegerField(
        "Índice de la respuesta correcta (0-based)",
        validators=[MinValueValidator(0), MaxValueValidator(5)]
    )
    dificultad = models.CharField(
        max_length=10,
        choices=Dificultad.choices,
        default=Dificultad.MEDIO
    )
    orden = models.PositiveSmallIntegerField(default=1)
    activa = models.BooleanField(default=True)

    class Meta:
        ordering = ["orden", "id"]
        unique_together = [("actividad", "orden")]

    def clean(self):
        # Debe haber 2–6 opciones y la 'correcta' debe estar en rango
        if not isinstance(self.opciones, list) or not (2 <= len(self.opciones) <= 6):
            raise ValidationError("Debes ingresar entre 2 y 6 opciones.")
        if self.correcta >= len(self.opciones):
            raise ValidationError("Índice de respuesta correcta fuera de rango.")

    def __str__(self):
        return f"[Act {self.actividad_id}] {self.texto[:60]}..."


# ---------------------------------------------------------
# Ítems y Respuestas (interactivo por JSON en 'datos')
# ---------------------------------------------------------
class ItemActividad(models.Model):
    class ItemType(models.TextChoices):
        MCQ = "mcq", "Opción múltiple"
        TRUE_FALSE = "tf", "Verdadero/Falso"
        FILL_BLANK = "fib", "Completar espacios"
        SORT = "sort", "Ordenar"
        MATCH = "match", "Emparejar"
        TEXT = "text", "Respuesta de texto"
        IMAGE = "image", "Pregunta con imagen"
        INTERACTIVE = "interactive", "Interactiva (embed/url)"
        GAME = "game", "Juego (embed)"
        GAME_CONFIG = "game_config", "Juego • Configuración"

    actividad = models.ForeignKey("Actividad", on_delete=models.CASCADE, related_name="items")
    tipo = models.CharField(max_length=20, choices=ItemType.choices)
    # Permite enunciado vacío
    enunciado = models.TextField(blank=True)
    imagen = models.ImageField(upload_to="actividades/items", null=True, blank=True)
    datos = models.JSONField(default=dict, blank=True)
    puntaje = models.PositiveIntegerField(
        default=10, validators=[MinValueValidator(1), MaxValueValidator(1000)]
    )
    orden = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["orden", "id"]

    def __str__(self):
        title = (self.enunciado or "").strip()
        return f"[{self.get_tipo_display()}] {title[:40] or '(sin enunciado)'}"


class Submission(models.Model):
    """
    Intento/resolución de un estudiante para una actividad (1:1 por actividad).
    """
    actividad = models.ForeignKey(Actividad, on_delete=models.CASCADE, related_name="submissions")
    estudiante = models.ForeignKey(Estudiante, on_delete=models.CASCADE, related_name="submissions")
    intento = models.PositiveIntegerField(default=1)
    iniciado_en = models.DateTimeField(auto_now_add=True)
    enviado_en = models.DateTimeField(null=True, blank=True)
    finalizado = models.BooleanField(default=False)

    # Resultado
    xp_obtenido = models.PositiveIntegerField(default=0)
    calificacion = models.FloatField(null=True, blank=True)

    class Meta:
        unique_together = ("actividad", "estudiante", "intento")
        ordering = ["-intento", "-id"]

    def __str__(self):
        return f"{self.estudiante.usuario.username} → {self.actividad.titulo}"


class Answer(models.Model):
    """
    Respuesta por ítem dentro de un submission.
    """
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name="answers")
    item = models.ForeignKey(ItemActividad, on_delete=models.CASCADE)

    # Respuesta genérica por tipo:
    # mcq: {"marcadas":[0,2]}
    # tf: {"valor": true}
    # fib: {"f1":"4", "f2":"respuesta"}
    # sort: {"orden":["s1","s3","s2"]}
    # match: {"pares":[{"left":"l1","right":"rA"}]}
    # text: {"texto": "..."}
    # interactive/game: {"completado": true, "score": 800}
    respuesta = JSONField(default=dict, blank=True)

    es_correcta = models.BooleanField(default=False)
    puntaje_obtenido = models.PositiveIntegerField(default=0)
    respondido_en = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("submission", "item")

    def __str__(self):
        return f"Answer({self.item_id}) by {self.submission.estudiante_id}"


# ---------------------------------------------------------
# Cursos y Asignaturas
# ---------------------------------------------------------
class Asignatura(models.Model):
    nombre = models.CharField(max_length=100)

    slug = models.SlugField(
        max_length=100,
        blank=True,
        null=True,      # 👈 importante para que no pida default
    )

    icono = models.CharField(
        "Icono (ruta static)",
        max_length=200,
        blank=True,
        help_text="Ej: 'LevelUp/img/asignaturas/matematicas.png'",
    )

    def __str__(self):
        return self.nombre


class Curso(models.Model):
    nivel = models.IntegerField(choices=NIVELES)
    letra = models.CharField(max_length=2, default="A")

    class Meta:
        unique_together = [("nivel", "letra")]
        ordering = ["nivel", "letra"]

    def __str__(self):
        return f"{self.get_nivel_display()} {self.letra}"


class PerfilAlumno(models.Model):
    usuario = models.OneToOneField(USER, on_delete=models.CASCADE, related_name="perfil_alumno")
    promedio = models.DecimalField(max_digits=3, decimal_places=1, default=5.0)  # ej: 4.7
    dificultad_matematicas = models.BooleanField(default=False)
    dificultad_ingles = models.BooleanField(default=False)
    # Si luego quieres flags para nuevas asignaturas, agrégalas aquí.

    def __str__(self):
        return f"PerfilAlumno({self.usuario})"


class Matricula(models.Model):
    # Por tu definición nueva, estudiante apunta al USER directamente
    estudiante = models.ForeignKey(USER, on_delete=models.CASCADE, related_name="matriculas")
    curso = models.ForeignKey(Curso, on_delete=models.CASCADE, related_name="matriculas")
    fecha = models.DateField(auto_now_add=True)

    class Meta:
        unique_together = [("estudiante", "curso")]

    def clean(self):
        # Acepta código 'ESTUDIANTE' y, por compatibilidad, etiqueta 'Estudiante'
        rol = getattr(self.estudiante, "rol", None)
        if rol not in ("ESTUDIANTE", "Estudiante"):
            raise ValidationError("Solo usuarios con rol ESTUDIANTE pueden ser matriculados.")

    def __str__(self):
        return f"{self.estudiante} → {self.curso}"


class AsignacionDocente(models.Model):
    profesor = models.ForeignKey(USER, on_delete=models.CASCADE, related_name="asignaciones_docente")
    asignatura = models.ForeignKey(Asignatura, on_delete=models.CASCADE, related_name="asignaciones")

    class Meta:
        unique_together = [("profesor", "asignatura")]

    def clean(self):
        rol = getattr(self.profesor, "rol", None)
        if rol not in ("DOCENTE", "Docente"):
            raise ValidationError("Solo usuarios con rol DOCENTE pueden ser asignados.")

    def __str__(self):
        return f"{self.profesor} · {self.asignatura}"


class GrupoRefuerzoNivel(models.Model):
    """Un grupo por nivel (4° a 8°). Profes: Matemáticas, Inglés, Lenguaje, Historia, Ciencias."""
    nivel = models.IntegerField(choices=NIVELES, unique=True)

    profesor_matematicas = models.ForeignKey(
        USER, on_delete=models.CASCADE, related_name="grupos_refuerzo_mate"
    )
    profesor_ingles = models.ForeignKey(
        USER, on_delete=models.CASCADE, related_name="grupos_refuerzo_ing"
    )
    # Nuevos profesores (opcionales)
    profesor_lenguaje = models.ForeignKey(
        USER, on_delete=models.SET_NULL, null=True, blank=True, related_name="grupos_refuerzo_leng"
    )
    profesor_historia = models.ForeignKey(
        USER, on_delete=models.SET_NULL, null=True, blank=True, related_name="grupos_refuerzo_hist"
    )
    profesor_ciencias = models.ForeignKey(
        USER, on_delete=models.SET_NULL, null=True, blank=True, related_name="grupos_refuerzo_cien"
    )

    alumnos = models.ManyToManyField(
        USER, through="GrupoRefuerzoNivelAlumno", related_name="grupos_refuerzo_nivel"
    )
    capacidad_sugerida = models.PositiveIntegerField(default=10)

    class Meta:
        ordering = ["nivel"]

    def clean(self):
        # Valida DOCENTE cuando el profesor está presente (los opcionales pueden ser nulos)
        for prof in (
            self.profesor_matematicas,
            self.profesor_ingles,
            self.profesor_lenguaje,
            self.profesor_historia,
            self.profesor_ciencias,
        ):
            if prof:
                rol = getattr(prof, "rol", None)
                if rol not in (None, "DOCENTE", "Docente"):
                    raise ValidationError("Los profesores del grupo deben tener rol DOCENTE.")

    def __str__(self):
        return f"Refuerzo {self.get_nivel_display()}"


class GrupoRefuerzoNivelAlumno(models.Model):
    """Relación alumno-grupo con la asignatura prioritaria (mate/inglés/lenguaje/historia/ciencias)."""
    grupo = models.ForeignKey(GrupoRefuerzoNivel, on_delete=models.CASCADE)
    alumno = models.ForeignKey(USER, on_delete=models.CASCADE)
    asignatura = models.ForeignKey(Asignatura, on_delete=models.CASCADE)

    class Meta:
        unique_together = [("grupo", "alumno")]

    def clean(self):
        # valida por 'codigo' de Asignatura
        permitidas = {"matematicas", "ingles", "lenguaje", "historia", "ciencias"}
        if getattr(self.asignatura, "codigo", None) not in permitidas:
            raise ValidationError(
                "La asignatura debe ser Matemáticas, Inglés, Lenguaje, Historia o Ciencias Naturales."
            )

    def __str__(self):
        return f"{self.alumno} → {self.grupo} ({self.asignatura})"

class ReporteProgreso(models.Model):
    estudiante = models.ForeignKey(
        Estudiante, on_delete=models.CASCADE, related_name="reportes"
    )
    avance = models.FloatField(help_text="Porcentaje 0–100")
    fecha = models.DateField()
    rendimiento = models.CharField(max_length=50)
    ranking = models.ForeignKey(
        Ranking, on_delete=models.SET_NULL, null=True, blank=True, related_name="reportes"
    )

    class Meta:
        ordering = ["-fecha", "id"]

    def __str__(self):
        return f"Reporte {self.pk} - {self.estudiante.usuario.username} - {self.fecha}"
