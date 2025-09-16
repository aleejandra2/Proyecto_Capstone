import re
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

_RUT_CHARS = re.compile(r'[^0-9kK]')  # todo lo que NO sea dígito o K/k

def formatear_rut_usuario(valor: str) -> str:
    """
    Formatea el RUT a '12.345.678-9' sin validar módulo 11.
    - Acepta con/sin puntos/guion; último carácter es DV (0-9/K).
    - Cuerpo 1..8 dígitos (para caber en CharField max_length=12).
    """
    s = str(valor or '').strip()
    if not s:
        raise ValidationError(_("Ingresa tu RUT."))

    limpio = _RUT_CHARS.sub('', s)
    if len(limpio) < 2:
        raise ValidationError(_("El RUT debe incluir cuerpo y dígito verificador (ej: 12.345.678-9)."))

    cuerpo, dv = limpio[:-1], limpio[-1].upper()

    if not cuerpo.isdigit():
        raise ValidationError(_("El cuerpo del RUT debe ser numérico."))

    if not (1 <= len(cuerpo) <= 8):
        raise ValidationError(_("El cuerpo del RUT debe tener entre 1 y 8 dígitos."))

    if not (dv.isdigit() or dv == 'K'):
        raise ValidationError(_("El dígito verificador debe ser 0-9 o K."))

    # Puntear miles
    rev = cuerpo[::-1]
    grupos = [rev[i:i+3] for i in range(0, len(rev), 3)]
    cuerpo_fmt = '.'.join(g[::-1] for g in grupos[::-1])
    return f"{cuerpo_fmt}-{dv}"

def validar_formato_rut(valor: str) -> None:
    """Validador suave para el campo del modelo (solo comprueba que se pueda formatear)."""
    formatear_rut_usuario(valor)

# ---------- COMPATIBILIDAD RETRO CON MIGRACIONES ----------
# Alias con el nombre antiguo para que las migraciones que lo referencian puedan importarlo.
def validar_rut_chileno(valor: str) -> None:
    """
    Compat: usado por migraciones antiguas. Mantiene el comportamiento actual (sin módulo 11):
    solo valida que el input sea formateable a RUT canónico.
    """
    validar_formato_rut(valor)
# ---------------------------------------------------------
