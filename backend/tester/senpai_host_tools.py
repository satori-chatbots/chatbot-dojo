"""Chatbot Dojo host tools that can be injected into Senpai Assistant."""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Any, Literal

from django.conf import settings
from django.db.models import Count, Q, QuerySet
from langchain_core.tools import BaseTool, tool
from pydantic import BaseModel, Field

from tester import execution_services
from tester.models import CustomUser, ProfileExecution, Project, TestCase

TRACER_ACTIVE_STATUSES = {"PENDING", "RUNNING", "CANCELLING"}
TRACER_STATUSES = {"PENDING", "RUNNING", "SUCCESS", "FAILURE", "CANCELLING", "CANCELLED"}
SENSEI_CHAT_ACTIVE_STATUSES = {"PENDING", "RUNNING"}
SENSEI_CHAT_STATUSES = {"PENDING", "RUNNING", "SUCCESS", "FAILURE", "STOPPED", "CANCELLED"}
TRACER_LIST_LIMIT_MAX = 20
SENSEI_CHAT_LIST_LIMIT_MAX = 20
SENSEI_CHECK_LIST_LIMIT_MAX = 20
SENSEI_CHECK_TIMESTAMP_LENGTH = 15
DASHBOARD_ANALYSIS_LOG_TAIL_LINES_MAX = 200
DASHBOARD_ANALYSIS_TEXT_CHARS_MAX = 12000
DASHBOARD_ANALYSIS_CSV_ROWS_MAX = 50

DashboardExecutionType = Literal["tracer", "sensei-chat", "sensei-check"]


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


class AnalyzeDashboardExecutionResultsInput(BaseModel):
    """Input for collecting execution artifacts that Senpai can analyze."""

    dashboard: str = Field(
        description=(
            "Dashboard/tool to inspect: tracer, sensei-chat, or sensei-check. Accepts common variants like "
            "'sensei check' and 'sensei_chat'."
        ),
    )
    project: str | None = Field(
        default=None,
        description=(
            "Optional project display name or workspace folder name. Use it when the user asks about the active "
            "project or a specific project."
        ),
    )
    execution_id: int | None = Field(
        default=None,
        description=(
            "Optional database execution id. Supported for tracer and sensei-chat executions. For sensei-check, "
            "use execution_name because runs are stored as folders."
        ),
    )
    execution_name: str | None = Field(
        default=None,
        description=(
            "Optional execution name. For sensei-check this is the execution folder name, for example "
            "execution_20260520_101500. If omitted, the latest visible execution is used."
        ),
    )
    include_logs: bool = Field(
        default=True,
        description="Whether to include bounded stdout/stderr/log excerpts for the execution.",
    )
    log_tail_lines: int = Field(
        default=80,
        ge=1,
        le=DASHBOARD_ANALYSIS_LOG_TAIL_LINES_MAX,
        description="Maximum tail lines to include from each log-like field.",
    )


class StartTracerGenerationInput(BaseModel):
    """Input for starting a TRACER execution."""

    project: str | None = Field(
        default=None,
        description=(
            "Optional project display name, id, or workspace folder name. If omitted, the host active project is used."
        ),
    )
    sessions: int | None = Field(
        default=None,
        ge=1,
        description="Number of TRACER sessions. Ask the user if omitted.",
    )
    turns_per_session: int | None = Field(
        default=None,
        ge=1,
        description="Number of turns per TRACER session. Ask the user if omitted.",
    )
    verbosity: str | None = Field(
        default=None,
        description="Optional TRACER verbosity: normal, verbose, or debug. Defaults to normal.",
    )


class StartSenseiChatExecutionInput(BaseModel):
    """Input for starting a sensei-chat execution."""

    project: str | None = Field(
        default=None,
        description=(
            "Optional project display name, id, or workspace folder name. If omitted, the host active project is used."
        ),
    )
    profiles: list[str | int] | None = Field(
        default=None,
        description="Profile ids, names, filename stems, or filenames to execute. Ask the user if omitted.",
    )
    test_name: str | None = Field(
        default=None,
        description="Optional test execution name. If omitted, a timestamped default is used.",
    )


class StartSenseiCheckExecutionInput(BaseModel):
    """Input for starting a sensei-check execution."""

    project: str | None = Field(
        default=None,
        description=(
            "Optional project display name, id, or workspace folder name. If omitted, the host active project is used."
        ),
    )
    test_cases: list[str | int] | None = Field(
        default=None,
        description=(
            "Optional sensei-chat test case ids or names. If omitted, the latest execution for the project is used."
        ),
    )
    rules: list[str | int] | None = Field(
        default=None,
        description=(
            "Optional SENSEI Check rule ids, names, filename stems, or filenames. If omitted, all project rules are used."
        ),
    )
    verbose: bool = Field(default=False, description="Whether to execute sensei-check with verbose output.")


def build_chatbot_dojo_host_tools(  # noqa: C901, PLR0915
    user: CustomUser,
    active_project: str | None = None,
) -> list[BaseTool]:
    """Return host-owned tools for Senpai Assistant, scoped to one authenticated user."""

    def _execution_error_payload(exc: execution_services.ExecutionServiceError) -> dict[str, Any]:
        return {"status": "error", "error": str(exc), "status_code": exc.status_code}

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

    @tool(args_schema=AnalyzeDashboardExecutionResultsInput)
    def analyze_dashboard_execution_results(  # noqa: PLR0913
        dashboard: str,
        project: str | None = None,
        execution_id: int | None = None,
        execution_name: str | None = None,
        *,
        include_logs: bool = True,
        log_tail_lines: int = 80,
    ) -> dict[str, Any]:
        """Return bounded execution artifacts for Senpai to analyze dashboard results.

        Use this when the user asks Senpai to analyze, explain, diagnose, review, or summarize the actual results
        of a TRACER, sensei-chat, or sensei-check dashboard execution. Prefer passing the active project when the
        request is scoped to the current dashboard/project. If the user does not identify an execution, this tool
        inspects the latest visible execution of the requested dashboard.
        """
        normalized_dashboard = _normalize_dashboard_execution_type(dashboard)
        if isinstance(normalized_dashboard, dict):
            return normalized_dashboard

        bounded_log_tail_lines = min(max(log_tail_lines, 1), DASHBOARD_ANALYSIS_LOG_TAIL_LINES_MAX)
        if normalized_dashboard == "tracer":
            return _build_tracer_execution_analysis_context(
                user,
                project,
                execution_id,
                execution_name,
                include_logs=include_logs,
                log_tail_lines=bounded_log_tail_lines,
            )
        if normalized_dashboard == "sensei-chat":
            return _build_sensei_chat_execution_analysis_context(
                user,
                project,
                execution_id,
                execution_name,
                include_logs=include_logs,
                log_tail_lines=bounded_log_tail_lines,
            )
        return _build_sensei_check_execution_analysis_context(
            user,
            project,
            execution_name,
            include_logs=include_logs,
            log_tail_lines=bounded_log_tail_lines,
        )

    @tool(args_schema=StartTracerGenerationInput)
    def start_tracer_generation(
        project: str | None = None,
        sessions: int | None = None,
        turns_per_session: int | None = None,
        verbosity: str | None = None,
    ) -> dict[str, Any]:
        """Start TRACER profile generation for a project.

        Use this when the user asks Senpai to run, launch, start, or execute TRACER. If project is omitted, the
        host active project is used. If sessions or turns_per_session are omitted, the tool returns needs_input so
        Senpai can ask only for the missing values. Verbosity defaults to normal.
        """
        try:
            return execution_services.start_tracer_generation(
                user=user,
                project=project,
                active_project=active_project,
                sessions=sessions,
                turns_per_session=turns_per_session,
                verbosity=verbosity,
            )
        except execution_services.ExecutionServiceError as exc:
            return _execution_error_payload(exc)

    @tool(args_schema=StartSenseiChatExecutionInput)
    def start_sensei_chat_execution(
        project: str | None = None,
        profiles: list[str | int] | None = None,
        test_name: str | None = None,
    ) -> dict[str, Any]:
        """Start a sensei-chat execution for selected profiles.

        Use this when the user asks Senpai to execute profiles against the chatbot with SENSEI or sensei-chat. If
        project is omitted, the host active project is used. If test_name is omitted, a timestamped default is used.
        """
        try:
            return execution_services.start_sensei_chat_execution(
                user=user,
                project=project,
                active_project=active_project,
                profiles=profiles,
                test_name=test_name,
            )
        except execution_services.ExecutionServiceError as exc:
            return _execution_error_payload(exc)

    @tool(args_schema=StartSenseiCheckExecutionInput)
    def start_sensei_check_execution(
        project: str | None = None,
        test_cases: list[str | int] | None = None,
        rules: list[str | int] | None = None,
        *,
        verbose: bool = False,
    ) -> dict[str, Any]:
        """Start a sensei-check execution over conversation outputs.

        Use this when the user asks Senpai to run SENSEI Check. If project is omitted, the host active project is
        used. If test_cases is omitted, the latest sensei-chat execution for the project is used. If rules is
        omitted, all project rules are used.
        """
        try:
            return execution_services.start_sensei_check_execution(
                user=user,
                project=project,
                active_project=active_project,
                test_cases=test_cases,
                rules=rules,
                verbose=verbose,
            )
        except execution_services.ExecutionServiceError as exc:
            return _execution_error_payload(exc)

    return [
        get_tracer_execution_summary,
        list_tracer_executions,
        get_sensei_chat_execution_summary,
        list_sensei_chat_executions,
        get_sensei_check_execution_summary,
        list_sensei_check_executions,
        get_active_backend_executions,
        analyze_dashboard_execution_results,
        start_tracer_generation,
        start_sensei_chat_execution,
        start_sensei_check_execution,
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


def _normalize_dashboard_execution_type(dashboard: str) -> DashboardExecutionType | dict[str, str]:
    normalized = dashboard.strip().lower().replace("_", "-")
    normalized = "-".join(normalized.split())
    aliases: dict[str, DashboardExecutionType] = {
        "tracer": "tracer",
        "sensei": "sensei-chat",
        "sensei-chat": "sensei-chat",
        "sensei-dashboard": "sensei-chat",
        "chat": "sensei-chat",
        "sensei-check": "sensei-check",
        "sensei-check-dashboard": "sensei-check",
        "check": "sensei-check",
    }
    if normalized not in aliases:
        return {"error": f"Invalid dashboard execution type: {dashboard}"}
    return aliases[normalized]


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


def _build_tracer_execution_analysis_context(  # noqa: PLR0913
    user: CustomUser,
    project: str | None,
    execution_id: int | None,
    execution_name: str | None,
    *,
    include_logs: bool,
    log_tail_lines: int,
) -> dict[str, Any]:
    executions, scope = _get_visible_tracer_executions_for_tool(user, project)
    if isinstance(executions, dict):
        return executions

    execution = _resolve_queryset_execution(
        executions.order_by("-created_at", "-id"),
        execution_id=execution_id,
        execution_name=execution_name,
        name_field="execution_name",
    )
    if isinstance(execution, dict):
        return execution

    context: dict[str, Any] = {
        "dashboard": "tracer",
        "scope": scope,
        "selection": _build_execution_selection(execution_id, execution_name),
        "execution": _serialize_tracer_execution_list_item(execution),
        "analysis": None,
        "artifacts": {
            "has_report": False,
            "has_graph": False,
            "original_profiles_count": execution.original_profiles.count(),
            "original_profile_names": list(
                execution.original_profiles.order_by("original_filename").values_list("original_filename", flat=True)[
                    :10
                ]
            ),
        },
    }

    if hasattr(execution, "analysis_result"):
        analysis = execution.analysis_result
        context["analysis"] = {
            "total_interactions": analysis.total_interactions,
            "coverage_percentage": analysis.coverage_percentage,
            "unique_paths_discovered": analysis.unique_paths_discovered,
            "categories_count": analysis.categories_count,
            "estimated_cost_usd": analysis.estimated_cost_usd,
            "available_graph_formats": analysis.get_available_formats(),
        }
        context["artifacts"].update(
            {
                "has_report": bool(analysis.report_file_path),
                "has_graph": analysis.has_any_graph,
                "report_excerpt": _read_media_text_excerpt(analysis.report_file_path)
                if analysis.report_file_path
                else None,
            }
        )

    task = execution.generation_tasks.first() if execution.generation_tasks.exists() else None
    context["error"] = {
        "error_type": execution.error_type,
        "error_message": task.error_message if task and task.error_message else None,
    }
    if include_logs:
        context["logs"] = {
            "stdout_tail": _tail_text(execution.tracer_stdout, log_tail_lines),
            "stderr_tail": _tail_text(execution.tracer_stderr, log_tail_lines),
        }
    return context


def _build_sensei_chat_execution_analysis_context(  # noqa: PLR0913
    user: CustomUser,
    project: str | None,
    execution_id: int | None,
    execution_name: str | None,
    *,
    include_logs: bool,
    log_tail_lines: int,
) -> dict[str, Any]:
    executions, scope = _get_visible_sensei_chat_executions_for_tool(user, project)
    if isinstance(executions, dict):
        return executions

    execution = _resolve_queryset_execution(
        executions.order_by("-executed_at", "-id"),
        execution_id=execution_id,
        execution_name=execution_name,
        name_field="name",
    )
    if isinstance(execution, dict):
        return execution

    executed = execution.executed_conversations or 0
    total = execution.total_conversations or 0
    context: dict[str, Any] = {
        "dashboard": "sensei-chat",
        "scope": scope,
        "selection": _build_execution_selection(execution_id, execution_name),
        "execution": _serialize_sensei_chat_execution_list_item(execution),
        "progress": {
            "executed_conversations": executed,
            "total_conversations": total,
            "completion_percentage": round((executed / total) * 100, 2) if total else None,
        },
        "error": {"error_message": execution.error_message or None},
        "copied_files": execution.copied_files or [],
        "profiles_names": execution.profiles_names or [],
    }
    if include_logs:
        context["logs"] = {
            "stdout_tail": _tail_text(execution.stdout, log_tail_lines),
            "stderr_tail": _tail_text(execution.stderr, log_tail_lines),
            "result_tail": _tail_text(execution.result, log_tail_lines),
        }
    return context


def _build_sensei_check_execution_analysis_context(
    user: CustomUser,
    project: str | None,
    execution_name: str | None,
    *,
    include_logs: bool,
    log_tail_lines: int,
) -> dict[str, Any]:
    projects, scope = _get_visible_projects_for_tool(user, project)
    if isinstance(projects, dict):
        return projects

    executions = _get_sensei_check_executions_for_projects(projects)
    execution = _resolve_sensei_check_execution(executions, execution_name)
    if "error" in execution:
        return execution

    results_file = execution.get("results_file")
    csv_summary = _read_sensei_check_csv_summary(Path(results_file)) if results_file else None
    context: dict[str, Any] = {
        "dashboard": "sensei-check",
        "scope": scope,
        "selection": {"execution_name": execution_name or "latest_visible"},
        "execution": execution,
        "results": csv_summary,
    }
    if include_logs:
        log_file = execution.get("log_file")
        context["logs"] = {"execution_log_tail": _read_text_tail(Path(log_file), log_tail_lines) if log_file else ""}
    return context


def _resolve_queryset_execution(
    executions: QuerySet,
    *,
    execution_id: int | None,
    execution_name: str | None,
    name_field: str,
) -> Any:  # noqa: ANN401
    if execution_id is not None:
        execution = executions.filter(id=execution_id).first()
        if execution is None:
            return {"error": f"Execution not found or not visible: {execution_id}"}
        return execution

    if execution_name is not None and execution_name.strip():
        execution = executions.filter(**{name_field: execution_name.strip()}).first()
        if execution is None:
            return {"error": f"Execution not found or not visible: {execution_name}"}
        return execution

    execution = executions.first()
    if execution is None:
        return {"error": "No visible executions found for this dashboard."}
    return execution


def _resolve_sensei_check_execution(
    executions: list[dict[str, Any]],
    execution_name: str | None,
) -> dict[str, Any]:
    if execution_name is not None and execution_name.strip():
        normalized_name = execution_name.strip()
        for execution in executions:
            if execution["name"] == normalized_name:
                return execution
        return {"error": f"Execution not found or not visible: {execution_name}"}

    if not executions:
        return {"error": "No visible executions found for this dashboard."}
    return executions[0]


def _build_execution_selection(execution_id: int | None, execution_name: str | None) -> dict[str, Any]:
    if execution_id is not None:
        return {"execution_id": execution_id}
    if execution_name is not None and execution_name.strip():
        return {"execution_name": execution_name.strip()}
    return {"execution_name": "latest_visible"}


def _tail_text(text: str | None, lines: int) -> str:
    if not text:
        return ""
    tail = "\n".join(text.splitlines()[-lines:])
    return _truncate_text(tail, DASHBOARD_ANALYSIS_TEXT_CHARS_MAX)


def _read_text_tail(path: Path, lines: int) -> str:
    try:
        return _tail_text(path.read_text(encoding="utf-8", errors="replace"), lines)
    except OSError:
        return ""


def _read_media_text_excerpt(relative_path: str) -> str:
    return _read_text_excerpt(Path(settings.MEDIA_ROOT) / relative_path)


def _read_text_excerpt(path: Path) -> str:
    try:
        return _truncate_text(path.read_text(encoding="utf-8", errors="replace"), DASHBOARD_ANALYSIS_TEXT_CHARS_MAX)
    except OSError:
        return ""


def _truncate_text(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    return f"{text[:max_chars]}\n...[truncated]"


def _read_sensei_check_csv_summary(path: Path) -> dict[str, Any]:
    try:
        with path.open(newline="", encoding="utf-8", errors="replace") as csv_file:
            reader = csv.DictReader(csv_file)
            rows = list(reader)
    except (OSError, csv.Error):
        return {"error": "Unable to read results.csv"}

    fieldnames = reader.fieldnames or []
    sampled_rows = rows[:DASHBOARD_ANALYSIS_CSV_ROWS_MAX]
    return {
        "fieldnames": fieldnames,
        "total_rows": len(rows),
        "sampled_rows": sampled_rows,
        "sample_limit": DASHBOARD_ANALYSIS_CSV_ROWS_MAX,
        "status_counts": _count_likely_result_values(rows),
    }


def _count_likely_result_values(rows: list[dict[str, str]]) -> dict[str, int]:
    result_keys = ("result", "status", "passed", "success", "outcome")
    counts: dict[str, int] = {}
    for row in rows:
        key = next((candidate for candidate in result_keys if candidate in row), None)
        if key is None:
            continue
        value = (row.get(key) or "").strip() or "blank"
        counts[value] = counts.get(value, 0) + 1
    return counts


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
