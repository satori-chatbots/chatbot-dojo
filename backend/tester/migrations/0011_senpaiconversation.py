"""Add single-conversation storage for Senpai Assistant."""

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    """Create the SenpaiConversation model."""

    dependencies = [
        ("tester", "0010_create_user_projects_directories"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="SenpaiConversation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("thread_id", models.CharField(max_length=255, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=models.deletion.CASCADE,
                        related_name="senpai_conversation",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
    ]
