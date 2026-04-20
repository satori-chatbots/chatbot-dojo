"""Export existing connectors into flat YAML files for Senpai discovery."""

from pathlib import Path
from typing import ClassVar

import yaml
from django.conf import settings
from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps


def _redact_sensitive_connector_data(value: object) -> object:
    """Return connector metadata with likely secret fields redacted."""
    sensitive_key_fragments = (
        "token",
        "secret",
        "password",
        "passwd",
        "api_key",
        "apikey",
        "access_key",
        "private_key",
        "client_secret",
        "authorization",
        "auth",
        "credential",
        "signature",
    )

    if isinstance(value, dict):
        redacted_dict: dict[object, object] = {}
        for nested_key, nested_value in value.items():
            normalized_key = str(nested_key).strip().lower()
            if any(fragment in normalized_key for fragment in sensitive_key_fragments):
                redacted_dict[nested_key] = "***REDACTED***"
            else:
                redacted_dict[nested_key] = _redact_sensitive_connector_data(nested_value)
        return redacted_dict

    if isinstance(value, list):
        return [_redact_sensitive_connector_data(item) for item in value]

    if isinstance(value, tuple):
        return tuple(_redact_sensitive_connector_data(item) for item in value)

    return value


def _build_connector_export_content(connector) -> str:  # noqa: ANN001
    """Render the flat connector YAML export for a historical connector instance."""
    payload: dict[str, object] = {
        "name": connector.name,
        "technology": connector.technology,
        "parameters": _redact_sensitive_connector_data(connector.parameters or {}),
        "custom_config_file": connector.custom_config_file.name if connector.custom_config_file else "",
    }
    return yaml.safe_dump(payload, sort_keys=False, allow_unicode=True)


def export_existing_connectors(apps: StateApps, _schema_editor: BaseDatabaseSchemaEditor) -> None:
    """Export every existing connector into users/user_<id>/connectors/connector_<id>__senpai_export.yaml."""
    ChatbotConnector = apps.get_model("tester", "ChatbotConnector")

    for connector in ChatbotConnector.objects.all().iterator():
        connector_dir = Path(settings.MEDIA_ROOT) / "users" / f"user_{connector.owner_id}" / "connectors"
        connector_dir.mkdir(parents=True, exist_ok=True)

        export_path = connector_dir / f"connector_{connector.id}__senpai_export.yaml"
        export_path.write_text(
            _build_connector_export_content(connector),
            encoding="utf-8",
        )


class Migration(migrations.Migration):
    """Backfill connector exports for Senpai."""

    dependencies: ClassVar[list[tuple[str, str]]] = [
        ("tester", "0013_move_user_storage_root_to_users"),
    ]

    operations: ClassVar[list[migrations.RunPython]] = [
        migrations.RunPython(export_existing_connectors, reverse_code=migrations.RunPython.noop),
    ]
