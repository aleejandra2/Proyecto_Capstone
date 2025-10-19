# LevelUp/management/commands/setup_cursos_6a8.py
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db import transaction
from LevelUp.models import Curso, Asignatura, Matricula

# ------------------ Utilidades RUT ------------------ #
def rut_dv(n: int) -> str:
    seq = [2, 3, 4, 5, 6, 7]
    s, i = 0, 0
    while n > 0:
        s += (n % 10) * seq[i % 6]
        n //= 10
        i += 1
    r = 11 - (s % 11)
    if r == 11:
        return "0"
    if r == 10:
        return "K"
    return str(r)

def rut_fmt(n: int) -> str:
    # 12.345.678-9
    return f"{n:,}".replace(",", ".") + f"-{rut_dv(n)}"

# ------------------ Rol estudiante ------------------ #
def rol_estudiante_code(User):
    """
    Devuelve el código correcto para 'Estudiante' según tu modelo.
    Intenta primero enum User.Rol.ESTUDIANTE, luego en choices, y finalmente 'ESTUDIANTE'.
    """
    # 1) Enum tipo User.Rol.ESTUDIANTE
    try:
        return User.Rol.ESTUDIANTE
    except Exception:
        pass

    # 2) Choices del field 'rol'
    try:
        for code, label in User._meta.get_field("rol").choices:
            if str(code).upper() == "ESTUDIANTE" or str(label).lower().strip() == "estudiante":
                return code
    except Exception:
        pass

    # 3) Fallback razonable
    return "ESTUDIANTE"

class Command(BaseCommand):
    help = "Crea cursos (6°/7°/8° A/B), asignaturas (Lenguaje/Historia/Ciencias Naturales) y N alumnos por curso."

    def add_arguments(self, parser):
        parser.add_argument(
            "--per-curso",
            dest="per_curso",
            type=int,
            default=5,
            help="Cantidad de alumnos por curso (default: 5)",
        )
        parser.add_argument(
            "--rut-base",
            dest="rut_base",
            type=int,
            default=70000000,
            help="Base numérica para generar RUTs únicos (default: 70000000)",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        User = get_user_model()
        per = options.get("per_curso", 5)
        rut_base = options.get("rut_base", 70000000)
        rol_est = rol_estudiante_code(User)

        # ---------- Asignaturas ----------
        asigns = [
            ("lenguaje", "Lenguaje"),
            ("historia", "Historia"),
            ("ciencias", "Ciencias Naturales"),
        ]
        for codigo, nombre in asigns:
            Asignatura.objects.get_or_create(codigo=codigo, defaults={"nombre": nombre})
        self.stdout.write(self.style.SUCCESS("✓ Asignaturas OK: Lenguaje / Historia / Ciencias Naturales"))

        # ---------- Cursos 6–8 A/B ----------
        cursos = []
        for nivel in (6, 7, 8):
            for letra in ("A", "B"):
                curso, _ = Curso.objects.get_or_create(nivel=nivel, letra=letra)
                cursos.append(curso)
        self.stdout.write(self.style.SUCCESS("✓ Cursos OK: 6°/7°/8° A y B"))

        # Asegura que rut_base no choque con RUT existentes
        while User.objects.filter(rut=rut_fmt(rut_base)).exists():
            rut_base += 1

        created_users = 0
        created_mats = 0

        for curso in cursos:
            for i in range(1, per + 1):
                username = f"{curso.nivel}{curso.letra.lower()}_alumno{i:02d}"
                email = f"{username}@levelup.test"

                if User.objects.filter(username=username).exists():
                    self.stdout.write(self.style.WARNING(f"• {username} ya existe; salto."))
                    continue

                # Genera un RUT libre
                while True:
                    rut_str = rut_fmt(rut_base)
                    rut_base += 1
                    if not User.objects.filter(rut=rut_str).exists():
                        break

                # Crea usuario alumno
                u = User.objects.create_user(
                    username=username,
                    email=email.lower(),
                    password="password",
                    first_name="Alumno",
                    last_name=f"{curso.nivel}° Básico {curso.letra} - {i:02d}",
                    rut=rut_str,
                    rol=rol_est,
                )
                created_users += 1

                # Matricula (nota: si Matricula.fecha es auto_now_add, defaults se ignora sin problema)
                _, created = Matricula.objects.get_or_create(
                    estudiante=u,
                    curso=curso,
                    defaults={"fecha": timezone.now().date()},
                )
                if created:
                    created_mats += 1

        self.stdout.write(self.style.SUCCESS(
            f"✔ Listo: Usuarios creados {created_users}, Matrículas creadas {created_mats}"
        ))
