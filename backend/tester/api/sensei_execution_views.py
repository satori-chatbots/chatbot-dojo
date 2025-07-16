"""API views for Sensei profile execution endpoints using sensei-chat/user-simulator.

This module handles the execution of user profiles through the Sensei system,
which is separate from TRACER profile generation. Sensei takes generated profiles
and executes them against chatbot systems for testing.
"""

import shutil
import threading
from pathlib import Path

import yaml
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
from tester.api.test_runner import TestExecutionConfig, TestRunner
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

        base_dir = Path(settings.BASE_DIR).parent
        sensei_script_path = str(base_dir / "user-simulator" / "src" / "user_sim" / "cli" / "sensei_chat.py")
        project_path = Path(settings.MEDIA_ROOT) / "projects" / f"user_{request.user.id}" / f"project_{project.id}"

        with transaction.atomic():
            technology = project.chatbot_connector.technology
            chatbot_link = project.chatbot_connector.link if project.chatbot_connector else None

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
                link=chatbot_link,
                api_key=api_key,
                api_provider=project.llm_provider,
            )
            threading.Thread(
                target=TestRunner().execute_test_background,
                args=(execution_config,),
            ).start()

        return Response(
            {
                "message": "Sensei profile execution started",
                "test_case_id": test_case.id,
                "total_conversations": "Calculating...",
            },
            status=status.HTTP_202_ACCEPTED,
        )


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

        test_runner = TestRunner()
        success = test_runner.stop_test_execution(test_case)

        if success:
            return Response({"message": "Sensei execution stopped"}, status=status.HTTP_200_OK)
        return Response(
            {"message": f"Test case is not running (status: {test_case.status})"},
            status=status.HTTP_200_OK,
        )

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
