from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator, MaxValueValidator
from .validators import validar_rut_chileno

# Create your models here.

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
    rut = models.CharField(max_length=12, unique=True, validators=[validar_rut_chileno])

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
    # Combinado: almacena 1–3, muestra Fácil/Medio/Difícil
    dificultad = models.IntegerField(
        choices=Dificultad.choices,
        default=Dificultad.MEDIO,
        validators=[MinValueValidator(1), MaxValueValidator(3)]
    )
    recurso = models.ForeignKey(Recurso, on_delete=models.SET_NULL, null=True, blank=True)
    recompensa = models.ForeignKey(Recompensa, on_delete=models.SET_NULL, null=True, blank=True)

    estudiantes = models.ManyToManyField(
        'Estudiante', through='AsignacionActividad', related_name='actividades', blank=True
    )

    def __str__(self):
        return f"{self.titulo} ({self.get_dificultad_display()})"


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