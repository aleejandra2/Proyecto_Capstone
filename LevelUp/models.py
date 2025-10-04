from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator, MaxValueValidator
from .validators import validar_formato_rut

# --------------------------------------------------------------------
# Utilidades JSONField (compat)
# --------------------------------------------------------------------
try:
    from django.db.models import JSONField  # Django 3.1+
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
        ESTUDIANTE = "Estudiante", "Estudiante"
        DOCENTE = "Docente", "Docente"
        ADMINISTRADOR = "Administrador", "Administrador"

    # RUT con validación y unicidad; se guardará normalizado por señal pre_save
    rut = models.CharField(max_length=12, unique=True, validators=[validar_formato_rut])

    # Email único ("email único para login/recuperación")
    email = models.EmailField(max_length=128, unique=True)

    rol = models.CharField(max_length=20, choices=Rol.choices)

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

    def __str__(self):
        return f"Estudiante: {self.usuario.get_full_name() or self.usuario.username} ({self.curso})"


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
        VIDEO = "video", "Video"
        TAREA = "tarea", "Tarea"

    class Dificultad(models.IntegerChoices):
        FACIL = 1, "Fácil"
        MEDIO = 2, "Medio"
        DIFICIL = 3, "Difícil"

    titulo = models.CharField(max_length=150)
    descripcion = models.TextField()
    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    dificultad = models.IntegerField(
        choices=Dificultad.choices,
        default=Dificultad.MEDIO,
        validators=[MinValueValidator(1), MaxValueValidator(3)]
    )
    recurso = models.ForeignKey(Recurso, on_delete=models.SET_NULL, null=True, blank=True)
    recompensa = models.ForeignKey(Recompensa, on_delete=models.SET_NULL, null=True, blank=True)

    # Autor de la actividad (opcional para no romper datos existentes)
    docente = models.ForeignKey(
        Docente, on_delete=models.SET_NULL, null=True, blank=True, related_name="actividades_creadas"
    )

    # Publicación/cierre + XP total que reparte la actividad
    es_publicada = models.BooleanField(default=False)
    fecha_publicacion = models.DateTimeField(null=True, blank=True)
    fecha_cierre = models.DateTimeField(null=True, blank=True)
    xp_total = models.PositiveIntegerField(default=100, help_text="XP base proporcional al puntaje obtenido")

    estudiantes = models.ManyToManyField(
        'Estudiante', through='AsignacionActividad', related_name='actividades', blank=True
    )

    def __str__(self):
        return f"{self.titulo} ({self.get_dificultad_display()})"

    @property
    def puntaje_total(self) -> int:
        # Suma el puntaje de los ítems asociados (si existen)
        return sum(self.items.values_list("puntaje", flat=True)) or 0


class AsignacionActividad(models.Model):
    class Estado(models.TextChoices):
        PENDIENTE = "pendiente", "Pendiente"
        EN_PROGRESO = "en_progreso", "En progreso"
        COMPLETADA = "completada", "Completada"

    estudiante = models.ForeignKey(Estudiante, on_delete=models.CASCADE)
    actividad = models.ForeignKey(Actividad, on_delete=models.CASCADE)
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.PENDIENTE)
    nota = models.FloatField(null=True, blank=True)
    fecha_asignacion = models.DateField(auto_now_add=True)
    fecha_completada = models.DateField(null=True, blank=True)

    class Meta:
        unique_together = ('estudiante', 'actividad')

    def __str__(self):
        return f"{self.estudiante.usuario.username} -> {self.actividad.titulo} ({self.get_estado_display()})"


class ReporteProgreso(models.Model):
    estudiante = models.ForeignKey(Estudiante, on_delete=models.CASCADE, related_name="reportes")
    avance = models.FloatField()      # porcentaje 0–100
    fecha = models.DateField()
    rendimiento = models.CharField(max_length=50)
    ranking = models.ForeignKey(Ranking, on_delete=models.SET_NULL, null=True, blank=True, related_name="reportes")

    def __str__(self):
        return f"Reporte {self.pk} - {self.estudiante.usuario.username} - {self.fecha}"


# ---------------------------------------------------------
# Estructura de Ítems y Respuestas
# ---------------------------------------------------------

class ItemActividad(models.Model):
    class ItemType(models.TextChoices):
        MCQ = "mcq", "Opción múltiple"
        TRUE_FALSE = "tf", "Verdadero/Falso"
        TEXT = "text", "Respuesta de texto"
        IMAGE = "image", "Pregunta con imagen"
        INTERACTIVE = "interactive", "Interactiva (embed/url)"
        GAME = "game", "Juego (embed)"

    actividad = models.ForeignKey(Actividad, on_delete=models.CASCADE, related_name="items")
    tipo = models.CharField(max_length=20, choices=ItemType.choices)
    enunciado = models.TextField()
    imagen = models.ImageField(upload_to="actividades/items", null=True, blank=True)

    # Estructura por tipo (ejemplos):
    # mcq: {"opciones": ["A","B","C"], "correctas": [0,2]}
    # tf: {"respuesta": true}
    # text: {"palabras_clave": ["agua","ciclo"], "long_min": 0}
    # interactive/game: {"url": "https://...", "proveedor": "itch.io"}
    datos = JSONField(default=dict, blank=True)

    puntaje = models.PositiveIntegerField(default=10, validators=[MinValueValidator(1), MaxValueValidator(1000)])
    orden = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["orden", "id"]

    def __str__(self):
        return f"[{self.get_tipo_display()}] {self.enunciado[:40]}"


class Submission(models.Model):
    """
    Intento/resolución de un estudiante para una actividad (1:1 por actividad).
    """
    actividad = models.ForeignKey(Actividad, on_delete=models.CASCADE, related_name="submissions")
    estudiante = models.ForeignKey(Estudiante, on_delete=models.CASCADE, related_name="submissions")
    iniciado_en = models.DateTimeField(auto_now_add=True)
    enviado_en = models.DateTimeField(null=True, blank=True)
    finalizado = models.BooleanField(default=False)

    # Resultado
    xp_obtenido = models.PositiveIntegerField(default=0)
    calificacion = models.FloatField(null=True, blank=True)

    class Meta:
        unique_together = ("actividad", "estudiante")

    def __str__(self):
        return f"{self.estudiante.usuario.username} → {self.actividad.titulo}"


class Answer(models.Model):
    """
    Respuesta por ítem dentro de un submission.
    """
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name="answers")
    item = models.ForeignKey(ItemActividad, on_delete=models.CASCADE)

    # Respuesta genérica por tipo:
    # mcq: {"marcadas": [0,2]}
    # tf: {"valor": true}
    # text: {"texto": "..."}
    # image: {"texto": "..."} (si se solicita)
    # interactive/game: {"completado": true, "score": 800}
    respuesta = JSONField(default=dict, blank=True)

    es_correcta = models.BooleanField(default=False)
    puntaje_obtenido = models.PositiveIntegerField(default=0)
    respondido_en = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("submission", "item")

    def __str__(self):
        return f"Answer({self.item_id}) by {self.submission.estudiante_id}"
