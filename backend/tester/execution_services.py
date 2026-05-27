"""Reusable execution services for TRACER, sensei-chat, and sensei-check."""

from __future__ import annotations

import shutil
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING, cast

from django.conf import settings
from django.db import transaction
from rest_framework import status

from tester.models import (
    CustomUser,
    ProfileExecution,
    ProfileGenerationTask,
    Project,
    SenseiCheckRule,
    TestCase,
    TestFile,
)

if TYPE_CHECKING:
    from rest_framework.response import Response

DEFAULT_TRACER_VERBOSITY = "normal"
VALID_TRACER_VERBOSITIES = {"normal", "verbose", "debug"}
HTTP_ERROR_STATUS_MIN = 400


class ExecutionServiceError(ValueError):
    """User-facing execution validation error with an HTTP status code."""

    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST) -> None:
        """Initialize the error."""
        super().__init__(message)
        self.status_code = status_code


def needs_input(missing: list[str], message: str, **extra: object) -> dict[str, object]:
    """Return a tool-readable missing-argument response."""
    return {"status": "needs_input", "missing": missing, "message": message, **extra}


def resolve_owned_project(
    user: CustomUser,
    project: str | int | None,
    active_project: str | None = None,
) -> Project | dict[str, object]:
    """Resolve a user-owned project, defaulting to the active project when available."""
    project_ref = str(project).strip() if project is not None else ""
    if not project_ref:
        project_ref = (active_project or "").strip()
    if not project_ref:
        return needs_input(["project"], "Necesito saber en que proyecto ejecutar la accion.")

    projects = Project.objects.filter(owner=user).select_related("chatbot_connector", "api_key")
    for candidate in projects:
        if project_ref in {str(candidate.id), candidate.name, candidate.get_project_folder_name()}:
            return candidate
    message = f"Project not found or not owned by current user: {project_ref}"
    raise ExecutionServiceError(message, status.HTTP_404_NOT_FOUND)


def start_tracer_generation(  # noqa: PLR0913
    *,
    user: CustomUser,
    project: str | int | None = None,
    active_project: str | None = None,
    sessions: int | None = None,
    turns_per_session: int | None = None,
    verbosity: str | None = None,
) -> dict[str, object]:
    """Start a TRACER profile generation task."""
    from tester.api.tasks import generate_profiles_task  # noqa: PLC0415
    from tester.api.tracer_generator import ProfileGenerationParams  # noqa: PLC0415
    from tester.api.tracer_views import TracerApiKeyManager  # noqa: PLC0415

    missing = []
    if sessions is None:
        missing.append("sessions")
    if turns_per_session is None:
        missing.append("turns_per_session")

    resolved_project = resolve_owned_project(user, project, active_project)
    if isinstance(resolved_project, dict):
        missing.extend(str(item) for item in cast("list[object]", resolved_project["missing"]))

    if missing:
        return needs_input(
            list(dict.fromkeys(missing)),
            "Necesito proyecto, numero de sesiones y turnos por sesion para ejecutar TRACER.",
        )

    project_obj = cast("Project", resolved_project)
    if not project_obj.chatbot_connector:
        message = "Project must have a chatbot connector configured."
        raise ExecutionServiceError(message)
    if not project_obj.llm_model:
        message = "Project must have an exploration model configured."
        raise ExecutionServiceError(message)

    normalized_verbosity = verbosity or DEFAULT_TRACER_VERBOSITY
    if normalized_verbosity not in VALID_TRACER_VERBOSITIES:
        message = f"Invalid verbosity level. Must be one of: {', '.join(sorted(VALID_TRACER_VERBOSITIES))}"
        raise ExecutionServiceError(message)

    api_key = TracerApiKeyManager.setup_api_key(project_obj)
    timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    execution_name = f"TRACER_{timestamp}"
    profiles_dir = project_obj.get_relative_project_path("tracer_results", execution_name.lower()).as_posix()

    execution = ProfileExecution.objects.create(
        project=project_obj,
        execution_name=execution_name,
        execution_type="tracer",
        sessions=sessions,
        turns_per_session=turns_per_session,
        verbosity=normalized_verbosity,
        status="RUNNING",
        profiles_directory=profiles_dir,
    )
    task = ProfileGenerationTask.objects.create(
        project=project_obj,
        status="PENDING",
        conversations=sessions,
        turns=turns_per_session,
        execution=execution,
    )
    params = ProfileGenerationParams(
        technology=project_obj.chatbot_connector.technology,
        conversations=sessions,
        turns=turns_per_session,
        verbosity=normalized_verbosity,
        user_id=user.id,
        api_key=api_key,
    )
    celery_task = generate_profiles_task.delay(task.id, params.__dict__)
    task.celery_task_id = celery_task.id
    task.save(update_fields=["celery_task_id"])
    return {
        "status": "started",
        "message": "Profile generation started",
        "project": project_obj.name,
        "task_id": task.id,
        "execution_id": execution.id,
        "celery_task_id": celery_task.id,
    }


def start_sensei_chat_execution(
    *,
    user: CustomUser,
    project: str | int | None = None,
    active_project: str | None = None,
    profiles: list[str | int] | None = None,
    test_name: str | None = None,
) -> dict[str, object]:
    """Start a sensei-chat execution for selected profiles."""
    from tester.api.sensei_execution_views import SenseiApiKeyManager, SenseiProfileProcessor  # noqa: PLC0415
    from tester.api.tasks import execute_sensei_test_task  # noqa: PLC0415
    from tester.api.test_runner import TestExecutionConfig  # noqa: PLC0415

    resolved_project = resolve_owned_project(user, project, active_project)
    if isinstance(resolved_project, dict):
        return resolved_project
    project_obj = cast("Project", resolved_project)
    if not profiles:
        return needs_input(["profiles"], "Necesito saber que perfiles ejecutar con sensei-chat.")

    profile_files = resolve_project_profiles(project_obj, profiles)
    execution_name = (test_name or "").strip() or f"Sensei Chat {datetime.now(UTC).strftime('%Y%m%d_%H%M%S')}"
    api_key = SenseiApiKeyManager.setup_api_key(project_obj)
    project_path = Path(project_obj.get_project_path())

    with transaction.atomic():
        technology = project_obj.chatbot_connector.technology
        test_case = TestCase.objects.create(
            project=project_obj,
            name=execution_name,
            technology=technology,
            llm_model=project_obj.llm_model or "",
            llm_provider=project_obj.llm_provider or "",
            status="RUNNING",
        )
        results_path = (
            Path(settings.MEDIA_ROOT)
            / "results"
            / f"user_{user.id}"
            / f"project_{project_obj.id}"
            / f"testcase_{test_case.id}"
        )
        user_profiles_path = project_path / "profiles" / f"testcase_{test_case.id}"
        user_profiles_path.mkdir(parents=True, exist_ok=True)
        copied_profiles = SenseiProfileProcessor.copy_and_prepare_profiles(profile_files, user_profiles_path)
        test_case.copied_files = copied_profiles
        test_case.save(update_fields=["copied_files"])

        execution_config = TestExecutionConfig(
            test_case_id=test_case.id,
            project_path=str(project_path),
            profiles_directory=f"testcase_{test_case.id}",
            results_path=str(results_path),
            technology=technology,
            api_key=api_key,
            api_provider=project_obj.llm_provider,
        )
        celery_task = execute_sensei_test_task.delay(execution_config.__dict__)
        test_case.celery_task_id = celery_task.id
        test_case.save(update_fields=["celery_task_id"])

    return {
        "status": "started",
        "message": "Sensei profile execution started",
        "project": project_obj.name,
        "test_case_id": test_case.id,
        "task_id": celery_task.id,
        "test_name": execution_name,
        "profiles": [profile.name for profile in profile_files],
    }


def resolve_project_profiles(project: Project, profile_refs: list[str | int]) -> list[TestFile]:
    """Resolve profile ids, names, filename stems, or filenames for one project."""
    resolved = []
    for profile_ref in profile_refs:
        normalized = str(profile_ref).strip()
        candidates = TestFile.objects.filter(project=project)
        if normalized.isdigit():
            candidates = candidates.filter(id=int(normalized))
        else:
            matches = []
            for profile in candidates:
                file_path = Path(profile.file.name)
                if normalized in {profile.name, file_path.name, file_path.stem}:
                    matches.append(profile)
            if len(matches) == 1:
                resolved.append(matches[0])
                continue
            if len(matches) > 1:
                message = f"Ambiguous profile selection: {normalized}"
                raise ExecutionServiceError(message)
            message = f"Profile not found in project {project.name}: {normalized}"
            raise ExecutionServiceError(message, status.HTTP_404_NOT_FOUND)

        profile = candidates.first()
        if profile is None:
            message = f"Profile not found in project {project.name}: {normalized}"
            raise ExecutionServiceError(message, status.HTTP_404_NOT_FOUND)
        resolved.append(profile)
    return resolved


def start_sensei_check_execution(  # noqa: PLR0913
    *,
    user: CustomUser,
    project: str | int | None = None,
    active_project: str | None = None,
    test_cases: list[str | int] | None = None,
    rules: list[str | int] | None = None,
    verbose: bool = False,
) -> dict[str, object]:
    """Execute sensei-check, defaulting test cases to the latest project execution."""
    resolved_project = resolve_owned_project(user, project, active_project)
    if isinstance(resolved_project, dict):
        return resolved_project
    project_obj = cast("Project", resolved_project)

    test_case_ids = resolve_project_test_cases(project_obj, test_cases)
    if isinstance(test_case_ids, dict):
        return test_case_ids

    rule_files = resolve_project_rules(project_obj, rules) if rules else None
    response = execute_sensei_check_for_project(
        project_id=str(project_obj.id),
        test_case_ids=test_case_ids,
        rule_files=rule_files,
        verbose=verbose,
    )
    if response.status_code >= HTTP_ERROR_STATUS_MIN:
        payload = response.data if isinstance(response.data, dict) else {"error": str(response.data)}
        message = str(payload.get("error", "SENSEI Check execution failed"))
        raise ExecutionServiceError(message, response.status_code)

    return {
        "status": "completed",
        "project": project_obj.name,
        "test_case_ids": test_case_ids,
        "rules": [rule.name for rule in rule_files] if rule_files else "all_project_rules",
        **(response.data if isinstance(response.data, dict) else {}),
    }


def resolve_project_test_cases(
    project: Project, test_case_refs: list[str | int] | None
) -> list[int] | dict[str, object]:
    """Resolve sensei-chat test case ids, defaulting to the latest test case for the project."""
    if not test_case_refs:
        latest = TestCase.objects.filter(project=project).order_by("-executed_at", "-id").first()
        if latest is None:
            return needs_input(
                ["test_cases"],
                "No encuentro una ejecucion previa de sensei-chat para este proyecto. Indica los test_cases.",
            )
        return [latest.id]

    resolved = []
    for test_case_ref in test_case_refs:
        normalized = str(test_case_ref).strip()
        queryset = TestCase.objects.filter(project=project)
        test_case = (
            queryset.filter(id=int(normalized)).first()
            if normalized.isdigit()
            else queryset.filter(name=normalized).first()
        )
        if test_case is None:
            message = f"Test case not found in project {project.name}: {normalized}"
            raise ExecutionServiceError(message, status.HTTP_404_NOT_FOUND)
        resolved.append(test_case.id)
    return resolved


def resolve_project_rules(project: Project, rule_refs: list[str | int]) -> list[SenseiCheckRule]:
    """Resolve sensei-check rule ids, names, filename stems, or filenames for one project."""
    resolved = []
    for rule_ref in rule_refs:
        normalized = str(rule_ref).strip()
        queryset = SenseiCheckRule.objects.filter(project=project)
        if normalized.isdigit():
            rule = queryset.filter(id=int(normalized)).first()
        else:
            rule = None
            for candidate in queryset:
                file_path = Path(candidate.file.name)
                if normalized in {candidate.name, file_path.name, file_path.stem}:
                    rule = candidate
                    break
        if rule is None:
            message = f"SENSEI Check rule not found in project {project.name}: {normalized}"
            raise ExecutionServiceError(message, status.HTTP_404_NOT_FOUND)
        resolved.append(rule)
    return resolved


def execute_sensei_check_for_project(
    *,
    project_id: str,
    test_case_ids: list[int],
    rule_files: list[SenseiCheckRule] | None = None,
    verbose: bool = False,
) -> Response:
    """Run sensei-check for selected test cases and optional selected rules."""
    from tester.api.sensei_execution_views import (  # noqa: PLC0415
        _build_sensei_command,
        _copy_conversation_files,
        _create_error_response,
        _create_success_response,
        _execute_sensei_command,
        _get_project_and_test_cases,
        _setup_execution_paths,
    )

    try:
        project, test_cases = _get_project_and_test_cases(project_id, test_case_ids)
        project_path, rules_path, execution_dir = _setup_execution_paths(project, test_case_ids)
    except ValueError as exc:
        if "not found" in str(exc).lower():
            error_status = status.HTTP_404_NOT_FOUND
        elif "rules directory" in str(exc).lower():
            error_status = status.HTTP_500_INTERNAL_SERVER_ERROR
        else:
            error_status = status.HTTP_400_BAD_REQUEST
        return _create_error_response(str(exc), error_status)

    selected_rules_path = None
    if rule_files is not None:
        selected_rules_path = execution_dir / "rules"
        selected_rules_path.mkdir(parents=True, exist_ok=True)
        for rule in rule_files:
            shutil.copy2(rule.file.path, selected_rules_path / Path(rule.file.name).name)
        rules_path = selected_rules_path

    conversations_path = execution_dir / "conversations"
    conversations_path.mkdir(parents=True, exist_ok=True)
    _copy_conversation_files(test_cases, project_path, conversations_path)
    if not any(conversations_path.rglob("*.yml")):
        return _create_error_response("No conversation files found in selected test cases", status.HTTP_400_BAD_REQUEST)

    csv_path = execution_dir / "results.csv"
    log_path = execution_dir / "execution.log"
    cmd = _build_sensei_command(rules_path, conversations_path, csv_path, verbose=verbose)
    execution_result = _execute_sensei_command(cmd, log_path, csv_path)
    if "error" in execution_result:
        return _create_error_response(
            execution_result["error"], execution_result.get("status", status.HTTP_500_INTERNAL_SERVER_ERROR)
        )

    paths = {"execution_dir": execution_dir, "csv_path": csv_path, "log_path": log_path}
    return _create_success_response(execution_result, len(test_cases), cmd, paths)
