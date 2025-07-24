"""Management command to create a superuser from environment variables if it does not exist."""

import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db.utils import IntegrityError


class Command(BaseCommand):
    """Create a superuser from environment variables if it does not exist."""

    help = "Create a superuser from environment variables if it does not exist"

    def handle(self, *args: object, **options: object) -> None:
        """Handle the management command.

        Args:
            *args: Additional positional arguments (unused).
            **options: Additional keyword arguments (unused).
        """
        _ = args, options  # Silence unused argument warnings
        user_model = get_user_model()

        # Get superuser details from environment variables
        email = os.getenv("DJANGO_SUPERUSER_EMAIL")
        password = os.getenv("DJANGO_SUPERUSER_PASSWORD")
        first_name = os.getenv("DJANGO_SUPERUSER_FIRST_NAME", "")
        last_name = os.getenv("DJANGO_SUPERUSER_LAST_NAME", "")

        if not email or not password:
            self.stdout.write(
                self.style.WARNING(
                    "DJANGO_SUPERUSER_EMAIL and DJANGO_SUPERUSER_PASSWORD must be set in environment variables"
                )
            )
            return

        # Check if superuser already exists
        if user_model.objects.filter(email=email).exists():
            self.stdout.write(self.style.SUCCESS(f"Superuser with email {email} already exists"))
            return

        # Create superuser
        try:
            user_model.objects.create_superuser(
                email=email,
                password=password,
                username="",
                first_name=first_name,
                last_name=last_name,
            )
            self.stdout.write(self.style.SUCCESS(f"Successfully created superuser: {email}"))
        except (IntegrityError, ValueError) as exc:
            self.stdout.write(self.style.ERROR(f"Error creating superuser: {exc!s}"))
