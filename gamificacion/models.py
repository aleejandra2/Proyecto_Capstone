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
    nivel = models.PositiveIntegerField(default=0)
    xp_actual = models.PositiveIntegerField(default=0)   # XP dentro del nivel actual
    xp_total = models.PositiveIntegerField(default=0)    # XP histórica acumulada

    class Meta:
        verbose_name = "Perfil de gamificación"
        verbose_name_plural = "Perfiles de gamificación"

    def __str__(self):
        return f"Gamificación de {self.usuario}"

    # ---------- LÓGICA DE NIVELES ----------

    def xp_necesaria_para(self, nivel):
        """
        Fórmula de XP necesaria para subir desde 'nivel' al siguiente.
        Simple y fácil de ajustar.
        """
        base = 100
        extra = 50 * (nivel ** 2)
        return base + extra

    @property
    def xp_para_siguiente_nivel(self):
        return self.xp_necesaria_para(self.nivel)

    @property
    def progreso_porcentaje(self):
        objetivo = self.xp_para_siguiente_nivel or 1
        return int((self.xp_actual / objetivo) * 100)

    def agregar_xp(self, cantidad, origen="", referencia_id=None):
        
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


class Recompensa(models.Model):
    TIPO_CHOICES = [
        ("LOGRO", "Logro"),
        ("FONDO", "Fondo de pantalla"),
        ("ACCESORIO", "Accesorio de avatar"),
        ("OTRO", "Otro"),
    ]

    nombre = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    descripcion = models.TextField(blank=True)
    # Texto que explica la condición, por ejemplo:
    # "Consigue 10000 puntos en Matemáticas en un mes"
    condicion_texto = models.CharField(max_length=255, blank=True)

    icono = models.CharField(
        max_length=255,
        blank=True,
        help_text="Ruta estática opcional, ej: 'LevelUp/img/recompensas/medalla_math.png'",
    )

    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default="LOGRO")

    # Condiciones básicas de desbloqueo (puedes ampliarlas luego)
    nivel_requerido = models.PositiveIntegerField(default=0)
    xp_requerida = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "Recompensa"
        verbose_name_plural = "Recompensas"

    def __str__(self):
        return self.nombre

    @staticmethod
    def desbloquear_para_perfil(perfil: "PerfilGamificacion"):
        disponibles = Recompensa.objects.filter(
            nivel_requerido__lte=perfil.nivel,
            xp_requerida__lte=perfil.xp_total,
        )

        ya_tiene_ids = set(
            RecompensaUsuario.objects.filter(perfil=perfil)
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
