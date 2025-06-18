"""
Test Files API endpoints.
"""

import os
import re

import yaml
from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from ..models import Project, TestFile
from ..serializers import TestFileSerializer
from .base import extract_test_name_from_malformed_yaml


class TestFilePermission(BasePermission):
    """Permission class for TestFile access"""

    def has_object_permission(self, request, view, obj):
        # Allow access if project is public or user is the owner
        return obj.project.public or (
            request.user.is_authenticated and request.user == obj.project.owner
        )


class TestFileViewSet(viewsets.ModelViewSet):
    queryset = TestFile.objects.all()
    serializer_class = TestFileSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_classes = [permissions.IsAuthenticated, TestFilePermission]

    @action(detail=True, methods=["put"], url_path="update-file")
    def update_file(self, request, pk=None):
        test_file = self.get_object()
        content = request.data.get("content")
        ignore_validation_errors = str(
            request.data.get("ignore_validation_errors", "false")
        ).lower() in ["true", "1"]

        if not content:
            return Response(
                {"error": "No content provided"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Initialize new_test_name with the current file name as a fallback
        new_test_name = test_file.name
        is_valid = True

        # Try to parse the YAML to get the test name
        try:
            data = yaml.safe_load(content)
            extracted_name = data.get("test_name", None)
            if extracted_name:
                new_test_name = extracted_name
        except yaml.YAMLError as e:
            # Mark file as invalid
            is_valid = False

            # Only reject if not ignoring validation errors
            if not ignore_validation_errors:
                return Response(
                    {"error": f"Invalid YAML: {str(e)}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # If we're ignoring errors, try to extract test_name with regex
            try:
                pattern = r'test_name:\s*[\'"]?([\w\d_-]+)[\'"]?'
                match = re.search(pattern, content)
                if match:
                    new_test_name = match.group(1)
            except Exception:
                # If all extraction methods fail, keep the current name
                pass

        project = test_file.project
        if not project:
            return Response(
                {"error": "No project associated with this file"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check if the new name is already used in the project
        conflict = (
            TestFile.objects.filter(project=project, name=new_test_name)
            .exclude(pk=test_file.pk)
            .first()
        )
        # If so, we dont allow the update
        if conflict:
            return Response(
                {
                    "error": f"A file named '{new_test_name}' already exists in this project."
                },
                status=status.HTTP_409_CONFLICT,
            )

        # Update file on disk
        with open(test_file.file.path, "w") as f:
            f.write(content)

        # Update the database fields
        test_file.name = new_test_name
        test_file.is_valid = is_valid
        test_file.save()

        return Response(
            {"message": "File updated successfully"}, status=status.HTTP_200_OK
        )

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

        # Paginate the queryset if needed
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

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
        ignore_validation_errors = str(
            request.data.get("ignore_validation_errors", "false")
        ).lower() in ["true", "1"]
        errors = []
        test_names = set()
        already_reported_test_names = set()
        file_data = []  # Store validated file data for later processing

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

        # Process all files first
        for f in uploaded_files:
            is_valid = True
            test_name = None
            try:
                content = f.read()
                f.seek(0)  # Reset pointer so Django can save the file
                data = yaml.safe_load(content)
                test_name = data.get("test_name", None)
            except Exception as e:
                is_valid = False

                # Try to extract test_name even from malformed YAML
                f.seek(0)
                content = f.read()
                f.seek(0)

                extracted_name = extract_test_name_from_malformed_yaml(content)
                test_name = extracted_name

                if not ignore_validation_errors:
                    errors.append({"file": f.name, "error": f"Error reading YAML: {e}"})
                    continue

                # Only use file name if we couldn't extract test_name
                if not test_name:
                    test_name = f.name

            if not test_name:
                is_valid = False
                if not ignore_validation_errors:
                    errors.append(
                        {"file": f.name, "error": "test_name is missing in YAML."}
                    )
                    continue
                # When ignoring errors, use file name without extension
                test_name = os.path.splitext(f.name)[0]

            # Handle duplicate names
            if test_name in existing_test_names:
                if not ignore_validation_errors:
                    if test_name not in already_reported_test_names:
                        already_reported_test_names.add(test_name)
                        errors.append(
                            {
                                "file": f.name,
                                "error": f"test_name '{test_name}' is already used.",
                            }
                        )
                    continue
                # With ignore_validation_errors, append a unique suffix
                base_name = test_name
                counter = 1
                while test_name in existing_test_names or test_name in test_names:
                    test_name = f"{base_name}_{counter}"
                    counter += 1
                is_valid = False

            if test_name in test_names:
                if not ignore_validation_errors:
                    if test_name not in already_reported_test_names:
                        already_reported_test_names.add(test_name)
                        errors.append(
                            {
                                "file": f.name,
                                "error": f"Duplicate test_name '{test_name}' in uploaded files.",
                            }
                        )
                    continue
                # With ignore_validation_errors, append a unique suffix
                base_name = test_name
                counter = 1
                while test_name in test_names:
                    test_name = f"{base_name}_{counter}"
                    counter += 1
                is_valid = False

            test_names.add(test_name)
            file_data.append({"file": f, "test_name": test_name, "is_valid": is_valid})

        # Return errors if any and not ignoring validation
        if errors and not ignore_validation_errors:
            return Response(
                {"errors": errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # All files processed, proceed to save them
        saved_files = []
        try:
            with transaction.atomic():
                for data in file_data:
                    instance = TestFile.objects.create(
                        file=data["file"],
                        name=data["test_name"],
                        project=project,
                        is_valid=data["is_valid"],
                    )
                    saved_files.append(instance.id)
        except Exception as e:
            return Response(
                {"error": f"Failed to save files: {e}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {"uploaded_file_ids": saved_files}, status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=["get"], url_path="template")
    def get_template(self, request):
        template_path = os.path.join(
            settings.BASE_DIR, "tester/templates/yaml/default.yaml"
        )
        try:
            with open(template_path, "r") as f:
                template_content = f.read()
            return Response({"template": template_content})
        except FileNotFoundError:
            return Response(
                {"error": "Template file not found"}, status=status.HTTP_404_NOT_FOUND
            )
