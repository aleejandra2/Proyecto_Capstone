from django.apps import AppConfig


class LevelUpConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'LevelUp'

    def ready(self):
        from . import signals  # noqa: F401
