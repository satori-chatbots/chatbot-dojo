"""Move user storage from projects/user_* to users/user_*."""

import re
import shutil
from pathlib import Path

from django.conf import settings
from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps

OLD_USER_ROOT_RE = re.compile(r"^projects/user_(\d+)(/.*)?$")
NEW_USER_ROOT_RE = re.compile(r"^users/user_(\d+)(/.*)?$")


def _translate_user_root_path(path: str, *, reverse: bool = False) -> str:
    """Translate between the old and new user storage roots."""
    if not path:
        return path

    pattern = NEW_USER_ROOT_RE if reverse else OLD_USER_ROOT_RE
    replacement = "projects/user_\\1\\2" if reverse else "users/user_\\1\\2"
    return pattern.sub(replacement, path, count=1)


def _move_user_directories(apps, *, reverse: bool = False):  # noqa: ANN001, ANN202
    """Move user workspace directories on disk to match the active layout."""
    CustomUser = apps.get_model("tester", "CustomUser")

    for user in CustomUser.objects.all().iterator():
        old_relative = Path(f"projects/user_{user.id}")
        new_relative = Path(f"users/user_{user.id}")

        source_relative = new_relative if reverse else old_relative
        destination_relative = old_relative if reverse else new_relative

        source_path = Path(settings.MEDIA_ROOT) / source_relative
        destination_path = Path(settings.MEDIA_ROOT) / destination_relative

        if not source_path.exists():
            continue

        if destination_path.exists():
            msg = f"Cannot move user directory from {source_relative} to {destination_relative}: destination exists."
            raise RuntimeError(msg)

        destination_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(source_path), str(destination_path))


def _update_file_field_paths(apps, *, reverse: bool = False):  # noqa: ANN001, ANN202
    """Update database file paths stored for user-scoped assets."""
    model_names = (
        "TestFile",
        "PersonalityFile",
        "RuleFile",
        "TypeFile",
        "SenseiCheckRule",
        "ChatbotConnector",
    )
    field_names = {
        "TestFile": "file",
        "PersonalityFile": "file",
        "RuleFile": "file",
        "TypeFile": "file",
        "SenseiCheckRule": "file",
        "ChatbotConnector": "custom_config_file",
    }

    for model_name in model_names:
        model = apps.get_model("tester", model_name)
        field_name = field_names[model_name]
        for instance in model.objects.all().iterator():
            field_file = getattr(instance, field_name)
            current_path = getattr(field_file, "name", "") or ""
            if not current_path:
                continue
            new_path = _translate_user_root_path(current_path, reverse=reverse)
            if new_path == current_path:
                continue

            field_file.name = new_path
            instance.save(update_fields=[field_name])


def _update_test_case_paths(apps, *, reverse: bool = False):  # noqa: ANN001, ANN202
    """Update copied profile paths stored in TestCase JSON metadata."""
    TestCase = apps.get_model("tester", "TestCase")

    for test_case in TestCase.objects.exclude(copied_files__isnull=True).iterator():
        copied_files = test_case.copied_files or []
        updated = False

        for copied_file in copied_files:
            if not isinstance(copied_file, dict) or "path" not in copied_file:
                continue

            new_path = _translate_user_root_path(copied_file["path"], reverse=reverse)
            if new_path == copied_file["path"]:
                continue

            copied_file["path"] = new_path
            updated = True

        if updated:
            test_case.copied_files = copied_files
            test_case.save(update_fields=["copied_files"])


def _update_execution_paths(apps, *, reverse: bool = False):  # noqa: ANN001, ANN202
    """Update stored execution and analysis paths that live under user directories."""
    ProfileExecution = apps.get_model("tester", "ProfileExecution")
    TracerAnalysisResult = apps.get_model("tester", "TracerAnalysisResult")

    for execution in ProfileExecution.objects.all().iterator():
        new_path = _translate_user_root_path(execution.profiles_directory, reverse=reverse)
        if new_path == execution.profiles_directory:
            continue

        execution.profiles_directory = new_path
        execution.save(update_fields=["profiles_directory"])

    analysis_fields = (
        "report_file_path",
        "workflow_graph_svg_path",
        "workflow_graph_png_path",
        "workflow_graph_pdf_path",
    )
    for analysis in TracerAnalysisResult.objects.all().iterator():
        updated_fields = []
        for field_name in analysis_fields:
            current_path = getattr(analysis, field_name)
            new_path = _translate_user_root_path(current_path, reverse=reverse)
            if new_path == current_path:
                continue

            setattr(analysis, field_name, new_path)
            updated_fields.append(field_name)

        if updated_fields:
            analysis.save(update_fields=updated_fields)


def move_user_storage_forward(apps: StateApps, _schema_editor: BaseDatabaseSchemaEditor) -> None:
    """Move user storage into the users/ root."""
    _move_user_directories(apps)
    _update_file_field_paths(apps)
    _update_test_case_paths(apps)
    _update_execution_paths(apps)


def move_user_storage_backward(apps: StateApps, _schema_editor: BaseDatabaseSchemaEditor) -> None:
    """Move user storage back to the projects/ root."""
    _move_user_directories(apps, reverse=True)
    _update_file_field_paths(apps, reverse=True)
    _update_test_case_paths(apps, reverse=True)
    _update_execution_paths(apps, reverse=True)


class Migration(migrations.Migration):
    """Move the user workspace root from projects/ to users/."""

    dependencies = [
        ("tester", "0012_senpaiconversation_assistant_api_key"),
    ]

    operations = [
        migrations.RunPython(move_user_storage_forward, reverse_code=move_user_storage_backward),
    ]
