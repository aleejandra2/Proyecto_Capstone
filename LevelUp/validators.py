import re
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

# Acepta entradas como: "12345678-5", "12.345.678-5", "123456785", "12.345.6785"
_RUT_PATTERN = re.compile(r'^\s*\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\s*$')

def _dv_mod11(numero: int) -> str:
    """Calcula dígito verificador RUT (módulo 11)."""
    factor = 2
    total = 0
    while numero > 0:
        total += (numero % 10) * factor
        numero //= 10
        factor = 2 if factor == 7 else factor + 1
    dv = 11 - (total % 11)
    if dv == 11:
        return '0'
    if dv == 10:
        return 'K'
    return str(dv)

def formatear_rut(valor: str) -> str:
    """
    Retorna el RUT en formato canónico: 12.345.678-5
    (solo formatea; asume que el DV es correcto)
    """
    s = re.sub(r'[^0-9kK]', '', str(valor))
    cuerpo, dv = s[:-1], s[-1].upper()
    # Agregar puntos cada 3 desde la derecha
    rev = cuerpo[::-1]
    grupos = [rev[i:i+3] for i in range(0, len(rev), 3)]
    cuerpo_fmt = '.'.join(g[::-1] for g in grupos[::-1])
    return f"{cuerpo_fmt}-{dv}"

def validar_rut_chileno(valor: str) -> None:
    """
    Valida formato y dígito verificador de un RUT chileno.
    Lanza ValidationError si no es válido.
    """
    if not _RUT_PATTERN.match(str(valor)):
        raise ValidationError(_("Formato de RUT inválido."))

    s = re.sub(r'[^0-9kK]', '', str(valor))
    cuerpo, dv_ingresado = s[:-1], s[-1].upper()

    if not cuerpo.isdigit() or len(cuerpo) < 1:
        raise ValidationError(_("RUT inválido."))

    dv_calculado = _dv_mod11(int(cuerpo))
    if dv_calculado != dv_ingresado:
        raise ValidationError(_("Dígito verificador incorrecto."))
