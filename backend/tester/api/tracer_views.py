"""API views for TRACER profile generation and analysis endpoints."""

from pathlib import Path

from celery import current_app
from celery.result import AsyncResult
from cryptography.fernet import InvalidToken
from django.conf import settings
from django.db import models
from django.db.utils import DatabaseError
from django.http import FileResponse
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from tester.api.base import logger
from tester.execution_services import ExecutionServiceError, start_tracer_generation
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
        """Validate project exists and user has access for TRACER generation (requires ownership)."""
        try:
            project = Project.objects.get(id=project_id)
            if not request.user.is_authenticated or project.owner != request.user:
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
            return Response(
                {"error": "Project must have an exploration model configured."}, status=status.HTTP_400_BAD_REQUEST
            )

        return None


@api_view(["POST"])
def generate_profiles(request: Request) -> Response:
    """Generate user profiles using TRACER with sessions and turns per session."""
    try:
        result = start_tracer_generation(
            user=request.user,
            project=request.data.get("project_id"),
            sessions=request.data.get("sessions", 3),
            turns_per_session=request.data.get("turns_per_session", 8),
            verbosity=request.data.get("verbosity", "normal"),
        )
    except ExecutionServiceError as exc:
        return Response({"error": str(exc)}, status=exc.status_code)

    if result.get("status") == "needs_input":
        return Response({"error": result["message"], "missing": result["missing"]}, status=status.HTTP_400_BAD_REQUEST)

    return Response(
        {
            "message": result["message"],
            "task_id": result["task_id"],
            "execution_id": result["execution_id"],
            "celery_task_id": result["celery_task_id"],
        },
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(["GET"])
def check_tracer_generation_status(request: Request, celery_task_id: str) -> Response:  # noqa: C901, PLR0911, PLR0912
    """Check the status of a TRACER generation task using Celery task ID and synchronize database status."""
    try:
        # Get the Celery task result
        task_result = AsyncResult(celery_task_id)

        # Try to find the associated ProfileGenerationTask for this Celery task
        generation_task = None
        try:
            generation_task = ProfileGenerationTask.objects.get(celery_task_id=celery_task_id)
        except ProfileGenerationTask.DoesNotExist:
            logger.warning(f"No ProfileGenerationTask found for Celery task ID {celery_task_id}")

        if generation_task is not None:
            database_status_response = _build_tracer_database_status_response(generation_task, task_result)
            if database_status_response is not None:
                return database_status_response

        if task_result.state == "PENDING":
            return Response(
                {
                    "status": "PENDING",
                    "stage": "Task is waiting to be processed",
                    "progress": 0,
                    "generation_task_status": generation_task.status if generation_task else None,
                }
            )
        if task_result.state == "PROGRESS":
            # Task is running and sending progress updates
            meta = task_result.info
            return Response(
                {
                    "status": "RUNNING",
                    "stage": meta.get("stage", "Processing"),
                    "progress": meta.get("progress", 0),
                    "generation_task_status": generation_task.status if generation_task else None,
                }
            )
        if task_result.state == "SUCCESS":
            # Task completed successfully - ensure database is also updated
            if generation_task and generation_task.status == "RUNNING":
                logger.info(
                    f"Celery task {celery_task_id} completed, updating ProfileGenerationTask {generation_task.id} status to SUCCESS"
                )
                generation_task.status = "SUCCESS"
                generation_task.progress_percentage = 100
                generation_task.stage = "COMPLETED"
                generation_task.save()

            # Get generated files count
            generated_files = 0
            if generation_task and generation_task.execution:
                generated_files = generation_task.execution.generated_profiles_count

            return Response(
                {
                    "status": "SUCCESS",
                    "stage": "Generation completed successfully",
                    "progress": 100,
                    "generated_files": generated_files,
                    "generation_task_status": generation_task.status if generation_task else None,
                }
            )
        if task_result.state == "FAILURE":
            # Task failed - ensure database is also updated
            meta = task_result.info
            error_message = meta.get("error_message", str(meta)) if isinstance(meta, dict) else str(meta)

            if generation_task and generation_task.status == "RUNNING":
                logger.info(
                    f"Celery task {celery_task_id} failed, updating ProfileGenerationTask {generation_task.id} status to FAILURE"
                )
                generation_task.status = "FAILURE"
                generation_task.error_message = error_message
                generation_task.save()

            return Response(
                {
                    "status": "FAILURE",
                    "stage": "Generation failed",
                    "progress": 0,
                    "error_message": error_message,
                    "generation_task_status": generation_task.status if generation_task else None,
                }
            )
        if task_result.state == "REVOKED":
            if generation_task and generation_task.status in {"RUNNING", "CANCELLING"}:
                generation_task.status = "CANCELLED"
                generation_task.stage = "CANCELLED"
                generation_task.error_message = "TRACER execution cancelled by user."
                generation_task.save()
                if generation_task.execution:
                    generation_task.execution.status = "CANCELLED"
                    generation_task.execution.process_id = None
                    generation_task.execution.save(update_fields=["status", "process_id"])

            return Response(
                {
                    "status": "CANCELLED",
                    "stage": "Execution cancelled by user",
                    "progress": generation_task.progress_percentage if generation_task else 0,
                    "generation_task_status": generation_task.status if generation_task else None,
                }
            )
        return Response(
            {
                "status": task_result.state,
                "stage": "Unknown state",
                "progress": 0,
                "generation_task_status": generation_task.status if generation_task else None,
            }
        )

    except (ValueError, AttributeError, KeyError) as e:
        logger.error(f"Error checking TRACER generation status for Celery task {celery_task_id}: {e}")
        return Response({"error": "Error checking task status"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _build_tracer_database_status_response(
    generation_task: ProfileGenerationTask,
    task_result: AsyncResult,
) -> Response | None:
    """Return a DB-backed status response when Celery state is stale or transient."""
    if generation_task.status == "CANCELLED":
        return Response(
            {
                "status": "CANCELLED",
                "stage": "Execution cancelled by user",
                "progress": generation_task.progress_percentage,
                "generation_task_status": generation_task.status,
            }
        )
    if generation_task.status == "CANCELLING":
        return Response(
            {
                "status": "CANCELLING",
                "stage": "Cancelling execution",
                "progress": generation_task.progress_percentage,
                "generation_task_status": generation_task.status,
            }
        )
    if generation_task.status == "SUCCESS":
        return Response(
            {
                "status": "SUCCESS",
                "stage": "Generation completed successfully",
                "progress": 100,
                "generated_files": generation_task.execution.generated_profiles_count
                if generation_task.execution_id
                else 0,
                "generation_task_status": generation_task.status,
            }
        )
    if generation_task.status == "FAILURE":
        return Response(
            {
                "status": "FAILURE",
                "stage": "Generation failed",
                "progress": generation_task.progress_percentage,
                "error_message": generation_task.error_message,
                "generation_task_status": generation_task.status,
            }
        )
    if generation_task.status == "RUNNING" and task_result.state != "PROGRESS":
        return Response(
            {
                "status": "RUNNING",
                "stage": generation_task.stage or "Processing",
                "progress": generation_task.progress_percentage,
                "generation_task_status": generation_task.status,
            }
        )
    return None


@api_view(["POST"])
def cancel_tracer_generation(request: Request) -> Response:
    """Cancel an ongoing TRACER generation without deleting its partial logs."""
    execution_id = request.data.get("execution_id")

    if not execution_id:
        return Response({"error": "No execution ID provided."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        execution = ProfileExecution.objects.get(id=execution_id, execution_type="tracer")
    except ProfileExecution.DoesNotExist:
        return Response({"error": "TRACER execution not found."}, status=status.HTTP_404_NOT_FOUND)

    if not request.user.is_authenticated or execution.project.owner != request.user:
        return Response({"error": "You do not own this TRACER execution."}, status=status.HTTP_403_FORBIDDEN)

    generation_task = execution.generation_tasks.order_by("-created_at").first()
    if execution.status not in {"PENDING", "RUNNING", "CANCELLING"}:
        return Response(
            {"message": f"TRACER execution is not running (status: {execution.status})"},
            status=status.HTTP_200_OK,
        )

    final_status = "CANCELLING" if execution.process_id else "CANCELLED"

    if generation_task:
        generation_task.status = final_status
        generation_task.stage = "CANCELLED"
        generation_task.error_message = "TRACER execution cancelled by user."
        generation_task.save(update_fields=["status", "stage", "error_message", "updated_at"])

        if generation_task.celery_task_id:
            try:
                current_app.control.revoke(generation_task.celery_task_id, terminate=False)
            except (ValueError, AttributeError, KeyError) as e:
                logger.warning(f"Could not revoke TRACER Celery task {generation_task.celery_task_id}: {e}")

    execution.status = final_status
    if final_status == "CANCELLED":
        execution.process_id = None
        execution.save(update_fields=["status", "process_id"])
    else:
        execution.save(update_fields=["status"])

    return Response({"message": "TRACER execution cancellation requested"}, status=status.HTTP_200_OK)


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
                    "task_id": ongoing_task.id,  # Keep for backwards compatibility
                    "celery_task_id": ongoing_task.celery_task_id,  # New Celery task ID
                    "status": ongoing_task.status,
                }
            )
        return Response({"ongoing": False})
    except DatabaseError as e:
        logger.error(f"Error checking ongoing generation: {e!s}")
        return Response({"error": "A database error occurred."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
def get_tracer_executions(request: Request) -> Response:
    """Get all TRACER executions for the dashboard - includes public executions."""
    try:
        # Filter based on user authentication and project visibility
        if request.user.is_authenticated:
            # Authenticated users see their own executions and public executions
            executions = (
                ProfileExecution.objects.filter(
                    models.Q(project__public=True) | models.Q(project__owner=request.user), execution_type="tracer"
                )
                .select_related("project", "analysis_result")
                .prefetch_related("generation_tasks")
                .order_by("-created_at")
            )
        else:
            # Unauthenticated users only see public executions
            executions = (
                ProfileExecution.objects.filter(project__public=True, execution_type="tracer")
                .select_related("project", "analysis_result")
                .prefetch_related("generation_tasks")
                .order_by("-created_at")
            )

        data = [_build_tracer_execution_info(execution) for execution in executions]
        return Response({"executions": data})

    except (DatabaseError, OSError) as e:
        logger.error(f"Error fetching TRACER executions: {e!s}")
        return Response(
            {"error": "An error occurred while fetching TRACER executions."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


def _build_tracer_execution_info(execution: ProfileExecution) -> dict:
    """Build execution info dictionary for TRACER executions."""
    # Get error message and celery task ID from associated task if available
    error_message = ""
    celery_task_id = None
    progress_stage = ""
    progress_percentage = 0
    if execution.generation_tasks.exists():
        task = execution.generation_tasks.first()
        error_message = task.error_message if task.error_message else ""
        celery_task_id = task.celery_task_id
        progress_stage = task.stage or ""
        progress_percentage = task.progress_percentage

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
        "has_error": execution.status == "FAILURE",
        "error_type": execution.error_type,
        "error_message": error_message,
        "has_profiles": execution.original_profiles.exists(),
        "celery_task_id": celery_task_id,
        "progress_stage": progress_stage,
        "progress_percentage": progress_percentage,
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
        """Validate user access to a TRACER execution - allows public access for public projects."""
        try:
            execution = ProfileExecution.objects.get(id=execution_id, execution_type="tracer")
        except ProfileExecution.DoesNotExist:
            return Response({"error": "Execution not found."}, status=status.HTTP_404_NOT_FOUND), None

        # Allow access if project is public or user is the owner
        if execution.project.public or (request.user.is_authenticated and execution.project.owner == request.user):
            return None, execution

        return Response({"error": "You do not have access to this execution."}, status=status.HTTP_403_FORBIDDEN), None

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
