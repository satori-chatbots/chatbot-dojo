import shutil
import subprocess
import time
import configparser
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from django.conf import settings
from .models import ChatbotTechnology, TestCase, TestFile, Project
from .serializers import (
    ChatbotTechnologySerializer,
    TestCaseSerializer,
    TestFileSerializer,
    ProjectSerializer,
)
from django.http import JsonResponse
from .models import TECHNOLOGY_CHOICES
import os
from .utils import check_keys
import yaml
from django.shortcuts import get_object_or_404
from django.db import transaction
import threading

# ---------------------- #
# - CHATBOT TECHNOLOGY - #
# ---------------------- #


def get_technology_choices(request):
    return JsonResponse({"technology_choices": TECHNOLOGY_CHOICES})


class ChatbotTechnologyViewSet(viewsets.ModelViewSet):
    queryset = ChatbotTechnology.objects.all()
    serializer_class = ChatbotTechnologySerializer


# ----------------- #
# - TEST CASES API #
# ----------------- #


class TestCaseViewSet(viewsets.ModelViewSet):
    queryset = TestCase.objects.all()
    serializer_class = TestCaseSerializer


# ---------- #
# - PROJECTS #
# ---------- #


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    # For now we dont need pagination since there are not many projects
    # And it makes the frontend not be able to access response.data.length
    pagination_class = None

    @action(detail=False, methods=["get"], url_path="technologies")
    def list_technologies(self, request):
        """List all available Chatbot Technologies."""
        technologies = ChatbotTechnology.objects.all()
        serializer = ChatbotTechnologySerializer(technologies, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


# ------------------------- #
# - USER PROFILES - YAMLS - #
# ------------------------- #


class TestFileViewSet(viewsets.ModelViewSet):
    queryset = TestFile.objects.all()
    serializer_class = TestFileSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    # Own implementation because now if we delete a file, the row in the DB still exists
    def list(self, request, *args, **kwargs):
        """Return a list of all the YAML files uploaded, if one is missing, delete the row in the DB.

        Args:
            request (Request): The request object.

        Returns:
            Response: Serialized data of the files.
        """
        project_id = request.query_params.get("project_id", None)
        if project_id is not None:
            project = get_object_or_404(Project, id=project_id)
            queryset = self.filter_queryset(self.get_queryset()).filter(project=project)
        else:
            queryset = self.filter_queryset(self.get_queryset())

        # Check if a file is missing, if so, delete the row in the DB
        for file in queryset:
            if not os.path.exists(file.file.path):
                file.delete()

        # Repeat the query after possible deletions
        # queryset = self.filter_queryset(self.get_queryset())

        # Paginate the queryset if needed
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    # Allow bulk deletion of files without creating a new view
    @action(detail=False, methods=["delete"], url_path="delete-bulk")
    def bulk_delete(self, request):
        """
        Endpoint for bulk deleting files.
        Expects a JSON body with a list of file IDs:
        {
            "ids": [1, 2, 3]
        }

        Args:
            request (Request): The request object.

        Returns:
            Response: Response with the number of files deleted or an error message.
        """
        ids = request.data.get("ids", [])
        # This because if not when deleting a single file, it will be a single int and not a list
        if not isinstance(ids, list):
            ids = [ids]
        if not ids:
            return Response(
                {"error": "No IDs provided."}, status=status.HTTP_400_BAD_REQUEST
            )

        files = TestFile.objects.filter(id__in=ids)
        if not files.exists():
            return Response(
                {"error": "No files found for the provided IDs."},
                status=status.HTTP_404_NOT_FOUND,
            )

        for file in files:
            file.delete()

        return Response({"deleted": len(files)}, status=status.HTTP_200_OK)

    @action(
        detail=False,
        methods=["post"],
        url_path="upload",
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload(self, request):
        uploaded_files = request.FILES.getlist("file")
        project_id = request.data.get("project")
        errors = []
        test_names = set()
        already_reported_test_names = set()

        # Check if the project exists
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response(
                {"error": "Project not found, make sure to create a project first."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Collect all existing test_names in the project
        existing_test_names = set(
            TestFile.objects.filter(project=project).values_list("name", flat=True)
        )

        # Validate all files first
        for f in uploaded_files:
            try:
                content = f.read()
                f.seek(0)  # Reset pointer so Django can save the file
                data = yaml.safe_load(content)
                test_name = data.get("test_name", None)
            except Exception as e:
                errors.append({"file": f.name, "error": f"Error reading YAML: {e}"})
                continue

            if not test_name:
                errors.append(
                    {"file": f.name, "error": "test_name is missing in YAML."}
                )
                continue

            if test_name in existing_test_names:
                if test_name not in already_reported_test_names:
                    already_reported_test_names.add(test_name)
                    errors.append(
                        {
                            "file": f.name,
                            "error": f"test_name '{test_name}' is already used.",
                        }
                    )
                continue

            if test_name in test_names:
                if test_name not in already_reported_test_names:
                    already_reported_test_names.add(test_name)
                    errors.append(
                        {
                            "file": f.name,
                            "error": f"Duplicate test_name '{test_name}' in uploaded files.",
                        }
                    )
                continue

            test_names.add(test_name)

        if errors:
            return Response(
                {"errors": errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # All files are valid, proceed to save them atomically
        saved_files = []
        try:
            with transaction.atomic():
                for f in uploaded_files:
                    data = yaml.safe_load(f.read())
                    test_name = data.get("test_name")
                    instance = TestFile.objects.create(file=f, name=test_name, project=project)
                    saved_files.append(instance.id)
        except Exception as e:
            return Response(
                {"error": f"Failed to save files: {e}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {"uploaded_file_ids": saved_files}, status=status.HTTP_201_CREATED
        )


# ----------------------------- #
# - EXECUTE AUTOTEST ON FILES - #
# ----------------------------- #


class ExecuteSelectedAPIView(APIView):
    def post(self, request, format=None):
        """
        Execute selected test files in the user-yaml directory using Taskyto.
        Create a TestCase instance and associate executed TestFiles with it.
        """
        selected_ids = request.data.get("test_file_ids", [])
        project_id = request.data.get("project_id")

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
        except Project.DoesNotExist:
            return Response(
                {"error": "Project not found, make sure to create a project first."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get the technology and link from the project
        technology = project.chatbot_technology.technology
        link = project.chatbot_technology.link

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
        script_path = os.path.join(base_dir, "user-simulator", "src", "autotest.py")

        # Load OPENAI_API_KEY from keys.properties
        check_keys(["OPENAI_API_KEY"])

        # Set extract dir to MEDIA / results
        extract_dir = os.path.join(settings.MEDIA_ROOT, "results")
        print(f"Extract dir: {extract_dir}")

        # Set executed dir to MEDIA / executed_yaml
        executed_dir_base = os.path.join(settings.MEDIA_ROOT, "executed_yaml")
        os.makedirs(executed_dir_base, exist_ok=True)
        print(f"Executed base dir: {executed_dir_base}")

        # Make in a transaction to avoid partial saves
        with transaction.atomic():
            # Create TestCase instance first to get its ID
            test_case = TestCase.objects.create(project=project)

            # Create a unique subdirectory for this TestCase
            test_case_dir = os.path.join(executed_dir_base, f"testcase_{test_case.id}")
            os.makedirs(test_case_dir, exist_ok=True)
            print(f"TestCase directory: {test_case_dir}")

            # Copy all the yaml files to the new directory and save the relative path and name
            for test_file in test_files:
                file_path = test_file.file.path
                copied_file_path = shutil.copy(file_path, test_case_dir)
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
                        print(f"Error loading YAML file: {e}")

                # Save the path and name of the copied file
                copied_files.append(
                    {"path": copied_file_rel_path, "name": name_extracted}
                )

            # Save the copied files to the TestCase instance
            test_case.copied_files = copied_files
            test_case.save()

        # Set CWD to the script dir (avoid using os.chdir)
        script_cwd = os.path.dirname(os.path.dirname(script_path))
        print(f"Script path: {script_path}")

        # Execute the script for the directory with all the copied files
        # This is done to avoid the for loop, also we get just one report with all the files
        threading.Thread(
            target=run_asyn_test_execution,
            args=(
                script_path,
                script_cwd,
                test_case_dir,
                extract_dir,
                test_case,
                technology,
                link,
            ),
        ).start()

        return Response(
            {"message": "Started execution", "test_case_id": test_case.id},
            status=status.HTTP_202_ACCEPTED,
        )


def run_asyn_test_execution(
    script_path, script_cwd, test_case_dir, extract_dir, test_case, technology, link
):
    """ """
    try:
        start_time = time.time()
        result = subprocess.run(
            [
                "python",
                script_path,
                "--technology",
                technology,
                "--chatbot",
                link,
                "--user",
                test_case_dir,
                "--extract",
                extract_dir,
            ],
            capture_output=True,
            text=True,
            cwd=script_cwd,
        )

        end_time = time.time()
        elapsed_time = round(end_time - start_time, 2)

        test_case.execution_time = elapsed_time
        test_case.result = result.stdout.strip() or result.stderr.strip()
        test_case.save()

    except Exception as e:
        test_case.result = f"Error: {e}"
        test_case.execution_time = 0
        test_case.save()
