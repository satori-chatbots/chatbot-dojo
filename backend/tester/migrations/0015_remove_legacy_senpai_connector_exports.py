"""Remove historical connector export files after the renamed Senpai export rollout."""

from pathlib import Path
from typing import ClassVar

from django.conf import settings
from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps


def remove_legacy_connector_exports(apps: StateApps, _schema_editor: BaseDatabaseSchemaEditor) -> None:
    """Delete connector_<id>.yaml exports when they are not the user's real config file."""
    ChatbotConnector = apps.get_model("tester", "ChatbotConnector")

    for connector in ChatbotConnector.objects.all().iterator():
        legacy_export_path = (
            Path(settings.MEDIA_ROOT)
            / "users"
            / f"user_{connector.owner_id}"
            / "connectors"
            / f"connector_{connector.id}.yaml"
        )
        custom_config_name = connector.custom_config_file.name if connector.custom_config_file else ""
        if custom_config_name == legacy_export_path.relative_to(settings.MEDIA_ROOT).as_posix():
            continue
        if legacy_export_path.exists():
            legacy_export_path.unlink()


class Migration(migrations.Migration):
    """Clean up obsolete connector exports created before the Senpai filename change."""

    dependencies: ClassVar[list[tuple[str, str]]] = [
        ("tester", "0014_export_existing_connectors_for_senpai"),
    ]

    operations: ClassVar[list[migrations.RunPython]] = [
        migrations.RunPython(remove_legacy_connector_exports, reverse_code=migrations.RunPython.noop),
    ]
