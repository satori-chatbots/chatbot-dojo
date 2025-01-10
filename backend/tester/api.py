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
from .models import TestCase, TestFile
from .serializers import TestCaseSerializer, TestFileSerializer
import os
from .utils import check_keys
import yaml
from django.shortcuts import get_object_or_404


class TestCaseViewSet(viewsets.ModelViewSet):
    queryset = TestCase.objects.all()
    serializer_class = TestCaseSerializer


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
        If a new file is found in the directory, add it to the DB.

        Args:
            request (Request): The request object.

        Returns:
            Response: Serialized data of the files.
        """
        queryset = self.filter_queryset(self.get_queryset())

        # Check if a file is missing, if so, delete the row in the DB
        for file in queryset:
            if not os.path.exists(file.file.path):
                file.delete()

        # Check for new files in the directory and add them to the DB
        directory_path = os.path.join(settings.MEDIA_ROOT, "user-yaml")
        if os.path.exists(directory_path):
            for filename in os.listdir(directory_path):
                file_path = os.path.join(directory_path, filename)
                if os.path.isfile(file_path) and (filename.endswith(".yml") or filename.endswith(".yaml")):
                    # Check if the file already exists in the queryset
                    if not queryset.filter(file__icontains=filename).exists():
                        # Construct the relative file path
                        relative_file_path = os.path.join('user-yaml', filename)
                        new_file = TestFile(file=relative_file_path)
                        new_file.save()

        # Repeat the query after possible deletions
        queryset = self.filter_queryset(self.get_queryset())

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
        """
        Endpoint to upload multiple files.
        Expects multipart/form-data with files under the key 'file':
        {
            "file": [file1, file2, ...]
        }

        Args:
            request (Request): The request object.

        Returns:
            Response: If successful, returns the serialized data of the uploaded files.
        """
        files = request.FILES.getlist("file")
        if not files:
            return Response(
                {"error": "No files provided."}, status=status.HTTP_400_BAD_REQUEST
            )

        file_instances = []
        for f in files:
            test_file = TestFile(file=f)
            test_file.save()
            file_instances.append(test_file)

        serializer = self.get_serializer(file_instances, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


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
        if not selected_ids:
            return Response(
                {"error": "No test file IDs provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

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

        # Create TestCase instance first to get its ID
        test_case = TestCase.objects.create()

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
            copied_files.append({"path": copied_file_rel_path, "name": name_extracted})

        # Save the copied files to the TestCase instance
        test_case.copied_files = copied_files
        test_case.save()

        # Set CWD to the script dir (avoid using os.chdir)
        script_cwd = os.path.dirname(os.path.dirname(script_path))
        print(f"Script path: {script_path}")

        # Execute the script for the directory with all the copied files
        # This is done to avoid the for loop, also we get just one report with all the files
        try:
            start_time = time.time()
            result = subprocess.run(
                [
                    "python",
                    script_path,
                    "--technology",
                    "taskyto",
                    "--chatbot",
                    "http://127.0.0.1:5000",
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

        return Response(
            {
                "test_case_id": test_case.id,
                "executed_at": test_case.executed_at,
                "execution_time": test_case.execution_time,
                "result": test_case.result,
                "copied_files": test_case.copied_files,
            },
            status=status.HTTP_200_OK,
        )
