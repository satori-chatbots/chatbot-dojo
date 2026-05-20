"""Chatbot Dojo host tools that can be injected into Senpai Assistant."""

from __future__ import annotations

from typing import Any

from django.db.models import Count, Q, QuerySet
from langchain_core.tools import BaseTool, tool
from pydantic import BaseModel, Field

from tester.models import CustomUser, ProfileExecution, Project

TRACER_ACTIVE_STATUSES = {"PENDING", "RUNNING", "CANCELLING"}
TRACER_STATUSES = {"PENDING", "RUNNING", "SUCCESS", "FAILURE", "CANCELLING", "CANCELLED"}
TRACER_LIST_LIMIT_MAX = 20


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


def build_chatbot_dojo_host_tools(user: CustomUser) -> list[BaseTool]:
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

    return [get_tracer_execution_summary, list_tracer_executions]


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


def _get_visible_tracer_executions(user: CustomUser) -> QuerySet[ProfileExecution]:
    return ProfileExecution.objects.filter(
        Q(project__public=True) | Q(project__owner=user),
        execution_type="tracer",
    ).select_related("project")


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


def _normalize_tracer_status(status: str | None) -> str | dict[str, str] | None:
    if status is None or not status.strip():
        return None
    normalized = status.strip().upper()
    if normalized not in TRACER_STATUSES:
        return {"error": f"Invalid TRACER status: {status}"}
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
