from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _
from django.contrib.auth.password_validation import (
    MinimumLengthValidator,
    CommonPasswordValidator,
    NumericPasswordValidator,
)

class MinimumLengthValidatorES(MinimumLengthValidator):
    def validate(self, password, user=None):
        min_length = getattr(self, 'min_length', 8)
        if len(password) < min_length:
            raise ValidationError(
                _("Esta contraseña es demasiado corta. Debe contener al menos %(min_length)d caracteres."),
                code="password_too_short",
                params={"min_length": min_length},
            )
    def get_help_text(self):
        min_length = getattr(self, 'min_length', 8)
        return _("Tu contraseña debe contener al menos %(min_length)d caracteres.") % {"min_length": min_length}

class CommonPasswordValidatorES(CommonPasswordValidator):
    def validate(self, password, user=None):
        if self.passwords is None:
            self.get_password_list()
        if password.lower().strip() in self.passwords:
            raise ValidationError(
                _("Esta contraseña es demasiado común."),
                code="password_too_common",
            )
    def get_help_text(self):
        return _("No uses contraseñas comunes.")

class NumericPasswordValidatorES(NumericPasswordValidator):
    def validate(self, password, user=None):
        if password.isdigit():
            raise ValidationError(
                _("Esta contraseña es completamente numérica."),
                code="password_entirely_numeric",
            )
    def get_help_text(self):
        return _("Tu contraseña no puede ser completamente numérica.")
