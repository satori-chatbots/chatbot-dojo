"""Chatbot Dojo host tools that can be injected into Senpai Assistant."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from django.db.models import Count, Q, QuerySet
from langchain_core.tools import BaseTool, tool
from pydantic import BaseModel, Field

from tester.models import CustomUser, ProfileExecution, Project, TestCase

TRACER_ACTIVE_STATUSES = {"PENDING", "RUNNING", "CANCELLING"}
TRACER_STATUSES = {"PENDING", "RUNNING", "SUCCESS", "FAILURE", "CANCELLING", "CANCELLED"}
SENSEI_CHAT_ACTIVE_STATUSES = {"PENDING", "RUNNING"}
SENSEI_CHAT_STATUSES = {"PENDING", "RUNNING", "SUCCESS", "FAILURE", "STOPPED", "CANCELLED"}
TRACER_LIST_LIMIT_MAX = 20
SENSEI_CHAT_LIST_LIMIT_MAX = 20
SENSEI_CHECK_LIST_LIMIT_MAX = 20
SENSEI_CHECK_TIMESTAMP_LENGTH = 15


class TracerExecutionSummaryInput(BaseModel):
    """Input for summarizing visible TRACER executions."""

    project: str | None = Field(
        default=None,
        description=(
            "Optional project display name or workspace folder name. If omitted, summarize all TRACER executions "
            "visible to the current user."
        ),
    )


class ListTracerExecutionsInput(BaseModel):
    """Input for listing visible TRACER executions."""

    project: str | None = Field(
        default=None,
        description="Optional project display name or workspace folder name.",
    )
    status: str | None = Field(
        default=None,
        description="Optional TRACER execution status: PENDING, RUNNING, SUCCESS, FAILURE, CANCELLING, or CANCELLED.",
    )
    limit: int = Field(
        default=10,
        ge=1,
        le=TRACER_LIST_LIMIT_MAX,
        description="Maximum number of executions to return, between 1 and 20.",
    )


class SenseiChatExecutionSummaryInput(BaseModel):
    """Input for summarizing visible sensei-chat executions."""

    project: str | None = Field(
        default=None,
        description=(
            "Optional project display name or workspace folder name. If omitted, summarize all sensei-chat "
            "executions visible to the current user."
        ),
    )


class ListSenseiChatExecutionsInput(BaseModel):
    """Input for listing visible sensei-chat executions."""

    project: str | None = Field(
        default=None,
        description="Optional project display name or workspace folder name.",
    )
    status: str | None = Field(
        default=None,
        description="Optional sensei-chat execution status: PENDING, RUNNING, SUCCESS, FAILURE, STOPPED, or CANCELLED.",
    )
    limit: int = Field(
        default=10,
        ge=1,
        le=SENSEI_CHAT_LIST_LIMIT_MAX,
        description="Maximum number of executions to return, between 1 and 20.",
    )


class SenseiCheckExecutionSummaryInput(BaseModel):
    """Input for summarizing visible sensei-check executions."""

    project: str | None = Field(
        default=None,
        description=(
            "Optional project display name or workspace folder name. If omitted, summarize all sensei-check "
            "executions visible to the current user."
        ),
    )


class ListSenseiCheckExecutionsInput(BaseModel):
    """Input for listing visible sensei-check executions."""

    project: str | None = Field(
        default=None,
        description="Optional project display name or workspace folder name.",
    )
    limit: int = Field(
        default=10,
        ge=1,
        le=SENSEI_CHECK_LIST_LIMIT_MAX,
        description="Maximum number of executions to return, between 1 and 20.",
    )


class ActiveExecutionsInput(BaseModel):
    """Input for listing active backend executions."""

    project: str | None = Field(
        default=None,
        description=(
            "Optional project display name or workspace folder name. If omitted, check all visible projects. "
            "This includes active TRACER and sensei-chat executions."
        ),
    )


def build_chatbot_dojo_host_tools(user: CustomUser) -> list[BaseTool]:  # noqa: C901, PLR0915
    """Return host-owned tools for Senpai Assistant, scoped to one authenticated user."""

    @tool(args_schema=TracerExecutionSummaryInput)
    def get_tracer_execution_summary(project: str | None = None) -> dict[str, Any]:
        """Return aggregate status counts for TRACER executions visible to the current user.

        Use this when the user asks about TRACER execution counts, cancelled runs, failures, active/running
        processes, or the latest TRACER execution. If the user mentions the active host project, pass that
        project name as the project argument.
        """
        executions, scope = _get_visible_tracer_executions_for_tool(user, project)
        if isinstance(executions, dict):
            return executions

        counts = _aggregate_tracer_status_counts(executions)
        latest_execution = executions.order_by("-created_at", "-id").first()
        active_names = list(
            executions.filter(status__in=TRACER_ACTIVE_STATUSES)
            .order_by("-created_at", "-id")
            .values_list("execution_name", flat=True)[:3]
        )
        return {
            **counts,
            "has_active_process": bool(active_names),
            "active_execution_names": active_names,
            "latest_execution": _serialize_tracer_execution_summary(latest_execution),
            "scope": scope,
        }

    @tool(args_schema=ListTracerExecutionsInput)
    def list_tracer_executions(
        project: str | None = None,
        status: str | None = None,
        limit: int = 10,
    ) -> dict[str, Any]:
        """List recent TRACER executions visible to the current user.

        Use this when the user asks for specific TRACER executions, recent cancelled runs, recent failures,
        running executions, or a short list with dates and projects.
        """
        executions, scope = _get_visible_tracer_executions_for_tool(user, project)
        if isinstance(executions, dict):
            return executions

        normalized_status = _normalize_tracer_status(status)
        if isinstance(normalized_status, dict):
            return normalized_status
        if normalized_status is not None:
            executions = executions.filter(status=normalized_status)

        bounded_limit = min(max(limit, 1), TRACER_LIST_LIMIT_MAX)
        rows = [
            _serialize_tracer_execution_list_item(execution)
            for execution in executions.order_by("-created_at", "-id")[:bounded_limit]
        ]
        return {
            "executions": rows,
            "count": len(rows),
            "limit": bounded_limit,
            "status_filter": normalized_status,
            "scope": scope,
        }

    @tool(args_schema=SenseiChatExecutionSummaryInput)
    def get_sensei_chat_execution_summary(project: str | None = None) -> dict[str, Any]:
        """Return aggregate status counts for sensei-chat executions visible to the current user.

        Use this when the user asks about sensei-chat runs, test executions, failed chatbot test runs,
        running profile executions against a chatbot, or the latest SENSEI execution.
        """
        executions, scope = _get_visible_sensei_chat_executions_for_tool(user, project)
        if isinstance(executions, dict):
            return executions

        counts = _aggregate_sensei_chat_status_counts(executions)
        latest_execution = executions.order_by("-executed_at", "-id").first()
        active_names = list(
            executions.filter(status__in=SENSEI_CHAT_ACTIVE_STATUSES)
            .order_by("-executed_at", "-id")
            .values_list("name", flat=True)[:3]
        )
        return {
            **counts,
            "has_active_process": bool(active_names),
            "active_execution_names": active_names,
            "latest_execution": _serialize_sensei_chat_execution_summary(latest_execution),
            "scope": scope,
        }

    @tool(args_schema=ListSenseiChatExecutionsInput)
    def list_sensei_chat_executions(
        project: str | None = None,
        status: str | None = None,
        limit: int = 10,
    ) -> dict[str, Any]:
        """List recent sensei-chat executions visible to the current user.

        Use this when the user asks which sensei-chat executions have happened, recent failures, current running
        executions, durations, conversation progress, or dates and projects for chatbot test runs.
        """
        executions, scope = _get_visible_sensei_chat_executions_for_tool(user, project)
        if isinstance(executions, dict):
            return executions

        normalized_status = _normalize_sensei_chat_status(status)
        if isinstance(normalized_status, dict):
            return normalized_status
        if normalized_status is not None:
            executions = executions.filter(status=normalized_status)

        bounded_limit = min(max(limit, 1), SENSEI_CHAT_LIST_LIMIT_MAX)
        rows = [
            _serialize_sensei_chat_execution_list_item(execution)
            for execution in executions.order_by("-executed_at", "-id")[:bounded_limit]
        ]
        return {
            "executions": rows,
            "count": len(rows),
            "limit": bounded_limit,
            "status_filter": normalized_status,
            "scope": scope,
        }

    @tool(args_schema=SenseiCheckExecutionSummaryInput)
    def get_sensei_check_execution_summary(project: str | None = None) -> dict[str, Any]:
        """Return aggregate information for persisted sensei-check executions visible to the current user.

        Use this when the user asks about SENSEI Check analysis runs, how many rule checks have been executed, or
        the latest sensei-check result. sensei-check currently runs synchronously, so active processes are not
        tracked in the database.
        """
        projects, scope = _get_visible_projects_for_tool(user, project)
        if isinstance(projects, dict):
            return projects

        executions = _get_sensei_check_executions_for_projects(projects)
        latest_execution = executions[0] if executions else None
        return {
            "total": len(executions),
            "successful": sum(1 for execution in executions if execution.get("exit_code") == 0),
            "failed": sum(
                1
                for execution in executions
                if execution.get("exit_code") is not None and execution.get("exit_code") != 0
            ),
            "unknown": sum(1 for execution in executions if execution.get("exit_code") is None),
            "has_active_process": False,
            "active_execution_names": [],
            "latest_execution": latest_execution,
            "scope": scope,
            "tracking_note": "sensei-check executions are synchronous and are inferred from result folders.",
        }

    @tool(args_schema=ListSenseiCheckExecutionsInput)
    def list_sensei_check_executions(project: str | None = None, limit: int = 10) -> dict[str, Any]:
        """List recent persisted sensei-check executions visible to the current user.

        Use this when the user asks which SENSEI Check executions have happened, where their CSV/log files are, or
        recent rule-check results.
        """
        projects, scope = _get_visible_projects_for_tool(user, project)
        if isinstance(projects, dict):
            return projects

        bounded_limit = min(max(limit, 1), SENSEI_CHECK_LIST_LIMIT_MAX)
        rows = _get_sensei_check_executions_for_projects(projects)[:bounded_limit]
        return {
            "executions": rows,
            "count": len(rows),
            "limit": bounded_limit,
            "scope": scope,
        }

    @tool(args_schema=ActiveExecutionsInput)
    def get_active_backend_executions(project: str | None = None) -> dict[str, Any]:
        """Return active TRACER and sensei-chat executions visible to the current user.

        Use this when the user asks whether there is anything running right now in TRACER, sensei-chat, SENSEI, or
        the backend execution system.
        """
        tracer_executions, tracer_scope = _get_visible_tracer_executions_for_tool(user, project)
        if isinstance(tracer_executions, dict):
            return tracer_executions
        sensei_executions, sensei_scope = _get_visible_sensei_chat_executions_for_tool(user, project)
        if isinstance(sensei_executions, dict):
            return sensei_executions

        tracer_rows = [
            _serialize_tracer_execution_list_item(execution)
            for execution in tracer_executions.filter(status__in=TRACER_ACTIVE_STATUSES).order_by("-created_at", "-id")
        ]
        sensei_rows = [
            _serialize_sensei_chat_execution_list_item(execution)
            for execution in sensei_executions.filter(status__in=SENSEI_CHAT_ACTIVE_STATUSES).order_by(
                "-executed_at", "-id"
            )
        ]
        return {
            "has_active_process": bool(tracer_rows or sensei_rows),
            "tracer": {"count": len(tracer_rows), "executions": tracer_rows},
            "sensei_chat": {"count": len(sensei_rows), "executions": sensei_rows},
            "sensei_check": {
                "count": 0,
                "executions": [],
                "tracking_note": "sensei-check executions are synchronous and are not tracked as active tasks.",
            },
            "scope": tracer_scope if tracer_scope == sensei_scope else {"tracer": tracer_scope, "sensei": sensei_scope},
        }

    return [
        get_tracer_execution_summary,
        list_tracer_executions,
        get_sensei_chat_execution_summary,
        list_sensei_chat_executions,
        get_sensei_check_execution_summary,
        list_sensei_check_executions,
        get_active_backend_executions,
    ]


def _get_visible_tracer_executions_for_tool(
    user: CustomUser,
    project: str | None,
) -> tuple[QuerySet[ProfileExecution], dict[str, Any]] | tuple[dict[str, str], dict[str, Any]]:
    executions = _get_visible_tracer_executions(user)
    scope: dict[str, Any] = {"visibility": "current_user_and_public"}
    if project is None or not project.strip():
        scope["project"] = "all_visible"
        return executions, scope

    resolved_project = _resolve_visible_project(user, project)
    if resolved_project is None:
        return {"error": f"Project not found or not visible: {project}"}, scope

    scope.update(
        {
            "project": resolved_project.name,
            "project_id": resolved_project.id,
            "project_workspace_name": resolved_project.get_project_folder_name(),
        }
    )
    return executions.filter(project=resolved_project), scope


def _get_visible_sensei_chat_executions_for_tool(
    user: CustomUser,
    project: str | None,
) -> tuple[QuerySet[TestCase], dict[str, Any]] | tuple[dict[str, str], dict[str, Any]]:
    executions = _get_visible_sensei_chat_executions(user)
    scope: dict[str, Any] = {"visibility": "current_user_and_public"}
    if project is None or not project.strip():
        scope["project"] = "all_visible"
        return executions, scope

    resolved_project = _resolve_visible_project(user, project)
    if resolved_project is None:
        return {"error": f"Project not found or not visible: {project}"}, scope

    scope.update(
        {
            "project": resolved_project.name,
            "project_id": resolved_project.id,
            "project_workspace_name": resolved_project.get_project_folder_name(),
        }
    )
    return executions.filter(project=resolved_project), scope


def _get_visible_projects_for_tool(
    user: CustomUser,
    project: str | None,
) -> tuple[list[Project], dict[str, Any]] | tuple[dict[str, str], dict[str, Any]]:
    scope: dict[str, Any] = {"visibility": "current_user_and_public"}
    if project is None or not project.strip():
        scope["project"] = "all_visible"
        return list(Project.objects.filter(Q(public=True) | Q(owner=user)).select_related("chatbot_connector")), scope

    resolved_project = _resolve_visible_project(user, project)
    if resolved_project is None:
        return {"error": f"Project not found or not visible: {project}"}, scope

    scope.update(
        {
            "project": resolved_project.name,
            "project_id": resolved_project.id,
            "project_workspace_name": resolved_project.get_project_folder_name(),
        }
    )
    return [resolved_project], scope


def _get_visible_tracer_executions(user: CustomUser) -> QuerySet[ProfileExecution]:
    return ProfileExecution.objects.filter(
        Q(project__public=True) | Q(project__owner=user),
        execution_type="tracer",
    ).select_related("project")


def _get_visible_sensei_chat_executions(user: CustomUser) -> QuerySet[TestCase]:
    return TestCase.objects.filter(Q(project__public=True) | Q(project__owner=user)).select_related("project")


def _resolve_visible_project(user: CustomUser, project: str) -> Project | None:
    normalized = project.strip()
    visible_projects = Project.objects.filter(Q(public=True) | Q(owner=user)).select_related("chatbot_connector")
    for candidate in visible_projects:
        if normalized in {candidate.name, candidate.get_project_folder_name(), str(candidate.id)}:
            return candidate
    return None


def _aggregate_tracer_status_counts(executions: QuerySet[ProfileExecution]) -> dict[str, int]:
    counts = executions.aggregate(
        total=Count("id"),
        pending=Count("id", filter=Q(status="PENDING")),
        running=Count("id", filter=Q(status="RUNNING")),
        cancelling=Count("id", filter=Q(status="CANCELLING")),
        cancelled=Count("id", filter=Q(status="CANCELLED")),
        successful=Count("id", filter=Q(status="SUCCESS")),
        failed=Count("id", filter=Q(status="FAILURE")),
    )
    return {key: int(value or 0) for key, value in counts.items()}


def _aggregate_sensei_chat_status_counts(executions: QuerySet[TestCase]) -> dict[str, int]:
    counts = executions.aggregate(
        total=Count("id"),
        pending=Count("id", filter=Q(status="PENDING")),
        running=Count("id", filter=Q(status="RUNNING")),
        successful=Count("id", filter=Q(status="SUCCESS")),
        failed=Count("id", filter=Q(status="FAILURE")),
        stopped=Count("id", filter=Q(status="STOPPED")),
        cancelled=Count("id", filter=Q(status="CANCELLED")),
    )
    return {key: int(value or 0) for key, value in counts.items()}


def _normalize_tracer_status(status: str | None) -> str | dict[str, str] | None:
    if status is None or not status.strip():
        return None
    normalized = status.strip().upper()
    if normalized not in TRACER_STATUSES:
        return {"error": f"Invalid TRACER status: {status}"}
    return normalized


def _normalize_sensei_chat_status(status: str | None) -> str | dict[str, str] | None:
    if status is None or not status.strip():
        return None
    normalized = status.strip().upper()
    if normalized not in SENSEI_CHAT_STATUSES:
        return {"error": f"Invalid sensei-chat status: {status}"}
    return normalized


def _serialize_tracer_execution_summary(execution: ProfileExecution | None) -> dict[str, Any] | None:
    if execution is None:
        return None
    return {
        "id": execution.id,
        "name": execution.execution_name,
        "status": execution.status,
        "project": execution.project.name,
        "created_at": execution.created_at.isoformat(),
    }


def _serialize_sensei_chat_execution_summary(execution: TestCase | None) -> dict[str, Any] | None:
    if execution is None:
        return None
    return {
        "id": execution.id,
        "name": execution.name,
        "status": execution.status,
        "project": execution.project.name,
        "executed_at": execution.executed_at.isoformat(),
    }


def _serialize_tracer_execution_list_item(execution: ProfileExecution) -> dict[str, Any]:
    item = {
        "id": execution.id,
        "name": execution.execution_name,
        "status": execution.status,
        "project": execution.project.name,
        "created_at": execution.created_at.isoformat(),
    }
    item.update(
        {
            "sessions": execution.sessions,
            "turns_per_session": execution.turns_per_session,
            "generated_profiles_count": execution.generated_profiles_count,
            "has_logs": bool(execution.tracer_stdout or execution.tracer_stderr),
            "error_type": execution.error_type,
        }
    )
    return item


def _serialize_sensei_chat_execution_list_item(execution: TestCase) -> dict[str, Any]:
    return {
        "id": execution.id,
        "name": execution.name,
        "status": execution.status,
        "project": execution.project.name,
        "executed_at": execution.executed_at.isoformat(),
        "execution_time": execution.execution_time,
        "technology": execution.technology,
        "llm_model": execution.llm_model,
        "llm_provider": execution.llm_provider,
        "total_conversations": execution.total_conversations,
        "executed_conversations": execution.executed_conversations,
        "has_logs": bool(execution.stdout or execution.stderr or execution.result),
        "error_message": execution.error_message,
        "celery_task_id": execution.celery_task_id or None,
    }


def _get_sensei_check_executions_for_projects(projects: list[Project]) -> list[dict[str, Any]]:
    executions: list[dict[str, Any]] = []
    for project in projects:
        results_root = Path(project.get_project_path()) / "sensei_check_results"
        if not results_root.exists() or not results_root.is_dir():
            continue

        for execution_dir in results_root.glob("execution_*"):
            if not execution_dir.is_dir():
                continue
            executions.append(_serialize_sensei_check_execution(project, execution_dir))

    return sorted(executions, key=lambda execution: (execution["created_at"] or "", execution["name"]), reverse=True)


def _serialize_sensei_check_execution(project: Project, execution_dir: Path) -> dict[str, Any]:
    log_path = execution_dir / "execution.log"
    results_path = execution_dir / "results.csv"
    exit_code = _read_sensei_check_exit_code(log_path)
    return {
        "name": execution_dir.name,
        "project": project.name,
        "project_id": project.id,
        "created_at": _sensei_check_created_at(execution_dir),
        "exit_code": exit_code,
        "status": _sensei_check_status(exit_code),
        "has_results_csv": results_path.exists(),
        "has_log": log_path.exists(),
        "results_file": str(results_path) if results_path.exists() else None,
        "log_file": str(log_path) if log_path.exists() else None,
    }


def _sensei_check_created_at(execution_dir: Path) -> str | None:
    name = execution_dir.name.removeprefix("execution_")
    if len(name) != SENSEI_CHECK_TIMESTAMP_LENGTH or name[8] != "_":
        return None
    return f"{name[:4]}-{name[4:6]}-{name[6:8]}T{name[9:11]}:{name[11:13]}:{name[13:15]}Z"


def _read_sensei_check_exit_code(log_path: Path) -> int | None:
    if not log_path.exists():
        return None
    try:
        for line in log_path.read_text(encoding="utf-8", errors="replace").splitlines():
            if not line.startswith("Exit Code:"):
                continue
            raw_exit_code = line.split(":", 1)[1].strip()
            return int(raw_exit_code)
    except (OSError, ValueError):
        return None
    return None


def _sensei_check_status(exit_code: int | None) -> str:
    if exit_code is None:
        return "UNKNOWN"
    if exit_code == 0:
        return "SUCCESS"
    return "FAILURE"
