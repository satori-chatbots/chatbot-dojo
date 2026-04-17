"""Export existing connectors into flat YAML files for Senpai discovery."""

from pathlib import Path

import yaml
from django.conf import settings
from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps


def _build_connector_export_content(connector, custom_config_content: str) -> str:  # noqa: ANN001
    """Render the flat connector YAML export for a historical connector instance."""
    payload = {
        "name": connector.name,
        "technology": connector.technology,
        "parameters": connector.parameters or {},
        "custom_config_file": connector.custom_config_file.name if connector.custom_config_file else "",
        "custom_config_content": custom_config_content,
    }
    return yaml.safe_dump(payload, sort_keys=False, allow_unicode=True)


def export_existing_connectors(apps: StateApps, _schema_editor: BaseDatabaseSchemaEditor) -> None:
    """Export every existing connector into users/user_<id>/connectors/connector_<id>.yaml."""
    ChatbotConnector = apps.get_model("tester", "ChatbotConnector")

    for connector in ChatbotConnector.objects.all().iterator():
        connector_dir = Path(settings.MEDIA_ROOT) / "users" / f"user_{connector.owner_id}" / "connectors"
        connector_dir.mkdir(parents=True, exist_ok=True)

        custom_config_content = ""
        if connector.custom_config_file:
            config_path = Path(settings.MEDIA_ROOT) / connector.custom_config_file.name
            if config_path.exists():
                custom_config_content = config_path.read_text(encoding="utf-8")

        export_path = connector_dir / f"connector_{connector.id}.yaml"
        export_path.write_text(
            _build_connector_export_content(connector, custom_config_content),
            encoding="utf-8",
        )


class Migration(migrations.Migration):
    """Backfill connector exports for Senpai."""

    dependencies = [
        ("tester", "0013_move_user_storage_root_to_users"),
    ]

    operations = [
        migrations.RunPython(export_existing_connectors, reverse_code=migrations.RunPython.noop),
    ]
