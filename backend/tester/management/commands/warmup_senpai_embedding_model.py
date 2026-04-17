"""Management command to pre-download Senpai's embedding model."""

from django.core.management.base import BaseCommand, CommandError

from tester.senpai import warmup_senpai_embedding_model


class Command(BaseCommand):
    """Warm up the Senpai embedding model cache."""

    help = "Download and initialize the Senpai embedding model"

    def handle(self, *args: object, **options: object) -> None:
        """Download the embedding model into the configured cache root."""
        _ = args, options
        try:
            warmup_senpai_embedding_model()
        except RuntimeError as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(self.style.SUCCESS("Senpai embedding model is ready"))
