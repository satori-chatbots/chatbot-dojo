"""
API views for test execution endpoints.
"""

import os
import shutil
import threading

import yaml
from django.conf import settings
from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import (
    ProfileGenerationTask,
    Project,
    TestCase,
    TestFile,
    cipher_suite,
)
from .base import logger
from .test_runner import TestRunner
from .profile_generator import ProfileGenerator


class ExecuteSelectedAPIView(APIView):
    def post(self, request, format=None):
        """
        Execute selected test files in the user-yaml directory using Taskyto.
        Create a TestCase instance and associate executed TestFiles with it.
        """
        # Check if user is authenticated
        if not request.user.is_authenticated:
            return Response(
                {"error": "Authentication required to execute tests."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        selected_ids = request.data.get("test_file_ids", [])
        project_id = request.data.get("project_id")
        test_name = request.data.get("test_name")

        if not selected_ids:
            return Response(
                {"error": "No test file IDs provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not project_id:
            return Response(
                {"error": "No project ID provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check if the project exists
        try:
            project = Project.objects.get(id=project_id)
            # Check if the project owner is the same as the user
            if project.owner != request.user:
                return Response(
                    {"error": "You do not own project."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        except Project.DoesNotExist:
            return Response(
                {"error": "Project not found, make sure to create a project first."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get the technology and link from the project
        technology = project.chatbot_technology.technology
        link = project.chatbot_technology.link if project.chatbot_technology else None

        test_files = TestFile.objects.filter(id__in=selected_ids)
        if not test_files.exists():
            return Response(
                {"error": "No valid test files found for the provided IDs."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Initialize total execution time and collect individual results
        copied_files = []

        # Prepare script paths
        base_dir = os.path.dirname(settings.BASE_DIR)
        script_path = os.path.join(base_dir, "user-simulator", "src", "sensei_chat.py")

        # Load api key from the project and decipher it
        try:
            api_key_instance = project.api_key
            if api_key_instance is not None:
                openai_api_key = cipher_suite.decrypt(
                    api_key_instance.api_key_encrypted
                ).decode()
                os.environ["OPENAI_API_KEY"] = openai_api_key
                logger.info(f"API key successfully loaded for project {project.name}")
            else:
                logger.warning(f"No API key found for project {project.name}")
        except Exception as e:
            logger.error(
                f"Error loading/decrypting API key for project {project.name}: {e}"
            )

        # Set executed dir to MEDIA / projects / user_{user_id} / project_{project_id} / profiles / {testcase_id}
        user_id = request.user.id
        project_id = project.id

        project_path = os.path.join(
            settings.MEDIA_ROOT,
            "projects",
            f"user_{user_id}",
            f"project_{project_id}",
        )
        logger.info(f"Project path: {project_path}")

        # Make in a transaction to avoid partial saves
        with transaction.atomic():
            # Create TestCase instance first to get its ID
            if test_name:
                logger.info(f"Test name: {test_name}")
                test_case = TestCase.objects.create(
                    project=project, name=test_name, technology=technology
                )
            else:
                test_case = TestCase.objects.create(
                    project=project, technology=technology
                )

            # Set it to RUNNING
            test_case.status = "RUNNING"

            # Set extract dir to MEDIA / results / user_{user_id} / project_{project_id} / testcase_{testcase_id}
            results_path = os.path.join(
                settings.MEDIA_ROOT,
                "results",
                f"user_{user_id}",
                f"project_{project_id}",
                f"testcase_{test_case.id}",
            )
            logger.info(f"Results path: {results_path}")

            # Create a unique subdirectory for this TestCase within the profiles folder
            profiles_base_path = os.path.join(project_path, "profiles")
            user_profiles_path = os.path.join(profiles_base_path, f"testcase_{test_case.id}")
            os.makedirs(user_profiles_path, exist_ok=True)
            logger.info(f"User profiles path: {user_profiles_path}")

            # Get just the name of the folder inside /profiles so we can use it as an argument for the script
            profiles_directory = f"testcase_{test_case.id}"

            # Copy all the yaml files to the new directory and save the relative path and name
            for test_file in test_files:
                file_path = test_file.file.path
                copied_file_path = shutil.copy(file_path, user_profiles_path)
                # Store relative path from MEDIA_ROOT for frontend access
                copied_file_rel_path = os.path.relpath(
                    copied_file_path, settings.MEDIA_ROOT
                )
                # Get the test_name from the YAML file
                name_extracted = "Unknown"
                if os.path.exists(file_path):
                    try:
                        with open(file_path, "r") as file:
                            data = yaml.safe_load(file)
                            name_extracted = data.get("test_name", name_extracted)
                    except yaml.YAMLError as e:
                        logger.error(f"Error loading YAML file: {e}")

                # Save the path and name of the copied file
                copied_files.append(
                    {"path": copied_file_rel_path, "name": name_extracted}
                )

            # Save the copied files to the TestCase instance
            test_case.copied_files = copied_files
            test_case.status = "RUNNING"
            test_case.save()

            # Execute the test in a background thread using TestRunner
            test_runner = TestRunner()
            threading.Thread(
                target=test_runner.execute_test_background,
                args=(
                    test_case.id,
                    script_path,
                    project_path,
                    profiles_directory,
                    results_path,
                    technology,
                    link,
                ),
            ).start()

        return Response(
            {
                "message": "Test execution started",
                "test_case_id": test_case.id,
                "total_conversations": "Calculating...",  # Will be updated during execution
            },
            status=status.HTTP_202_ACCEPTED,
        )


@api_view(["POST"])
def generate_profiles(request):
    """Generate user profiles based on conversations and turns."""
    project_id = request.data.get("project_id")
    conversations = request.data.get("conversations", 1)
    turns = request.data.get("turns", 10)

    if not project_id:
        return Response(
            {"error": "No project ID provided."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        project = Project.objects.get(id=project_id)
        if project.owner != request.user:
            return Response(
                {"error": "You do not own this project."},
                status=status.HTTP_403_FORBIDDEN,
            )
    except Project.DoesNotExist:
        return Response(
            {"error": "Project not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    # Create a task to track generation
    task = ProfileGenerationTask.objects.create(
        project=project, status="PENDING", conversations=conversations, turns=turns
    )

    # Start generation in background thread using ProfileGenerator
    profile_generator = ProfileGenerator()
    threading.Thread(
        target=profile_generator.run_async_profile_generation,
        args=(
            task.id,
            project.chatbot_technology.technology,
            conversations,
            turns,
            request.user.id,
        ),
    ).start()

    return Response(
        {"message": "Profile generation started", "task_id": task.id},
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(["GET"])
def check_generation_status(request, task_id):
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
def check_ongoing_generation(request, project_id):
    """Check if there's an ongoing profile generation task for the project."""
    try:
        # Find any PENDING or RUNNING tasks for this project
        ongoing_task = (
            ProfileGenerationTask.objects.filter(
                project_id=project_id, status__in=["PENDING", "RUNNING"]
            )
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
        else:
            return Response({"ongoing": False})
    except Exception as e:
        logger.error(f"Error checking ongoing generation: {str(e)}")
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["POST"])
def stop_test_execution(request):
    """Stop ongoing test execution."""
    test_case_id = request.data.get("test_case_id")

    if not test_case_id:
        return Response(
            {"error": "No test case ID provided."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        test_case = TestCase.objects.get(id=test_case_id)
        if test_case.project.owner != request.user:
            return Response(
                {"error": "You do not own this test case."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Use TestRunner to stop the execution
        test_runner = TestRunner()
        success = test_runner.stop_test_execution(test_case)

        if success:
            return Response(
                {"message": "Test execution stopped"},
                status=status.HTTP_200_OK,
            )
        else:
            return Response(
                {"message": f"Test case is not running (status: {test_case.status})"},
                status=status.HTTP_200_OK,
            )

    except TestCase.DoesNotExist:
        return Response(
            {"error": "Test case not found."},
            status=status.HTTP_404_NOT_FOUND,
        )
