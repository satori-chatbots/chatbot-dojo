"""App configuration for the tester app."""

from django.apps import AppConfig


class TesterConfig(AppConfig):
    """AppConfig for the tester app."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "tester"
