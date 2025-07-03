"""API endpoints for managing and validating TestFiles."""

import builtins
import logging
from pathlib import Path
from typing import Any, ClassVar

import yaml
from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from tester.models import Project, TestFile
from tester.serializers import TestFileSerializer

from .base import extract_test_name_from_malformed_yaml

logger = logging.getLogger(__name__)


class TestFilePermission(BasePermission):
    """Permission class to control access to TestFile objects."""

    def has_object_permission(self, request: Request, _view: APIView, obj: TestFile) -> bool:
        """Check if the user has permission to access the TestFile object.

        Allows access if the project is public or the user is the project owner.
        """
        return obj.project.public or (request.user.is_authenticated and request.user == obj.project.owner)


class TestFileViewSet(viewsets.ModelViewSet):
    """API ViewSet for managing TestFiles."""

    queryset = TestFile.objects.all()
    serializer_class = TestFileSerializer
    parser_classes: ClassVar[list[Any]] = [MultiPartParser, FormParser, JSONParser]
    permission_classes: ClassVar[list[type[BasePermission]]] = [permissions.IsAuthenticated, TestFilePermission]

    def list(self, request: Request, *_args: Any, **_kwargs: Any) -> Response:  # noqa: ANN401
        """Return a list of all YAML files, filtering out any that are missing from disk.

        Args:
            request: The DRF request object.

        Returns:
            A paginated or full list of serialized TestFile data.
        """
        project_id = request.query_params.get("project_id")
        if project_id:
            project = get_object_or_404(Project, id=project_id)
            queryset = self.filter_queryset(self.get_queryset()).filter(project=project)
        else:
            queryset = self.filter_queryset(self.get_queryset())

        # Eagerly load related project to avoid N+1 queries
        queryset = queryset.select_related("project")

        # Check if files exist on disk and delete the DB entry if not
        for test_file in list(queryset):
            if not Path(test_file.file.path).exists():
                test_file.delete()
                logger.warning("Deleted TestFile object %s as its file was missing.", test_file.id)

        # Re-fetch queryset after potential deletions
        page = self.paginate_queryset(queryset.all())
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["put"], url_path="update-file")
    def update_file(self, request: Request, pk: int | None = None) -> Response:  # noqa: ARG002
        """Update the content and metadata of a TestFile."""
        test_file = self.get_object()
        content = request.data.get("content")
        ignore_validation_errors = str(request.data.get("ignore_validation_errors", "false")).lower() in ["true", "1"]

        if not content:
            return Response({"error": "No content provided"}, status=status.HTTP_400_BAD_REQUEST)

        new_test_name = test_file.name
        is_valid = True

        try:
            data = yaml.safe_load(content)
            if extracted_name := data.get("test_name"):
                new_test_name = extracted_name
        except yaml.YAMLError as e:
            is_valid = False
            if not ignore_validation_errors:
                return Response({"error": f"Invalid YAML: {e!s}"}, status=status.HTTP_400_BAD_REQUEST)
            try:
                if extracted_name := extract_test_name_from_malformed_yaml(content):
                    new_test_name = extracted_name
            except (AttributeError, TypeError, IndexError):
                logger.warning("Could not extract test_name from malformed YAML for file %s", test_file.id)

        # Check for name conflicts within the project
        if TestFile.objects.filter(project=test_file.project, name=new_test_name).exclude(pk=test_file.pk).exists():
            return Response(
                {"error": f"A file named '{new_test_name}' already exists in this project."},
                status=status.HTTP_409_CONFLICT,
            )

        # Update file on disk
        try:
            with Path(test_file.file.path).open("w") as f:
                f.write(content)
        except OSError as e:
            return Response({"error": f"Could not write to file: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        test_file.name = new_test_name
        test_file.is_valid = is_valid
        test_file.save()

        return Response({"message": "File updated successfully"}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["delete"], url_path="delete-bulk")
    def bulk_delete(self, request: Request) -> Response:
        """Delete multiple TestFile objects based on a list of IDs.

        Expects a JSON body with a list of file IDs: `{"ids": [1, 2, 3]}`.
        """
        ids = request.data.get("ids", [])
        if not isinstance(ids, list):
            ids = [ids]
        if not ids:
            return Response({"error": "No IDs provided."}, status=status.HTTP_400_BAD_REQUEST)

        # The `delete()` method on a queryset is atomic and more efficient
        deleted_count, _ = TestFile.objects.filter(id__in=ids).delete()

        if deleted_count == 0:
            return Response({"error": "No files found for the provided IDs."}, status=status.HTTP_404_NOT_FOUND)

        return Response({"deleted": deleted_count}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="upload", parser_classes=[MultiPartParser, FormParser])
    def upload(self, request: Request) -> Response:
        """Handle the bulk upload of one or more test files to a project."""
        uploaded_files = request.FILES.getlist("file")
        project_id = request.data.get("project")
        ignore_errors = str(request.data.get("ignore_validation_errors", "false")).lower() in ["true", "1"]

        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response({"error": "Project not found."}, status=status.HTTP_404_NOT_FOUND)

        processed_files, errors, _ = self._process_files(project, uploaded_files, ignore_errors=ignore_errors)

        if errors and not ignore_errors:
            return Response({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        try:
            saved_file_ids = self._create_test_files_from_data(project, processed_files)
        except Exception as e:
            logger.exception("Failed to save files during bulk upload.")
            return Response({"error": f"Failed to save files: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"uploaded_file_ids": saved_file_ids}, status=status.HTTP_201_CREATED)

    def _process_files(
        self, project: Project, uploaded_files: builtins.list[Any], *, ignore_errors: bool
    ) -> tuple[builtins.list[dict], builtins.list[dict], set]:
        """Validate and prepare a list of uploaded files before saving."""
        file_data, errors, reported_names = [], [], set()
        existing_names = set(TestFile.objects.filter(project=project).values_list("name", flat=True))
        upload_names = set()

        for f in uploaded_files:
            is_valid, test_name = True, None
            try:
                content = f.read()
                f.seek(0)
                data = yaml.safe_load(content)
                test_name = data.get("test_name")
            except yaml.YAMLError as e:
                is_valid = False
                if not ignore_errors:
                    errors.append({"file": f.name, "error": f"Invalid YAML: {e}"})
                    continue
                f.seek(0)
                test_name = extract_test_name_from_malformed_yaml(f.read())
                f.seek(0)

            if not test_name:
                is_valid = False
                if not ignore_errors:
                    errors.append({"file": f.name, "error": "'test_name' is missing."})
                    continue
                test_name = Path(f.name).stem

            # Handle name conflicts
            if test_name in existing_names or test_name in upload_names:
                if not ignore_errors:
                    if test_name not in reported_names:
                        errors.append({"file": f.name, "error": f"Name '{test_name}' is already used."})
                        reported_names.add(test_name)
                    continue
                # If ignoring errors, create a unique name
                base_name, counter = test_name, 1
                while test_name in existing_names or test_name in upload_names:
                    test_name = f"{base_name}_{counter}"
                    counter += 1
                is_valid = False

            upload_names.add(test_name)
            file_data.append({"file": f, "test_name": test_name, "is_valid": is_valid})

        return file_data, errors, reported_names

    def _create_test_files_from_data(self, project: Project, file_data: builtins.list[dict]) -> builtins.list[int]:
        """Save processed file data to the database in a single transaction."""
        saved_instances = []

        # Create or get a manual execution folder for grouping these uploads
        manual_execution = project.get_or_create_current_manual_execution()

        with transaction.atomic():
            for data in file_data:
                instance = TestFile(
                    file=data["file"],
                    name=data["test_name"],
                    project=project,
                    is_valid=data["is_valid"],
                    execution=manual_execution  # Assign to manual execution
                )
                saved_instances.append(instance)
            TestFile.objects.bulk_create(saved_instances)
        # We need to return the IDs, which are only available after creation.
        # A simple way is to fetch them back by name, assuming names are now unique.
        names = [data["test_name"] for data in file_data]
        return list(TestFile.objects.filter(project=project, name__in=names).values_list("id", flat=True))

    @action(detail=False, methods=["get"], url_path="template")
    def get_template(self, _request: Request) -> Response:
        """Provide a default YAML template for creating new test files."""
        template_path = Path(settings.BASE_DIR) / "tester/templates/yaml/default.yaml"
        try:
            with template_path.open() as f:
                template_content = f.read()
            return Response({"template": template_content})
        except FileNotFoundError:
            logger.exception("Default YAML template not found at %s", template_path)
            return Response({"error": "Template file not found"}, status=status.HTTP_404_NOT_FOUND)
