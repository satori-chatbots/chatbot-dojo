"""Create default projects directories for existing users."""

from pathlib import Path
from typing import ClassVar

from django.conf import settings
from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps


def create_user_projects_directories(apps: StateApps, _schema_editor: BaseDatabaseSchemaEditor) -> None:
    """Ensure every existing user has a default projects directory."""
    CustomUser = apps.get_model("tester", "CustomUser")

    for user in CustomUser.objects.all().iterator():
        user_projects_path = Path(settings.MEDIA_ROOT) / "projects" / f"user_{user.id}" / "projects"
        user_projects_path.mkdir(parents=True, exist_ok=True)


class Migration(migrations.Migration):
    """Create default per-user projects directories for existing users."""

    atomic: ClassVar[bool] = False
    dependencies: ClassVar[list[tuple[str, str]]] = [
        ("tester", "0009_move_projects_into_projects_directory"),
    ]
    operations: ClassVar[list[migrations.RunPython]] = [
        migrations.RunPython(create_user_projects_directories, migrations.RunPython.noop),
    ]
