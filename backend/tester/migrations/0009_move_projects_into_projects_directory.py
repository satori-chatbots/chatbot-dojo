"""Move project storage under a lowercase projects subdirectory for each user."""

import re
import shutil
from pathlib import Path
from typing import ClassVar

from django.conf import settings
from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps

OLD_PROJECT_PATH_RE = re.compile(r"^projects/user_(\d+)/project_(\d+)(/.*)?$")
NEW_PROJECT_PATH_RE = re.compile(r"^projects/user_(\d+)/projects/project_(\d+)(/.*)?$")


def _translate_project_path(path: str, *, reverse: bool = False) -> str:
    """Translate between the old and new project storage layouts."""
    if not path:
        return path

    pattern = NEW_PROJECT_PATH_RE if reverse else OLD_PROJECT_PATH_RE
    replacement = "projects/user_\\1/project_\\2\\3" if reverse else "projects/user_\\1/projects/project_\\2\\3"
    return pattern.sub(replacement, path, count=1)


def _move_project_directories(apps, *, reverse: bool = False):  # noqa: ANN001, ANN202
    """Move project directories on disk to match the active storage layout."""
    Project = apps.get_model("tester", "Project")

    for project in Project.objects.all().iterator():
        old_relative = Path(f"projects/user_{project.owner_id}/project_{project.id}")
        new_relative = Path(f"projects/user_{project.owner_id}/projects/project_{project.id}")

        source_relative = new_relative if reverse else old_relative
        destination_relative = old_relative if reverse else new_relative

        source_path = Path(settings.MEDIA_ROOT) / source_relative
        destination_path = Path(settings.MEDIA_ROOT) / destination_relative

        if not source_path.exists():
            continue

        if destination_path.exists():
            msg = f"Cannot move project directory from {source_relative} to {destination_relative}: destination exists."
            raise RuntimeError(msg)

        destination_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(source_path), str(destination_path))


def _update_file_field_paths(apps, *, reverse: bool = False):  # noqa: ANN001, ANN202
    """Update database file paths stored for project-scoped assets."""
    model_names = ("TestFile", "PersonalityFile", "RuleFile", "TypeFile", "SenseiCheckRule")

    for model_name in model_names:
        model = apps.get_model("tester", model_name)
        for instance in model.objects.exclude(file="").iterator():
            current_path = instance.file.name
            new_path = _translate_project_path(current_path, reverse=reverse)
            if new_path == current_path:
                continue

            instance.file.name = new_path
            instance.save(update_fields=["file"])


def _update_test_case_paths(apps, *, reverse: bool = False):  # noqa: ANN001, ANN202
    """Update copied profile paths stored in TestCase JSON metadata."""
    TestCase = apps.get_model("tester", "TestCase")

    for test_case in TestCase.objects.exclude(copied_files__isnull=True).iterator():
        copied_files = test_case.copied_files or []
        updated = False

        for copied_file in copied_files:
            if not isinstance(copied_file, dict) or "path" not in copied_file:
                continue

            new_path = _translate_project_path(copied_file["path"], reverse=reverse)
            if new_path == copied_file["path"]:
                continue

            copied_file["path"] = new_path
            updated = True

        if updated:
            test_case.copied_files = copied_files
            test_case.save(update_fields=["copied_files"])


def _update_execution_paths(apps, *, reverse: bool = False):  # noqa: ANN001, ANN202
    """Update stored execution and analysis paths that live under project directories."""
    ProfileExecution = apps.get_model("tester", "ProfileExecution")
    TracerAnalysisResult = apps.get_model("tester", "TracerAnalysisResult")

    for execution in ProfileExecution.objects.all().iterator():
        new_path = _translate_project_path(execution.profiles_directory, reverse=reverse)
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
            new_path = _translate_project_path(current_path, reverse=reverse)
            if new_path == current_path:
                continue

            setattr(analysis, field_name, new_path)
            updated_fields.append(field_name)

        if updated_fields:
            analysis.save(update_fields=updated_fields)


def move_project_storage_forward(apps: StateApps, _schema_editor: BaseDatabaseSchemaEditor) -> None:
    """Move existing project storage into the lowercase projects subdirectory."""
    _move_project_directories(apps)
    _update_file_field_paths(apps)
    _update_test_case_paths(apps)
    _update_execution_paths(apps)


def move_project_storage_backward(apps: StateApps, _schema_editor: BaseDatabaseSchemaEditor) -> None:
    """Move project storage back to the old user-level layout."""
    _move_project_directories(apps, reverse=True)
    _update_file_field_paths(apps, reverse=True)
    _update_test_case_paths(apps, reverse=True)
    _update_execution_paths(apps, reverse=True)


class Migration(migrations.Migration):
    """Migration to nest project storage under a user-level projects directory."""

    atomic: ClassVar[bool] = False
    dependencies: ClassVar[list[tuple[str, str]]] = [
        ("tester", "0008_migrate_sensei_check_rules_directory"),
    ]
    operations: ClassVar[list[migrations.RunPython]] = [
        migrations.RunPython(move_project_storage_forward, move_project_storage_backward),
    ]
