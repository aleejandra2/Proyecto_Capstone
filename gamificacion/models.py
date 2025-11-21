from django.conf import settings
from django.db import models
from django.utils import timezone

USER_MODEL = settings.AUTH_USER_MODEL


class PerfilGamificacion(models.Model):
    usuario = models.OneToOneField(
        USER_MODEL,
        on_delete=models.CASCADE,
        related_name="perfil_gamificacion",
    )

    # Niveles y experiencia
    # Empieza en nivel 0, como querías
    nivel = models.PositiveIntegerField(default=0)
    xp_actual = models.PositiveIntegerField(default=0)    # XP dentro del nivel actual
    xp_total = models.PositiveIntegerField(default=0)     # XP acumulada total

    # Conteo de actividades completadas (para el rango Timo)
    actividades_completadas = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "Perfil de gamificación"
        verbose_name_plural = "Perfiles de gamificación"

    def __str__(self):
        return f"Gamificación de {self.usuario}"

    # ---------- LÓGICA DE NIVELES / XP ----------

    def xp_necesaria_para(self, nivel: int) -> int:
        """
        XP necesaria para subir desde 'nivel' al siguiente.
        Nivel 0 → 100 XP, y luego crece con una curva cuadrática.
        Ajustable si quieres que suba más rápido o más lento.
        """
        base = 100
        extra = 50 * (nivel ** 2)
        return base + extra

    @property
    def xp_para_siguiente_nivel(self) -> int:
        return self.xp_necesaria_para(self.nivel)

    @property
    def progreso_porcentaje(self) -> int:
        """
        Porcentaje para la barra de XP (0–100).
        """
        objetivo = self.xp_para_siguiente_nivel or 1
        pct = int((self.xp_actual / objetivo) * 100)
        # Clamp por si acaso
        return max(0, min(100, pct))

    def agregar_xp(self, cantidad: int, origen: str = "", referencia_id=None):

        try:
            cantidad = int(cantidad or 0)
        except Exception:
            cantidad = 0

        if cantidad <= 0:
            return {
                "xp_ganada": 0,
                "niveles_subidos": 0,
                "recompensas_nuevas": [],
            }

        self.xp_total += cantidad
        self.xp_actual += cantidad

        niveles_subidos = 0

        # Subir de nivel todas las veces necesarias
        while self.xp_actual >= self.xp_para_siguiente_nivel:
            self.xp_actual -= self.xp_para_siguiente_nivel
            self.nivel += 1
            niveles_subidos += 1

        self.save()

        # Ver qué recompensas nuevas se desbloquean
        recompensas_nuevas = Recompensa.desbloquear_para_perfil(self)

        return {
            "xp_ganada": cantidad,
            "niveles_subidos": niveles_subidos,
            "recompensas_nuevas": recompensas_nuevas,
        }

    # ---------- CONTEO DE ACTIVIDADES (PARA RANGO) ----------

    def registrar_actividad_completada(self, incrementar_veces: bool = True):
        """
        Suma 1 al conteo de actividades completadas.
        Esto es lo que usas para el rango Timo.
        """
        if incrementar_veces:
            self.actividades_completadas += 1
            self.save()

    # ---------- RANGOS TIMO (POR ACTIVIDADES) ----------

    @property
    def rango_timo(self) -> str:
        """
        Nombre del rango según actividades_completadas.
        """
        a = self.actividades_completadas
        if a < 2:
            return "Timo Explorador"          # 0–1
        elif a < 4:
            return "Timo Guardián"            # 2–3
        elif a < 6:
            return "Timo Guerrero"            # 4–5
        else:
            return "Timo Héroe Legendario"    # 6+   

    @property
    def rango_numero(self) -> int:
        """
        1 a 4 según el rango actual.
        """
        a = self.actividades_completadas
        if a < 2:
            return 1
        elif a < 4:
            return 2
        elif a < 6:
            return 3
        else:
            return 4

    @property
    def rango_descripcion(self) -> str:
        """
        Texto bonito que mostramos en el portal.
        """
        a = self.actividades_completadas
        if a < 2:
            return (
                "Estás empezando tu aventura. "
                "¡Cada actividad te ayuda a explorar un nuevo rincón del conocimiento!"
            )
        elif a < 4:
            return (
                "Ya no solo exploras, ahora proteges lo que has aprendido. "
                "Eres un Guardián del Saber."
            )
        elif a < 6:
            return (
                "Enfrentas desafíos más difíciles y no te rindes. "
                "¡Los ejercicios son tus entrenamientos!"
            )
        else:
            return (
                "Has superado montones de actividades. "
                "¡Eres una leyenda en LevelUp!"
            )

    @property
    def actividades_para_siguiente_rango(self) -> int:
        """
        Cuántas actividades faltan para el próximo rango.
        Si ya está en el máximo, devuelve 0.
        """
        a = self.actividades_completadas
        if a < 2:
            return 2 - a          # Explorador → Guardián
        elif a < 4:
            return 4 - a          # Guardián → Guerrero
        elif a < 6:
            return 6 - a          # Guerrero → Héroe
        else:
            return 0            # ya es Héroe Legendario


class Recompensa(models.Model):
    TIPO_CHOICES = [
        ("LOGRO", "Logro"),
        ("FONDO", "Fondo de pantalla"),
        ("ACCESORIO", "Accesorio de avatar"),
        ("OTRO", "Otro"),
    ]

    SLUGS_ESPECIALES = [
        "maestro-matematicas",
        "guardian-palabras",
        "cronista-tiempo",
        "cientifico-estrella",
        "primer-paso-matematicas",
        "primer-cuento-lenguaje",
        "primer-viaje-historia",
        "primer-experimento-ciencias",
        "respuesta-perfecta",
        "racha-genio",
        "bienvenido-levelup",
    ]

    nombre = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    descripcion = models.TextField(blank=True)
    condicion_texto = models.CharField(max_length=255, blank=True)
    icono = models.CharField(
        max_length=255,
        blank=True,
        help_text="Ruta estática opcional, ej: 'LevelUp/img/recompensas/medalla_math.png'",
    )
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default="LOGRO")

    nivel_requerido = models.PositiveIntegerField(default=0)
    xp_requerida = models.PositiveIntegerField(default=0)
    actividades_requeridas = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "Recompensa"
        verbose_name_plural = "Recompensas"

    def __str__(self):
        return self.nombre

    @staticmethod
    def desbloquear_para_perfil(perfil: "PerfilGamificacion"):
        """
        Desbloqueo genérico por nivel / XP / actividades.
        NO incluye los logros especiales (que se manejan aparte).
        """
        disponibles = (
            Recompensa.objects
            .filter(
                nivel_requerido__lte=perfil.nivel,
                xp_requerida__lte=perfil.xp_total,
                actividades_requeridas__lte=perfil.actividades_completadas,
            )
            .exclude(slug__in=Recompensa.SLUGS_ESPECIALES) 
        )

        ya_tiene_ids = set(
            RecompensaUsuario.objects
            .filter(perfil=perfil)
            .values_list("recompensa_id", flat=True)
        )

        nuevas = []
        for recomp in disponibles:
            if recomp.id in ya_tiene_ids:
                continue
            nuevas.append(
                RecompensaUsuario.objects.create(
                    perfil=perfil,
                    recompensa=recomp,
                )
            )
        return nuevas

class RecompensaUsuario(models.Model):
    perfil = models.ForeignKey(
        PerfilGamificacion,
        on_delete=models.CASCADE,
        related_name="recompensas_usuario",
    )
    recompensa = models.ForeignKey(
        Recompensa,
        on_delete=models.CASCADE,
        related_name="usuarios_con_recompensa",
    )
    fecha_desbloqueo = models.DateTimeField(default=timezone.now)
    notificada = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Recompensa de usuario"
        verbose_name_plural = "Recompensas de usuarios"
        unique_together = ("perfil", "recompensa")

    def __str__(self):
        return f"{self.perfil.usuario} → {self.recompensa}"
