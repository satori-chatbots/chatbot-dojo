"""API views for TRACER profile generation and analysis endpoints."""

import threading
from pathlib import Path

from cryptography.fernet import InvalidToken
from django.conf import settings
from django.db.utils import DatabaseError
from django.http import FileResponse
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from tester.api.base import logger
from tester.api.tracer_generator import ProfileGenerationParams, TracerGenerator
from tester.models import (
    ProfileExecution,
    ProfileGenerationTask,
    Project,
    TracerAnalysisResult,
    cipher_suite,
)


class TracerApiKeyManager:
    """Handles API key setup for TRACER operations."""

    @staticmethod
    def setup_api_key(project: Project) -> str | None:
        """Load and decrypt the API key for the project, returning the key if it exists."""
        try:
            if api_key_instance := project.api_key:
                decrypted_key = cipher_suite.decrypt(api_key_instance.api_key_encrypted).decode()
                logger.info(f"API key successfully loaded for project {project.name}")
                return decrypted_key
            logger.warning(f"No API key found for project {project.name}")
        except (InvalidToken, ValueError, TypeError) as e:
            logger.error(f"Error loading/decrypting API key for project {project.name}: {e}")
            return None
        else:
            return None


class TracerProjectValidator:
    """Handles validation of project configuration for TRACER operations."""

    @staticmethod
    def validate_project_access(request: Request, project_id: int) -> tuple[Response | None, Project | None]:
        """Validate project exists and user has access."""
        try:
            project = Project.objects.get(id=project_id)
            if project.owner != request.user:
                return (
                    Response({"error": "You do not own this project."}, status=status.HTTP_403_FORBIDDEN),
                    None,
                )
        except Project.DoesNotExist:
            return (
                Response({"error": "Project not found."}, status=status.HTTP_404_NOT_FOUND),
                None,
            )

        return None, project

    @staticmethod
    def validate_project_configuration(project: Project) -> Response | None:
        """Validate project has required configuration for TRACER."""
        if not project.chatbot_connector:
            return Response(
                {"error": "Project must have a chatbot connector configured."}, status=status.HTTP_400_BAD_REQUEST
            )

        if not project.llm_model:
            return Response({"error": "Project must have an LLM model configured."}, status=status.HTTP_400_BAD_REQUEST)

        return None


@api_view(["POST"])
def generate_profiles(request: Request) -> Response:
    """Generate user profiles using TRACER with sessions and turns per session."""
    project_id = request.data.get("project_id")
    sessions = request.data.get("sessions", 3)  # Default to 3 sessions
    turns_per_session = request.data.get("turns_per_session", 8)  # Default to 8 turns per session
    verbosity = request.data.get("verbosity", "normal")  # Default to normal verbosity

    # Validate required parameters
    if not project_id:
        return Response({"error": "No project ID provided."}, status=status.HTTP_400_BAD_REQUEST)

    # Validate verbosity parameter
    valid_verbosity_levels = ["normal", "verbose", "debug"]
    if verbosity not in valid_verbosity_levels:
        return Response(
            {"error": f"Invalid verbosity level. Must be one of: {', '.join(valid_verbosity_levels)}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Validate project access
    error_response, project = TracerProjectValidator.validate_project_access(request, project_id)
    if error_response:
        return error_response

    # Validate project configuration
    config_error = TracerProjectValidator.validate_project_configuration(project)
    if config_error:
        return config_error

    # Setup API key
    api_key = TracerApiKeyManager.setup_api_key(project)

    # Create generation task
    task = ProfileGenerationTask.objects.create(
        project=project,
        status="PENDING",
        conversations=sessions,  # Store sessions in conversations field for compatibility
        turns=turns_per_session,
    )

    # Start async generation
    tracer_generator = TracerGenerator()
    params = ProfileGenerationParams(
        technology=project.chatbot_connector.technology,
        conversations=sessions,
        turns=turns_per_session,
        verbosity=verbosity,
        user_id=request.user.id,
        api_key=api_key,
    )
    threading.Thread(
        target=tracer_generator.run_async_profile_generation,
        args=(task.id, params),
    ).start()

    return Response(
        {"message": "Profile generation started", "task_id": task.id},
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(["GET"])
def check_generation_status(_request: Request, task_id: int) -> Response:
    """Check the status of a profile generation task."""
    try:
        task = ProfileGenerationTask.objects.get(id=task_id)
        # Default to generated_file_ids (legacy, usually empty)
        generated_files = len(task.generated_file_ids)
        # If the task is completed and has a linked execution, use its generated_profiles_count
        if task.status == "COMPLETED" and task.execution is not None:
            generated_files = task.execution.generated_profiles_count
        return Response(
            {
                "status": task.status,
                "stage": task.stage,
                "progress": task.progress_percentage,
                "generated_files": generated_files,
                "error_message": task.error_message,
            }
        )
    except ProfileGenerationTask.DoesNotExist:
        return Response({"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND)


@api_view(["GET"])
def check_ongoing_generation(_request: Request, project_id: int) -> Response:
    """Check if there's an ongoing profile generation task for the project."""
    try:
        ongoing_task = (
            ProfileGenerationTask.objects.filter(project_id=project_id, status__in=["PENDING", "RUNNING"])
            .order_by("-created_at")
            .first()
        )

        if ongoing_task:
            return Response(
                {
                    "ongoing": True,
                    "task_id": ongoing_task.id,
                    "status": ongoing_task.status,
                }
            )
        return Response({"ongoing": False})
    except DatabaseError as e:
        logger.error(f"Error checking ongoing generation: {e!s}")
        return Response({"error": "A database error occurred."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
def get_tracer_executions(request: Request) -> Response:
    """Get all TRACER executions across all user projects for the dashboard."""
    try:
        # Get all TRACER executions for user's projects
        executions = (
            ProfileExecution.objects.filter(project__owner=request.user, execution_type="tracer")
            .select_related("project", "analysis_result")
            .prefetch_related("generation_tasks")
            .order_by("-created_at")
        )

        data = [
            {
                "id": execution.id,
                "project_id": execution.project.id,
                "project_name": execution.project.name,
                "execution_name": execution.execution_name,
                "sessions": execution.sessions,
                "turns_per_session": execution.turns_per_session,
                "verbosity": execution.verbosity,
                "status": execution.status,
                "error_type": execution.error_type,
                "error_message": execution.generation_tasks.first().error_message
                if execution.generation_tasks.exists() and execution.generation_tasks.first().error_message
                else None,
                "execution_time_minutes": execution.execution_time_minutes,
                "created_at": execution.created_at.isoformat(),
                "generated_profiles_count": execution.generated_profiles_count,
                "has_report": hasattr(execution, "analysis_result")
                and bool(execution.analysis_result.report_file_path),
                "has_graph": hasattr(execution, "analysis_result") and execution.analysis_result.has_any_graph,
                "has_profiles": execution.original_profiles.exists(),
                "has_logs": bool(execution.tracer_stdout or execution.tracer_stderr),
            }
            for execution in executions
        ]
        return Response({"executions": data})

    except (DatabaseError, OSError) as e:
        logger.error(f"Error fetching TRACER executions: {e!s}")
        return Response(
            {"error": "An error occurred while fetching TRACER executions."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


def _build_tracer_execution_info(execution: ProfileExecution) -> dict:
    """Build execution info dictionary for TRACER executions."""
    # Get error message from associated task if available
    error_message = ""
    if execution.generation_tasks.exists():
        task = execution.generation_tasks.first()
        error_message = task.error_message if task.error_message else ""

    execution_info = {
        "id": execution.id,
        "execution_name": execution.execution_name,
        "project_name": execution.project.name,
        "project_id": execution.project.id,
        "status": execution.status,
        "created_at": execution.created_at.isoformat(),
        "sessions": execution.sessions,
        "turns_per_session": execution.turns_per_session,
        "verbosity": execution.verbosity,
        "execution_time_minutes": execution.execution_time_minutes,
        "generated_profiles_count": execution.generated_profiles_count,
        "has_analysis": hasattr(execution, "analysis_result"),
        "analysis": None,
        "has_logs": bool(execution.tracer_stdout or execution.tracer_stderr),
        "has_error": execution.status == "ERROR",
        "error_message": error_message,
    }

    # Add analysis data if available
    if hasattr(execution, "analysis_result"):
        analysis = execution.analysis_result
        execution_info["analysis"] = {
            "total_interactions": analysis.total_interactions,
            "coverage_percentage": analysis.coverage_percentage,
            "unique_paths_discovered": analysis.unique_paths_discovered,
            "categories_count": analysis.categories_count,
            "estimated_cost_usd": analysis.estimated_cost_usd,
            "has_report": bool(analysis.report_file_path),
            "has_graph": analysis.has_any_graph,
            "available_formats": analysis.get_available_formats(),
        }

    return execution_info


class TracerExecutionAccessValidator:
    """Validates access to TRACER execution resources."""

    @staticmethod
    def validate_tracer_execution_access(
        request: Request, execution_id: int
    ) -> tuple[Response | None, ProfileExecution | None]:
        """Validate user access to a TRACER execution."""
        try:
            execution = ProfileExecution.objects.get(id=execution_id, execution_type="tracer")
        except ProfileExecution.DoesNotExist:
            return Response({"error": "Execution not found."}, status=status.HTTP_404_NOT_FOUND), None

        if execution.project.owner != request.user:
            return Response({"error": "You do not own this execution."}, status=status.HTTP_403_FORBIDDEN), None

        return None, execution

    @staticmethod
    def validate_analysis_result_access(execution: ProfileExecution) -> Response | None:
        """Validate that execution has analysis result."""
        if not hasattr(execution, "analysis_result"):
            return Response({"error": "No analysis result found for this execution."}, status=status.HTTP_404_NOT_FOUND)

        return None


@api_view(["GET"])
def get_tracer_analysis_report(request: Request, execution_id: int) -> Response:
    """Get the analysis report content for a TRACER execution."""
    try:
        # Validate access
        error_response, execution = TracerExecutionAccessValidator.validate_tracer_execution_access(
            request, execution_id
        )
        if error_response:
            return error_response

        # Validate analysis result
        analysis_error = TracerExecutionAccessValidator.validate_analysis_result_access(execution)
        if analysis_error:
            return analysis_error

        analysis = execution.analysis_result
        if not analysis.report_file_path:
            return Response({"error": "No report file found for this execution."}, status=status.HTTP_404_NOT_FOUND)

        # Read report content
        report_path = Path(settings.MEDIA_ROOT) / analysis.report_file_path
        if not report_path.exists():
            return Response({"error": "Report file not found on disk."}, status=status.HTTP_404_NOT_FOUND)

        with report_path.open("r", encoding="utf-8") as f:
            report_content = f.read()

        return Response(
            {
                "report_content": report_content,
                "execution_name": execution.execution_name,
                "project_name": execution.project.name,
            }
        )

    except (OSError, PermissionError, FileNotFoundError) as e:
        logger.error(f"Error reading report file for execution {execution_id}: {e}")
        return Response(
            {"error": "An error occurred while reading the report file."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["GET"])
def get_tracer_workflow_graph(request: Request, execution_id: int) -> Response | FileResponse:
    """Get the workflow graph content for a TRACER execution.

    If 'graph_format' query parameter is provided, it serves the file for download.
    Otherwise, it returns JSON with SVG content for inline display.
    """
    try:
        # Validate access
        error_response, execution = TracerExecutionAccessValidator.validate_tracer_execution_access(
            request, execution_id
        )
        if error_response:
            return error_response

        # Validate analysis result
        analysis_error = TracerExecutionAccessValidator.validate_analysis_result_access(execution)
        if analysis_error:
            return analysis_error

        analysis = execution.analysis_result
        if not analysis.has_any_graph:
            return Response({"error": "No workflow graph found for this execution."}, status=status.HTTP_404_NOT_FOUND)

        # Handle graph format and download logic
        return _handle_graph_request(request, execution, analysis)

    except (OSError, PermissionError, FileNotFoundError, DatabaseError) as e:
        logger.error(f"Error fetching TRACER graph for execution {execution_id}: {e}")
        return Response(
            {"error": "An error occurred while fetching the workflow graph."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


def _handle_graph_request(
    request: Request, execution: ProfileExecution, analysis: TracerAnalysisResult
) -> Response | FileResponse:
    """Handle graph request logic for different formats and download modes."""
    requested_format = _get_requested_graph_format(request, analysis)
    if requested_format is None:
        return Response({"error": "No graph formats available."}, status=status.HTTP_404_NOT_FOUND)

    is_download = bool(request.GET.get("graph_format", "") or request.GET.get("format", ""))
    available_formats = analysis.get_available_formats()

    if is_download and requested_format not in available_formats:
        return Response(
            {"error": f"Format '{requested_format}' not available for this execution."},
            status=status.HTTP_404_NOT_FOUND,
        )

    graph_path = _get_graph_path(analysis, requested_format)
    if not graph_path:
        return Response(
            {"error": f"No {requested_format.upper()} graph found for this execution."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if is_download:
        return _serve_graph_file_for_download(graph_path, execution, requested_format)

    if requested_format == "svg":
        return _serve_inline_svg(graph_path, execution, requested_format, analysis)

    return Response(
        {"error": f"Unsupported request for format: {requested_format}"},
        status=status.HTTP_400_BAD_REQUEST,
    )


def _get_requested_graph_format(request: Request, analysis: TracerAnalysisResult) -> str | None:
    requested_format = request.GET.get("graph_format", "").lower()
    if not requested_format:
        requested_format = request.GET.get("format", "").lower()
    available_formats = analysis.get_available_formats()
    if not requested_format:
        if "svg" in available_formats:
            return "svg"
        return available_formats[0] if available_formats else None
    return requested_format


def _get_graph_path(analysis: TracerAnalysisResult, requested_format: str) -> Path | None:
    graph_path_field = f"workflow_graph_{requested_format}_path"
    graph_path_str = getattr(analysis, graph_path_field, "")
    if not graph_path_str:
        return None
    return Path(settings.MEDIA_ROOT) / graph_path_str


def _serve_graph_file_for_download(
    graph_path: Path, execution: ProfileExecution, requested_format: str
) -> FileResponse | Response:
    if not graph_path.exists():
        return Response({"error": "Workflow graph file not found on disk."}, status=status.HTTP_404_NOT_FOUND)
    try:
        return FileResponse(
            graph_path.open("rb"),
            as_attachment=True,
            filename=f"{execution.execution_name}_workflow_graph.{requested_format}",
        )
    except FileNotFoundError:
        return Response({"error": "File not found on server."}, status=status.HTTP_404_NOT_FOUND)


def _serve_inline_svg(
    graph_path: Path, execution: ProfileExecution, requested_format: str, analysis: TracerAnalysisResult
) -> Response:
    if not graph_path.exists():
        return Response({"error": "Workflow graph file not found on disk."}, status=status.HTTP_404_NOT_FOUND)
    with graph_path.open("r", encoding="utf-8") as f:
        graph_content = f.read()
    return Response(
        {
            "file_type": "svg",
            "graph_content": graph_content,
            "execution_name": execution.execution_name,
            "project_name": execution.project.name,
            "available_formats": analysis.get_available_formats(),
        }
    )


@api_view(["GET"])
def get_tracer_original_profiles(request: Request, execution_id: int) -> Response:
    """Get the original read-only profiles for a TRACER execution."""
    try:
        # Validate access
        error_response, execution = TracerExecutionAccessValidator.validate_tracer_execution_access(
            request, execution_id
        )
        if error_response:
            return error_response

        # Get original profiles
        original_profiles = execution.original_profiles.all().order_by("original_filename")

        # In get_tracer_original_profiles, replace the for loop with a list comprehension
        profiles_data = [
            {
                "id": profile.id,
                "filename": profile.original_filename,
                "content": profile.original_content,
                "created_at": profile.created_at.isoformat(),
            }
            for profile in original_profiles
        ]

        return Response(
            {
                "profiles": profiles_data,
                "execution_name": execution.execution_name,
                "project_name": execution.project.name,
            }
        )

    except (OSError, DatabaseError, FileNotFoundError, PermissionError) as e:
        logger.error(f"Error fetching original profiles for execution {execution_id}: {e}")
        return Response(
            {"error": "An error occurred while fetching the original profiles."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
def get_tracer_execution_logs(request: Request, execution_id: int) -> Response:
    """Get the TRACER execution logs (stdout and stderr) for debugging failed executions."""
    try:
        # Validate access
        error_response, execution = TracerExecutionAccessValidator.validate_tracer_execution_access(
            request, execution_id
        )
        if error_response:
            return error_response

        return Response(
            {
                "execution_name": execution.execution_name,
                "project_name": execution.project.name,
                "status": execution.status,
                "stdout": execution.tracer_stdout or "",
                "stderr": execution.tracer_stderr or "",
                "verbosity": execution.verbosity,
                "created_at": execution.created_at.isoformat(),
                "error_type": execution.error_type,
                "error_message": execution.generation_tasks.first().error_message
                if execution.generation_tasks.exists() and execution.generation_tasks.first().error_message
                else None,
            }
        )

    except (OSError, DatabaseError, FileNotFoundError, PermissionError) as e:
        logger.error(f"Error fetching TRACER logs for execution {execution_id}: {e}")
        return Response(
            {"error": "An error occurred while fetching the execution logs."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
