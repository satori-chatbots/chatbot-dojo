"""API views for Sensei profile execution endpoints using sensei-chat/user-simulator.

This module handles the execution of user profiles through the Sensei system,
which is separate from TRACER profile generation. Sensei takes generated profiles
and executes them against chatbot systems for testing.
"""

import shutil
from pathlib import Path

import yaml
from celery import current_app
from celery.result import AsyncResult
from cryptography.fernet import InvalidToken
from django.conf import settings
from django.db import transaction
from django.db.models import QuerySet
from django.db.utils import DatabaseError
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from tester.api.base import logger
from tester.api.tasks import execute_sensei_test_task
from tester.api.test_runner import TestExecutionConfig
from tester.models import (
    ProfileExecution,
    Project,
    TestCase,
    TestFile,
    cipher_suite,
)


class SenseiApiKeyManager:
    """Handles API key setup for Sensei profile execution operations."""

    @staticmethod
    def setup_api_key(project: Project) -> str | None:
        """Load and decrypt the API key for the project, returning the key if it exists."""
        try:
            if api_key_instance := project.api_key:
                decrypted_key = cipher_suite.decrypt(api_key_instance.api_key_encrypted).decode()
                logger.info(f"API key successfully loaded for Sensei execution in project {project.name}")
                return decrypted_key
            logger.warning(f"No API key found for Sensei execution in project {project.name}")
        except (InvalidToken, ValueError, TypeError) as e:
            logger.error(f"Error loading/decrypting API key for Sensei execution in project {project.name}: {e}")
            return None
        else:
            return None


class SenseiExecutionValidator:
    """Handles validation for Sensei profile execution requests."""

    @staticmethod
    def validate_execution_request(
        request: Request,
    ) -> tuple[Response | None, Project | None, QuerySet[TestFile] | None]:
        """Validate the incoming Sensei execution request and return an error Response or the required data."""
        if not request.user.is_authenticated:
            return (
                Response(
                    {"error": "Authentication required to execute profiles with Sensei."},
                    status=status.HTTP_401_UNAUTHORIZED,
                ),
                None,
                None,
            )

        selected_ids = request.data.get("test_file_ids", [])
        project_id = request.data.get("project_id")

        if not selected_ids or not project_id:
            return (
                Response(
                    {"error": "Project and profile file IDs are required for Sensei execution."},
                    status=status.HTTP_400_BAD_REQUEST,
                ),
                None,
                None,
            )

        try:
            project = Project.objects.get(id=project_id)
            if project.owner != request.user:
                return Response({"error": "You do not own this project."}, status=status.HTTP_403_FORBIDDEN), None, None
        except Project.DoesNotExist:
            return (
                Response(
                    {"error": "Project not found, make sure to create a project first."},
                    status=status.HTTP_404_NOT_FOUND,
                ),
                None,
                None,
            )

        profile_files = TestFile.objects.filter(id__in=selected_ids)
        if not profile_files.exists():
            return (
                Response(
                    {"error": "No valid profile files found for the provided IDs."},
                    status=status.HTTP_400_BAD_REQUEST,
                ),
                None,
                None,
            )

        return None, project, profile_files


class SenseiProfileProcessor:
    """Handles processing of profile files for Sensei execution."""

    @staticmethod
    def copy_and_prepare_profiles(profile_files: list[TestFile], user_profiles_path: Path) -> list[dict[str, str]]:
        """Copy profile files to a temporary location and extract metadata for Sensei execution."""
        copied_files = []
        for profile_file in profile_files:
            source_path = Path(profile_file.file.path)
            if not source_path.exists():
                continue

            dest_path = Path(shutil.copy(source_path, user_profiles_path))
            rel_path = str(dest_path.relative_to(settings.MEDIA_ROOT))

            profile_name = "Unknown"
            try:
                with source_path.open(encoding="utf-8") as f:
                    data = yaml.safe_load(f)
                    profile_name = data.get("test_name", profile_name)
            except yaml.YAMLError as e:
                logger.error(f"Error loading YAML profile from {source_path}: {e}")

            copied_files.append({"path": rel_path, "name": profile_name})
        return copied_files


class ExecuteSelectedProfilesAPIView(APIView):
    """API view to execute selected profiles using Sensei (sensei-chat/user-simulator)."""

    def post(self, request: Request) -> Response:
        """Execute selected profile files using Sensei system.

        This creates a TestCase instance and runs the profiles through the Sensei
        execution system (sensei-chat/user-simulator) against the configured chatbot.
        """
        error_response, project, profile_files = SenseiExecutionValidator.validate_execution_request(request)
        if error_response:
            return error_response

        execution_name = request.data.get("test_name")
        api_key = SenseiApiKeyManager.setup_api_key(project)

        base_dir = Path(settings.BASE_DIR)
        sensei_script_path = str(base_dir / "user-simulator" / "src" / "sensei_chat.py")
        project_path = Path(settings.MEDIA_ROOT) / "projects" / f"user_{request.user.id}" / f"project_{project.id}"

        with transaction.atomic():
            technology = project.chatbot_connector.technology

            test_case = TestCase.objects.create(
                project=project,
                name=execution_name,
                technology=technology,
                llm_model=project.llm_model or "",
                llm_provider=project.llm_provider or "",
            )
            test_case.status = "RUNNING"

            results_path = (
                Path(settings.MEDIA_ROOT)
                / "results"
                / f"user_{request.user.id}"
                / f"project_{project.id}"
                / f"testcase_{test_case.id}"
            )
            user_profiles_path = project_path / "profiles" / f"testcase_{test_case.id}"
            user_profiles_path.mkdir(parents=True, exist_ok=True)

            copied_profiles = SenseiProfileProcessor.copy_and_prepare_profiles(list(profile_files), user_profiles_path)
            test_case.copied_files = copied_profiles
            test_case.save()

            execution_config = TestExecutionConfig(
                test_case_id=test_case.id,
                script_path=sensei_script_path,
                project_path=str(project_path),
                profiles_directory=f"testcase_{test_case.id}",
                results_path=str(results_path),
                technology=technology,
                api_key=api_key,
                api_provider=project.llm_provider,
            )

            # Convert config to dict for Celery serialization
            config_dict = {
                "test_case_id": execution_config.test_case_id,
                "script_path": execution_config.script_path,
                "project_path": execution_config.project_path,
                "profiles_directory": execution_config.profiles_directory,
                "results_path": execution_config.results_path,
                "technology": execution_config.technology,
                "api_key": execution_config.api_key,
                "api_provider": execution_config.api_provider,
            }

            # Start Celery task for asynchronous execution
            task = execute_sensei_test_task.delay(config_dict)

            # Store the task ID in the test case for progress tracking
            test_case.celery_task_id = task.id
            test_case.save()

        return Response(
            {
                "message": "Sensei profile execution started",
                "test_case_id": test_case.id,
                "task_id": task.id,
                "total_conversations": "Calculating...",
            },
            status=status.HTTP_202_ACCEPTED,
        )


class SenseiExecutionStatusManager:
    """Handles status checking and synchronization for Sensei execution tasks."""

    def __init__(self, task_id: str) -> None:
        """Initialize the status manager."""
        self.task_id = task_id
        self.task_result = AsyncResult(task_id)
        self.test_case = self._get_test_case()

    def _get_test_case(self) -> TestCase | None:
        """Retrieve the test case associated with the task ID."""
        try:
            return TestCase.objects.get(celery_task_id=self.task_id)
        except TestCase.DoesNotExist:
            logger.warning(f"No test case found for task ID {self.task_id}")
            return None

    def get_status_response(self) -> Response:
        """Return a Response object based on the task's current state."""
        state_handler_map = {
            "PENDING": self._handle_pending,
            "PROGRESS": self._handle_progress,
            "SUCCESS": self._handle_success,
            "FAILURE": self._handle_failure,
            "REVOKED": self._handle_revoked,
        }
        handler = state_handler_map.get(self.task_result.state, self._handle_unknown)
        return handler()

    def _handle_pending(self) -> Response:
        """Handle the PENDING state."""
        return Response(
            {
                "status": "PENDING",
                "stage": "Task is waiting to be processed",
                "progress": 0,
                "test_case_status": self.test_case.status if self.test_case else None,
            }
        )

    def _handle_progress(self) -> Response:
        """Handle the PROGRESS state."""
        meta = self.task_result.info
        return Response(
            {
                "status": "RUNNING",
                "stage": meta.get("stage", "Processing"),
                "progress": meta.get("progress", 0),
                "executed_conversations": meta.get("executed_conversations", 0),
                "total_conversations": meta.get("total_conversations", 0),
                "test_case_status": self.test_case.status if self.test_case else None,
            }
        )

    def _handle_success(self) -> Response:
        """Handle the SUCCESS state and update the database."""
        if self.test_case and self.test_case.status == "RUNNING":
            logger.info(f"Celery task {self.task_id} completed, updating test case {self.test_case.id} to SUCCESS")
            self.test_case.status = "SUCCESS"
            self.test_case.save()
        return Response(
            {
                "status": "SUCCESS",
                "stage": "Execution completed successfully",
                "progress": 100,
                "test_case_status": self.test_case.status if self.test_case else None,
            }
        )

    def _handle_failure(self) -> Response:
        """Handle the FAILURE state and update the database."""
        meta = self.task_result.info
        error_message = meta.get("error", str(meta)) if isinstance(meta, dict) else str(meta)
        if self.test_case and self.test_case.status == "RUNNING":
            logger.info(f"Celery task {self.task_id} failed, updating test case {self.test_case.id} to FAILURE")
            self.test_case.status = "FAILURE"
            self.test_case.error_message = error_message
            self.test_case.save()
        return Response(
            {
                "status": "FAILURE",
                "stage": "Execution failed",
                "progress": 0,
                "error_message": error_message,
                "test_case_status": self.test_case.status if self.test_case else None,
            }
        )

    def _handle_revoked(self) -> Response:
        """Handle the REVOKED state and update the database."""
        if self.test_case and self.test_case.status == "RUNNING":
            logger.info(f"Celery task {self.task_id} was revoked, updating test case {self.test_case.id} to CANCELLED")
            self.test_case.status = "CANCELLED"
            self.test_case.error_message = "Execution cancelled by user."
            self.test_case.save()
        return Response(
            {
                "status": "CANCELLED",
                "stage": "Execution cancelled by user",
                "progress": 0,
                "test_case_status": self.test_case.status if self.test_case else None,
            }
        )

    def _handle_unknown(self) -> Response:
        """Handle any other unknown task states."""
        return Response(
            {
                "status": self.task_result.state,
                "stage": "Unknown state",
                "progress": 0,
                "test_case_status": self.test_case.status if self.test_case else None,
            }
        )


@api_view(["GET"])
def check_sensei_execution_status(request: Request, task_id: str) -> Response:
    """Check the status of a Sensei execution task and synchronize database status."""
    try:
        status_manager = SenseiExecutionStatusManager(task_id)
        return status_manager.get_status_response()
    except (ValueError, AttributeError, KeyError) as e:
        logger.error(f"Error checking Sensei execution status for task {task_id}: {e}")
        return Response({"error": "Error checking task status"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["POST"])
def stop_sensei_execution(request: Request) -> Response:
    """Stop ongoing Sensei profile execution."""
    test_case_id = request.data.get("test_case_id")

    if not test_case_id:
        return Response({"error": "No test case ID provided."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        test_case = TestCase.objects.get(id=test_case_id)
        if test_case.project.owner != request.user:
            return Response({"error": "You do not own this test case."}, status=status.HTTP_403_FORBIDDEN)

        if test_case.status != "RUNNING":
            return Response(
                {"message": f"Test case is not running (status: {test_case.status})"},
                status=status.HTTP_200_OK,
            )

        # Revoke the Celery task if we have a task ID
        if hasattr(test_case, "celery_task_id") and test_case.celery_task_id:
            try:
                current_app.control.revoke(test_case.celery_task_id, terminate=True)
                logger.info(f"Revoked Celery task {test_case.celery_task_id} for test case {test_case.id}")

                # Manually update the status to reflect cancellation
                test_case.status = "FAILURE"
                test_case.error_message = "Execution cancelled by user."
                test_case.save()

            except (ValueError, AttributeError, KeyError) as e:
                logger.warning(f"Could not revoke Celery task {test_case.celery_task_id}: {e}")

        return Response({"message": "Sensei execution stopped"}, status=status.HTTP_200_OK)

    except TestCase.DoesNotExist:
        return Response({"error": "Test case not found."}, status=status.HTTP_404_NOT_FOUND)


@api_view(["GET"])
def get_profile_executions(request: Request, project_id: int) -> Response:
    """Get profile executions for a project with their associated profiles.

    This includes both TRACER-generated executions and manual profile uploads.
    """
    try:
        project = Project.objects.get(id=project_id)
        if project.owner != request.user:
            return Response({"error": "You do not own this project."}, status=status.HTTP_403_FORBIDDEN)
    except Project.DoesNotExist:
        return Response({"error": "Project not found."}, status=status.HTTP_404_NOT_FOUND)

    # Get all executions for the project, ordered with manual first
    executions = ProfileExecution.objects.filter(project=project).order_by("execution_type", "-created_at")

    execution_data = []
    for execution in executions:
        execution_info = _build_execution_info(execution)
        execution_data.append(execution_info)

    return Response({"executions": execution_data})


def _build_execution_info(execution: ProfileExecution) -> dict:
    """Build execution info dictionary for all execution types (TRACER and manual)."""
    # Get profiles for this execution
    profiles = TestFile.objects.filter(execution=execution).select_related("project")

    execution_info = {
        "id": execution.id,
        "execution_name": execution.execution_name,
        "execution_type": execution.execution_type,
        "status": execution.status,
        "created_at": execution.created_at.isoformat(),
        "display_info": execution.display_info,
        "generated_profiles_count": execution.generated_profiles_count,
        "profiles": [
            {
                "id": profile.id,
                "name": profile.name,
                "is_valid": profile.is_valid,
                "uploaded_at": profile.uploaded_at.isoformat(),
            }
            for profile in profiles
        ],
    }

    # Add TRACER-specific fields if it's a TRACER execution
    if execution.execution_type == "tracer":
        # Get error message from associated task if available
        error_message = ""
        if execution.generation_tasks.exists():
            task = execution.generation_tasks.first()
            error_message = task.error_message if task.error_message else ""

        execution_info.update(
            {
                "sessions": execution.sessions,
                "turns_per_session": execution.turns_per_session,
                "execution_time_minutes": execution.execution_time_minutes,
                "verbosity": execution.verbosity,
                "error_type": execution.error_type,
                "error_message": error_message,
            }
        )

    return execution_info


class ProfileExecutionDeletionValidator:
    """Handles validation for profile execution deletion requests."""

    @staticmethod
    def validate_execution_deletion(
        request: Request, execution_id: int
    ) -> tuple[Response | None, ProfileExecution | None]:
        """Validate that the profile execution can be deleted by the current user."""
        try:
            execution = ProfileExecution.objects.get(id=execution_id)
        except ProfileExecution.DoesNotExist:
            return Response({"error": "Execution not found."}, status=status.HTTP_404_NOT_FOUND), None

        # Check ownership
        if execution.project.owner != request.user:
            return Response({"error": "You do not own this execution."}, status=status.HTTP_403_FORBIDDEN), None

        # Prevent deletion of manual executions - they are permanent
        if execution.execution_type == "manual":
            return (
                Response(
                    {"error": "Manual execution folders cannot be deleted. Delete individual profiles instead."},
                    status=status.HTTP_400_BAD_REQUEST,
                ),
                None,
            )

        return None, execution


class ProfileExecutionFileManager:
    """Handles file operations for profile executions."""

    @staticmethod
    def delete_execution_files(execution: ProfileExecution) -> None:
        """Delete files associated with the profile execution from the filesystem."""
        # Delete associated files from filesystem
        try:
            if execution.profiles_directory:
                profiles_dir = Path(settings.MEDIA_ROOT) / execution.profiles_directory
                if profiles_dir.exists():
                    shutil.rmtree(profiles_dir)
                    logger.info(f"Deleted execution directory: {profiles_dir}")
        except (OSError, PermissionError, FileNotFoundError) as e:
            logger.warning(f"Failed to delete execution directory: {e}")
            # Continue with database deletion even if file deletion fails

        # Delete related database objects (cascade will handle most of this)
        # But we'll explicitly delete TestFiles to clean up their file references
        profile_files = TestFile.objects.filter(execution=execution)
        for profile_file in profile_files:
            try:
                if profile_file.file:
                    profile_file.file.delete(save=False)
            except (OSError, PermissionError, FileNotFoundError) as e:
                logger.warning(f"Failed to delete profile file {profile_file.file.name}: {e}")


@api_view(["DELETE"])
def delete_profile_execution(request: Request, execution_id: int) -> Response:
    """Delete a profile execution and all its associated profiles and files.

    This can delete TRACER executions but not manual executions (which are permanent).
    """
    # Validate the execution can be deleted
    error_response, execution = ProfileExecutionDeletionValidator.validate_execution_deletion(request, execution_id)
    if error_response:
        return error_response

    try:
        with transaction.atomic():
            # Delete associated files
            ProfileExecutionFileManager.delete_execution_files(execution)

            # Delete the execution (cascade will handle related objects)
            execution_name = execution.execution_name
            execution.delete()

            logger.info(f"Successfully deleted profile execution: {execution_name}")

            return Response(
                {"message": f"Execution '{execution_name}' deleted successfully"}, status=status.HTTP_200_OK
            )

    except (OSError, PermissionError, DatabaseError) as e:
        logger.error(f"Error deleting profile execution {execution_id}: {e}")
        return Response(
            {"error": "An error occurred while deleting the execution."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["POST"])
def execute_sensei_check(request: Request) -> Response:
    """Execute SENSEI Check on selected test cases.

    This endpoint executes sensei-check command on the conversation outputs
    from selected test cases using the project's SENSEI Check rules.

    Args:
        request: POST request with:
            - project_id: ID of the project containing rules
            - test_case_ids: List of test case IDs to check
            - verbose: Optional boolean for verbose output

    Returns:
        Response with execution results and output
    """
    import os
    import subprocess
    import tempfile
    from pathlib import Path

    try:
        data = request.data
        project_id = data.get("project_id")
        test_case_ids = data.get("test_case_ids", [])
        verbose = data.get("verbose", False)

        if not project_id:
            return Response({"error": "project_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        if not test_case_ids:
            return Response({"error": "test_case_ids is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Get project and validate access
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response({"error": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

        # Get test cases
        test_cases = TestCase.objects.filter(id__in=test_case_ids, project=project)

        if not test_cases.exists():
            return Response({"error": "No valid test cases found"}, status=status.HTTP_404_NOT_FOUND)

        # Check if project has SENSEI Check rules
        if not project.sensei_check_rules.exists():
            return Response(
                {"error": "No SENSEI Check rules found for this project"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Build paths
        user_id = project.owner.id
        project_path = Path(settings.MEDIA_ROOT) / "projects" / f"user_{user_id}" / f"project_{project.id}"
        rules_path = project_path / "sensei_check_rules"

        # Verify rules directory exists
        if not rules_path.exists():
            return Response(
                {"error": "SENSEI Check rules directory not found"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Create temporary directory for conversations
        with tempfile.TemporaryDirectory() as temp_dir:
            conversations_path = Path(temp_dir) / "conversations"
            conversations_path.mkdir(parents=True, exist_ok=True)

            # Copy conversation files from selected test cases
            for test_case in test_cases:
                # Path to test case results
                results_path = (
                    Path(settings.MEDIA_ROOT)
                    / "results"
                    / f"user_{user_id}"
                    / f"project_{project.id}"
                    / f"testcase_{test_case.id}"
                )

                if results_path.exists():
                    # Copy all YAML conversation files
                    for yaml_file in results_path.rglob("*.yml"):
                        # Create subdirectory structure in temp
                        relative_path = yaml_file.relative_to(results_path)
                        dest_file = conversations_path / f"testcase_{test_case.id}" / relative_path
                        dest_file.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(yaml_file, dest_file)

            # Check if we have any conversation files
            if not any(conversations_path.rglob("*.yml")):
                return Response(
                    {"error": "No conversation files found in selected test cases"}, status=status.HTTP_400_BAD_REQUEST
                )

            # Build sensei-check command
            cmd = [
                "sensei-check",  # Updated to use sensei-check without .py
                "--rules",
                str(rules_path),
                "--conversations",
                str(conversations_path),
            ]

            if verbose:
                cmd.append("--verbose")

            # Create temporary CSV file for results
            with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as csv_file:
                csv_path = csv_file.name
                cmd.extend(["--dump", csv_path])

            try:
                # Execute sensei-check command
                logger.info(f"Executing SENSEI Check command: {' '.join(cmd)}")

                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=300,  # 5 minute timeout
                    check=False,  # Don't raise exception on non-zero exit
                )

                # Read CSV results if file exists
                csv_results = None
                if os.path.exists(csv_path):
                    try:
                        with open(csv_path, encoding="utf-8") as f:
                            csv_results = f.read()
                    finally:
                        os.unlink(csv_path)  # Clean up temp file

                return Response(
                    {
                        "success": True,
                        "exit_code": result.returncode,
                        "stdout": result.stdout,
                        "stderr": result.stderr,
                        "csv_results": csv_results,
                        "test_cases_checked": len(test_cases),
                        "command_executed": " ".join(cmd),
                    },
                    status=status.HTTP_200_OK,
                )

            except subprocess.TimeoutExpired:
                # Clean up temp CSV file
                if os.path.exists(csv_path):
                    os.unlink(csv_path)
                return Response(
                    {"error": "SENSEI Check execution timed out (5 minutes)"}, status=status.HTTP_408_REQUEST_TIMEOUT
                )
            except subprocess.SubprocessError as e:
                # Clean up temp CSV file
                if os.path.exists(csv_path):
                    os.unlink(csv_path)
                return Response(
                    {"error": f"Error executing SENSEI Check: {e!s}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

    except Exception as e:
        logger.error(f"Unexpected error in execute_sensei_check: {e}")
        return Response({"error": f"Unexpected error: {e!s}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
