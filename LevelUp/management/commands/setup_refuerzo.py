import random
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

from LevelUp.models import (
    Asignatura, Curso, PerfilAlumno, Matricula,
    AsignacionDocente, GrupoRefuerzoNivel, GrupoRefuerzoNivelAlumno,
    ROL_DOCENTE, ROL_ESTUDIANTE
)

User = get_user_model()

# ========= Helpers para RUT =========
def rut_dv(n: int) -> str:
    """Calcula dígito verificador de RUT chileno (0-9 o K)."""
    s = 1
    m = 0
    while n:
        s = (s + n % 10 * (9 - m % 6)) % 11
        n //= 10
        m += 1
    return 'K' if s == 10 else str(s)

def rut_str(n: int) -> str:
    """Formatea RUT con puntos y guion: 12.345.678-5"""
    dv = rut_dv(n)
    s = f"{n:,}".replace(",", ".")
    return f"{s}-{dv}"

class Command(BaseCommand):
    help = "Crea cursos 4°A/B y 5°A/B, asignaturas (Matemáticas/Inglés), 2 profes y grupos de refuerzo (10 alumnos total por nivel)."

    def handle(self, *args, **options):
        # 1) Asignaturas
        mate, _ = Asignatura.objects.get_or_create(nombre="Matemáticas", codigo="matematicas")
        ing,  _ = Asignatura.objects.get_or_create(nombre="Inglés",      codigo="ingles")

        # 2) Cursos
        cursos_def = [(4, "A"), (4, "B"), (5, "A"), (5, "B")]
        cursos = {}
        for nivel, letra in cursos_def:
            curso, _ = Curso.objects.get_or_create(nivel=nivel, letra=letra)
            cursos[(nivel, letra)] = curso

        # 3) Profesores (ahora con RUT y email únicos)
        prof_mate_defaults = {
            "first_name": "Profe",
            "last_name": "Matemáticas",
            "email": "prof_mate@example.com",
            "rut": rut_str(80000000),   # 80.000.000-DV
        }
        prof_ing_defaults = {
            "first_name": "Profe",
            "last_name": "Inglés",
            "email": "prof_ingles@example.com",
            "rut": rut_str(80000001),   # 80.000.001-DV
        }

        prof_mate, _ = User.objects.get_or_create(username="prof_mate", defaults=prof_mate_defaults)
        prof_ing,  _ = User.objects.get_or_create(username="prof_ingles", defaults=prof_ing_defaults)

        # Si tu User tiene 'rol', asegúralo
        if hasattr(prof_mate, "rol") and prof_mate.rol != ROL_DOCENTE:
            prof_mate.rol = ROL_DOCENTE; prof_mate.save(update_fields=["rol"])
        if hasattr(prof_ing, "rol") and prof_ing.rol != ROL_DOCENTE:
            prof_ing.rol = ROL_DOCENTE;  prof_ing.save(update_fields=["rol"])

        AsignacionDocente.objects.get_or_create(profesor=prof_mate, asignatura=mate)
        AsignacionDocente.objects.get_or_create(profesor=prof_ing,  asignatura=ing)

        # 4) Alumnos de ejemplo + matrícula + perfil
        # Bases para RUT por curso (diferentes para evitar colisiones):
        base_rut = {
            (4, "A"): 41000000,
            (4, "B"): 42000000,
            (5, "A"): 51000000,
            (5, "B"): 52000000,
        }

        def crear_estudiante(nivel, letra, idx):
            username = f"al{nivel}{letra}{idx}"
            defaults = {
                "first_name": f"Alumno{idx}",
                "last_name": f"{nivel}{letra}",
                "email": f"{username}@test.com",
                "rut": rut_str(base_rut[(nivel, letra)] + idx),  # único por curso+idx
            }
            u, created = User.objects.get_or_create(username=username, defaults=defaults)
            if created:
                # Si tu User requiere set_password, puedes setear una contraseña genérica o dejarla unusable:
                try:
                    u.set_unusable_password()
                    u.save(update_fields=[])
                except Exception:
                    pass

            if hasattr(u, "rol") and u.rol != ROL_ESTUDIANTE:
                u.rol = ROL_ESTUDIANTE; u.save(update_fields=["rol"])

            Matricula.objects.get_or_create(estudiante=u, curso=cursos[(nivel, letra)])

            # Perfil con promedio y banderas “realistas”
            prom = round(random.uniform(3.0, 6.5), 1)
            PerfilAlumno.objects.get_or_create(
                usuario=u,
                defaults={
                    "promedio": prom,
                    "dificultad_matematicas": prom < 5.0 and random.random() < 0.7,
                    "dificultad_ingles": prom < 5.0 and random.random() < 0.7,
                }
            )
            return u

        # Genera candidatos (25 por curso)
        for nivel, letra in cursos_def:
            for i in range(1, 26):
                crear_estudiante(nivel, letra, i)

        # 5) Un grupo por nivel (10 alumnos total) con asignatura prioritaria
        for nivel in (4, 5):
            grupo, _ = GrupoRefuerzoNivel.objects.get_or_create(
                nivel=nivel,
                defaults={
                    "profesor_matematicas": prof_mate,
                    "profesor_ingles":     prof_ing,
                    "capacidad_sugerida": 10
                }
            )
            # asegura profesores por si ya existía
            changed = False
            if grupo.profesor_matematicas_id != prof_mate.id:
                grupo.profesor_matematicas = prof_mate; changed = True
            if grupo.profesor_ingles_id != prof_ing.id:
                grupo.profesor_ingles = prof_ing; changed = True
            if changed:
                grupo.save()

            # candidatos del nivel (matriculados en ese nivel)
            cands = User.objects.filter(matriculas__curso__nivel=nivel).distinct()

            def score(u):
                p = getattr(u, "perfil_alumno", None)
                if not p: return (10.0, 1)
                has_diff = p.dificultad_matematicas or p.dificultad_ingles
                return (float(p.promedio), 0 if has_diff else 1)

            cands = sorted(cands, key=score)

            # elige hasta 10 con promedio<5.0 o dificultades; si faltan, completa
            sel = []
            for u in cands:
                p = getattr(u, "perfil_alumno", None)
                if not p: continue
                if (p.promedio < 5.0) or p.dificultad_matematicas or p.dificultad_ingles:
                    sel.append(u)
                if len(sel) == 10:
                    break
            if len(sel) < 10:
                for u in cands:
                    if u in sel: continue
                    sel.append(u)
                    if len(sel) == 10: break

            # reinicia y asigna asignatura prioritaria balanceando mate/inglés
            GrupoRefuerzoNivelAlumno.objects.filter(grupo=grupo).delete()
            count_mate = count_ing = 0
            for u in sel:
                p = getattr(u, "perfil_alumno", None)
                if p and p.dificultad_matematicas and not p.dificultad_ingles:
                    asig = mate
                elif p and p.dificultad_ingles and not p.dificultad_matematicas:
                    asig = ing
                elif p and p.dificultad_matematicas and p.dificultad_ingles:
                    asig = mate if count_mate <= count_ing else ing
                else:
                    asig = mate if count_mate <= count_ing else ing

                GrupoRefuerzoNivelAlumno.objects.create(grupo=grupo, alumno=u, asignatura=asig)
                if asig == mate: count_mate += 1
                else:            count_ing  += 1

        self.stdout.write(self.style.SUCCESS("✓ Listo: grupos de refuerzo (10 por nivel) creados sin conflictos de RUT."))
