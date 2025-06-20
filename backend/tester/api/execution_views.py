"""API views for test execution endpoints."""

import os
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
from tester.api.profile_generator import ProfileGenerator
from tester.api.test_runner import TestExecutionConfig, TestRunner
from tester.models import (
    ProfileGenerationTask,
    Project,
    TestCase,
    TestFile,
    cipher_suite,
)


class ExecuteSelectedAPIView(APIView):
    """API view to execute selected test files."""

    def _setup_api_key(self, project: Project) -> None:
        """Load and decrypt the API key for the project, setting it as an environment variable."""
        try:
            if api_key_instance := project.api_key:
                decrypted_key = cipher_suite.decrypt(api_key_instance.api_key_encrypted).decode()
                os.environ["OPENAI_API_KEY"] = decrypted_key
                logger.info(f"API key successfully loaded for project {project.name}")
            else:
                logger.warning(f"No API key found for project {project.name}")
        except (InvalidToken, ValueError, TypeError) as e:
            logger.error(f"Error loading/decrypting API key for project {project.name}: {e}")

    def _copy_and_prepare_files(self, test_files: list[TestFile], user_profiles_path: Path) -> list[dict[str, str]]:
        """Copy test files to a temporary location and extract metadata."""
        copied_files = []
        for test_file in test_files:
            source_path = Path(test_file.file.path)
            if not source_path.exists():
                continue

            dest_path = Path(shutil.copy(source_path, user_profiles_path))
            rel_path = str(dest_path.relative_to(settings.MEDIA_ROOT))

            name_extracted = "Unknown"
            try:
                with source_path.open(encoding="utf-8") as f:
                    data = yaml.safe_load(f)
                    name_extracted = data.get("test_name", name_extracted)
            except yaml.YAMLError as e:
                logger.error(f"Error loading YAML from {source_path}: {e}")

            copied_files.append({"path": rel_path, "name": name_extracted})
        return copied_files

    def _validate_request(self, request: Request) -> tuple[Response | None, Project | None, QuerySet[TestFile] | None]:
        """Validate the incoming request and return an error Response or the required data."""
        if not request.user.is_authenticated:
            return (
                Response(
                    {"error": "Authentication required to execute tests."},
                    status=status.HTTP_401_UNAUTHORIZED,
                ),
                None,
                None,
            )

        selected_ids = request.data.get("test_file_ids", [])
        project_id = request.data.get("project_id")

        if not selected_ids or not project_id:
            return (
                Response({"error": "Project and test file IDs are required."}, status=status.HTTP_400_BAD_REQUEST),
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

        test_files = TestFile.objects.filter(id__in=selected_ids)
        if not test_files.exists():
            return (
                Response(
                    {"error": "No valid test files found for the provided IDs."},
                    status=status.HTTP_400_BAD_REQUEST,
                ),
                None,
                None,
            )

        return None, project, test_files

    def post(self, request: Request) -> Response:
        """Execute selected test files in the user-yaml directory using Taskyto.

        Create a TestCase instance and associate executed TestFiles with it.
        """
        error_response, project, test_files = self._validate_request(request)
        if error_response:
            return error_response

        test_name = request.data.get("test_name")

        self._setup_api_key(project)

        base_dir = Path(settings.BASE_DIR).parent
        script_path = str(base_dir / "user-simulator" / "src" / "sensei_chat.py")
        project_path = Path(settings.MEDIA_ROOT) / "projects" / f"user_{request.user.id}" / f"project_{project.id}"

        with transaction.atomic():
            technology = project.chatbot_technology.technology
            link = project.chatbot_technology.link if project.chatbot_technology else None

            test_case = TestCase.objects.create(project=project, name=test_name, technology=technology)
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

            copied_files = self._copy_and_prepare_files(list(test_files), user_profiles_path)
            test_case.copied_files = copied_files
            test_case.save()

            execution_config = TestExecutionConfig(
                test_case_id=test_case.id,
                script_path=script_path,
                project_path=str(project_path),
                profiles_directory=f"testcase_{test_case.id}",
                results_path=str(results_path),
                technology=technology,
                link=link,
            )
            threading.Thread(
                target=TestRunner().execute_test_background,
                args=(execution_config,),
            ).start()

        return Response(
            {
                "message": "Test execution started",
                "test_case_id": test_case.id,
                "total_conversations": "Calculating...",
            },
            status=status.HTTP_202_ACCEPTED,
        )


@api_view(["POST"])
def generate_profiles(request: Request) -> Response:
    """Generate user profiles based on conversations and turns."""
    project_id = request.data.get("project_id")
    conversations = request.data.get("conversations", 1)
    turns = request.data.get("turns", 10)

    if not project_id:
        return Response({"error": "No project ID provided."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        project = Project.objects.get(id=project_id)
        if project.owner != request.user:
            return Response({"error": "You do not own this project."}, status=status.HTTP_403_FORBIDDEN)
    except Project.DoesNotExist:
        return Response({"error": "Project not found."}, status=status.HTTP_404_NOT_FOUND)

    task = ProfileGenerationTask.objects.create(
        project=project, status="PENDING", conversations=conversations, turns=turns
    )

    profile_generator = ProfileGenerator()
    threading.Thread(
        target=profile_generator.run_async_profile_generation,
        args=(task.id, project.chatbot_technology.technology, conversations, turns, request.user.id),
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
        return Response(
            {
                "status": task.status,
                "stage": task.stage,
                "progress": task.progress_percentage,
                "generated_files": len(task.generated_file_ids),
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


@api_view(["POST"])
def stop_test_execution(request: Request) -> Response:
    """Stop ongoing test execution."""
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
            return Response({"message": "Test execution stopped"}, status=status.HTTP_200_OK)
        return Response(
            {"message": f"Test case is not running (status: {test_case.status})"},
            status=status.HTTP_200_OK,
        )

    except TestCase.DoesNotExist:
        return Response({"error": "Test case not found."}, status=status.HTTP_404_NOT_FOUND)
