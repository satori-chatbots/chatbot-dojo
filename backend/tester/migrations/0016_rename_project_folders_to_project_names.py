"""Rename project storage folders from project IDs to project names."""

from __future__ import annotations

import re
import shutil
from pathlib import Path
from typing import TYPE_CHECKING, Any, ClassVar

import yaml
from django.conf import settings
from django.db import migrations

if TYPE_CHECKING:
    from django.db.backends.base.schema import BaseDatabaseSchemaEditor
    from django.db.migrations.state import StateApps

PATH_SEPARATOR_PATTERN = re.compile(r"[\\/]+")
PROJECT_FOLDER_INVALID_CHARS = {"\n", "\r", "\t", "`"}


def _sanitize_project_name_for_folder(project_name: Any) -> str | None:  # noqa: ANN401
    raw_name = str(project_name).replace("\x00", "").strip()
    if not raw_name or any(char in raw_name for char in PROJECT_FOLDER_INVALID_CHARS):
        return None

    path_segments = PATH_SEPARATOR_PATTERN.split(raw_name)
    if any(segment in {".", ".."} for segment in path_segments):
        return None

    safe_name = PATH_SEPARATOR_PATTERN.sub("_", raw_name).strip(" .")
    return safe_name or None


def _folder_for_project(project: Any, *, named: bool) -> str:  # noqa: ANN401
    if named:
        folder_name = _sanitize_project_name_for_folder(project.name)
        if folder_name:
            return folder_name
    return f"project_{project.id}"


def _project_prefix(user_id: int, folder_name: str) -> str:
    return (Path("users") / f"user_{user_id}" / "projects" / folder_name).as_posix()


def _translate_path(path: str, user_id: int, old_folder_name: str, new_folder_name: str) -> str:
    if not path:
        return path

    old_prefix = _project_prefix(user_id, old_folder_name)
    new_prefix = _project_prefix(user_id, new_folder_name)
    if path == old_prefix:
        return new_prefix
    if path.startswith(f"{old_prefix}/"):
        return f"{new_prefix}{path[len(old_prefix):]}"
    return path


def _translate_json(value: Any, user_id: int, old_folder_name: str, new_folder_name: str) -> Any:  # noqa: ANN401
    if isinstance(value, str):
        return _translate_path(value, user_id, old_folder_name, new_folder_name)
    if isinstance(value, list):
        return [_translate_json(item, user_id, old_folder_name, new_folder_name) for item in value]
    if isinstance(value, dict):
        return {key: _translate_json(item, user_id, old_folder_name, new_folder_name) for key, item in value.items()}
    return value


def _move_project_directory(project: Any, old_folder_name: str, new_folder_name: str) -> None:  # noqa: ANN401
    source_relative = Path(_project_prefix(project.owner_id, old_folder_name))
    destination_relative = Path(_project_prefix(project.owner_id, new_folder_name))
    source_path = Path(settings.MEDIA_ROOT) / source_relative
    destination_path = Path(settings.MEDIA_ROOT) / destination_relative

    if not source_path.exists():
        return

    if destination_path.exists():
        msg = f"Cannot move project directory from {source_relative} to {destination_relative}: destination exists."
        raise RuntimeError(msg)

    destination_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(source_path), str(destination_path))


def _update_run_yml(project: Any, folder_name: str) -> None:  # noqa: ANN401
    run_yml_path = Path(settings.MEDIA_ROOT) / _project_prefix(project.owner_id, folder_name) / "run.yml"
    if not run_yml_path.exists():
        return

    with run_yml_path.open(encoding="utf-8") as run_yml_file:
        config = yaml.safe_load(run_yml_file) or {}
    if not isinstance(config, dict):
        config = {}
    config["project_folder"] = folder_name
    with run_yml_path.open("w", encoding="utf-8") as run_yml_file:
        yaml.safe_dump(config, run_yml_file, sort_keys=False, allow_unicode=True)


def _update_file_references(apps: StateApps, project: Any, old_folder_name: str, new_folder_name: str) -> None:  # noqa: ANN401
    file_model_names = ("TestFile", "PersonalityFile", "RuleFile", "TypeFile", "SenseiCheckRule")
    for model_name in file_model_names:
        model = apps.get_model("tester", model_name)
        for instance in model.objects.filter(project=project).exclude(file="").iterator():
            current_path = instance.file.name
            new_path = _translate_path(current_path, project.owner_id, old_folder_name, new_folder_name)
            if new_path == current_path:
                continue
            instance.file.name = new_path
            instance.save(update_fields=["file"])


def _update_test_case_references(
    apps: StateApps,
    project: Any,  # noqa: ANN401
    old_folder_name: str,
    new_folder_name: str,
) -> None:
    TestCase = apps.get_model("tester", "TestCase")
    for test_case in TestCase.objects.filter(project=project).iterator():
        update_fields = []
        copied_files = _translate_json(test_case.copied_files, project.owner_id, old_folder_name, new_folder_name)
        if copied_files != test_case.copied_files:
            test_case.copied_files = copied_files
            update_fields.append("copied_files")

        profiles_names = _translate_json(test_case.profiles_names, project.owner_id, old_folder_name, new_folder_name)
        if profiles_names != test_case.profiles_names:
            test_case.profiles_names = profiles_names
            update_fields.append("profiles_names")

        if update_fields:
            test_case.save(update_fields=update_fields)


def _update_execution_references(
    apps: StateApps,
    project: Any,  # noqa: ANN401
    old_folder_name: str,
    new_folder_name: str,
) -> None:
    ProfileExecution = apps.get_model("tester", "ProfileExecution")
    for execution in ProfileExecution.objects.filter(project=project).iterator():
        current_path = execution.profiles_directory
        new_path = _translate_path(current_path, project.owner_id, old_folder_name, new_folder_name)
        if new_path == current_path:
            continue
        execution.profiles_directory = new_path
        execution.save(update_fields=["profiles_directory"])


def _update_analysis_references(
    apps: StateApps,
    project: Any,  # noqa: ANN401
    old_folder_name: str,
    new_folder_name: str,
) -> None:
    TracerAnalysisResult = apps.get_model("tester", "TracerAnalysisResult")
    analysis_fields = ("report_file_path", "workflow_graph_svg_path", "workflow_graph_png_path", "workflow_graph_pdf_path")
    for analysis in TracerAnalysisResult.objects.filter(execution__project=project).iterator():
        update_fields = []
        for field_name in analysis_fields:
            current_path = getattr(analysis, field_name)
            new_path = _translate_path(current_path, project.owner_id, old_folder_name, new_folder_name)
            if new_path == current_path:
                continue
            setattr(analysis, field_name, new_path)
            update_fields.append(field_name)
        if update_fields:
            analysis.save(update_fields=update_fields)


def _update_references(apps: StateApps, project: Any, old_folder_name: str, new_folder_name: str) -> None:  # noqa: ANN401
    _update_file_references(apps, project, old_folder_name, new_folder_name)
    _update_test_case_references(apps, project, old_folder_name, new_folder_name)
    _update_execution_references(apps, project, old_folder_name, new_folder_name)
    _update_analysis_references(apps, project, old_folder_name, new_folder_name)


def rename_project_folders_forward(apps: StateApps, _schema_editor: BaseDatabaseSchemaEditor) -> None:
    """Rename existing project folders to their user-facing project names."""
    Project = apps.get_model("tester", "Project")

    for project in Project.objects.all().iterator():
        old_folder_name = _folder_for_project(project, named=False)
        new_folder_name = _folder_for_project(project, named=True)
        if old_folder_name == new_folder_name:
            continue

        _move_project_directory(project, old_folder_name, new_folder_name)
        _update_references(apps, project, old_folder_name, new_folder_name)
        _update_run_yml(project, new_folder_name)


def rename_project_folders_backward(apps: StateApps, _schema_editor: BaseDatabaseSchemaEditor) -> None:
    """Rename project folders back to their historical project_<id> names."""
    Project = apps.get_model("tester", "Project")

    for project in Project.objects.all().iterator():
        old_folder_name = _folder_for_project(project, named=True)
        new_folder_name = _folder_for_project(project, named=False)
        if old_folder_name == new_folder_name:
            continue

        _move_project_directory(project, old_folder_name, new_folder_name)
        _update_references(apps, project, old_folder_name, new_folder_name)
        _update_run_yml(project, new_folder_name)


class Migration(migrations.Migration):
    """Migration to make project folders use project display names."""

    atomic: ClassVar[bool] = False
    dependencies: ClassVar[list[tuple[str, str]]] = [
        ("tester", "0015_remove_legacy_senpai_connector_exports"),
    ]
    operations: ClassVar[list[migrations.RunPython]] = [
        migrations.RunPython(rename_project_folders_forward, rename_project_folders_backward),
    ]
