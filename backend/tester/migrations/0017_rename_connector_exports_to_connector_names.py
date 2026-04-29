"""Rename connector exports to match connector display names."""

from __future__ import annotations

import re
from pathlib import Path
from typing import TYPE_CHECKING, Any, ClassVar

import yaml
from django.conf import settings
from django.db import migrations

if TYPE_CHECKING:
    from django.db.backends.base.schema import BaseDatabaseSchemaEditor
    from django.db.migrations.state import StateApps

PATH_SEPARATOR_PATTERN = re.compile(r"[\\/]+")


def _sanitize_connector_name_for_filename(connector_name: Any) -> str | None:  # noqa: ANN401
    raw_name = str(connector_name).replace("\x00", "").strip()
    if not raw_name:
        return None

    path_segments = PATH_SEPARATOR_PATTERN.split(raw_name)
    if any(segment in {".", ".."} for segment in path_segments):
        return None

    safe_name = PATH_SEPARATOR_PATTERN.sub("_", raw_name).strip(" .")
    return safe_name or None


def _connector_export_relative_path(user_id: int, connector_id: int, connector_name: str) -> Path:
    safe_name = _sanitize_connector_name_for_filename(connector_name)
    filename = f"{safe_name}.yaml" if safe_name else f"connector_{connector_id}__senpai_export.yaml"
    return Path("users") / f"user_{user_id}" / "connectors" / filename


def _legacy_connector_export_relative_paths(user_id: int, connector_id: int) -> list[Path]:
    connectors_root = Path("users") / f"user_{user_id}" / "connectors"
    return [
        connectors_root / f"connector_{connector_id}__senpai_export.yaml",
        connectors_root / f"connector_{connector_id}.yaml",
    ]


def _redact_sensitive_connector_data(value: object) -> object:
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


def _build_connector_export_content(connector: Any) -> str:  # noqa: ANN401
    payload: dict[str, object] = {
        "name": connector.name,
        "technology": connector.technology,
        "parameters": _redact_sensitive_connector_data(connector.parameters or {}),
        "custom_config_file": connector.custom_config_file.name if connector.custom_config_file else "",
    }
    return yaml.safe_dump(payload, sort_keys=False, allow_unicode=True)


def rename_connector_exports_forward(apps: StateApps, _schema_editor: BaseDatabaseSchemaEditor) -> None:
    """Write connector exports with connector-name filenames and remove old export names."""
    ChatbotConnector = apps.get_model("tester", "ChatbotConnector")

    for connector in ChatbotConnector.objects.all().iterator():
        export_relative_path = _connector_export_relative_path(connector.owner_id, connector.id, connector.name)
        export_path = Path(settings.MEDIA_ROOT) / export_relative_path
        custom_config_relative_path = Path(connector.custom_config_file.name) if connector.custom_config_file else None

        if export_relative_path != custom_config_relative_path:
            export_path.parent.mkdir(parents=True, exist_ok=True)
            export_path.write_text(_build_connector_export_content(connector), encoding="utf-8")

        for legacy_relative_path in _legacy_connector_export_relative_paths(connector.owner_id, connector.id):
            if legacy_relative_path in {export_relative_path, custom_config_relative_path}:
                continue
            legacy_path = Path(settings.MEDIA_ROOT) / legacy_relative_path
            if legacy_path.exists():
                legacy_path.unlink()


class Migration(migrations.Migration):
    """Migration to make connector exports use connector display names."""

    dependencies: ClassVar[list[tuple[str, str]]] = [
        ("tester", "0016_rename_project_folders_to_project_names"),
    ]
    operations: ClassVar[list[migrations.RunPython]] = [
        migrations.RunPython(rename_connector_exports_forward, reverse_code=migrations.RunPython.noop),
    ]
