"""Projects API endpoints and related functionality."""

import logging
import shutil
from pathlib import Path
from typing import Any, ClassVar

from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.db import models
from django.db.models.query import QuerySet
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.response import Response
from user_sim.cli.init_project import init_proj

from tester.models import ChatbotConnector, Project, TestFile
from tester.serializers import ChatbotConnectorSerializer, ProjectSerializer
from tester.validation_script import YamlValidator

logger = logging.getLogger(__name__)


class ProjectAccessPermission(BasePermission):
    """Custom permission to only allow owners of an object to edit it."""

    def has_object_permission(self, request: Request, _view: Any, obj: Project) -> bool:  # noqa: ANN401
        """Check if the user has permission for the given project object.

        Read permissions are granted for public projects or for the owner.
        Write permissions are granted only for the owner.
        """
        # Allow read if project is public
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return obj.public or obj.owner == request.user
        # Allow write if owner
        return obj.owner == request.user


class ProjectViewSet(viewsets.ModelViewSet):
    """API endpoint that allows projects to be viewed or edited."""

    serializer_class = ProjectSerializer
    permission_classes: ClassVar[list[type[BasePermission]]] = [ProjectAccessPermission]
    # For now we dont need pagination since there are not many projects
    # And it makes the frontend not be able to access response.data.length
    pagination_class = None

    def get_queryset(self) -> QuerySet[Project]:
        """Filter queryset based on query params."""
        show_type = self.request.query_params.get("show", "all")

        if not self.request.user.is_authenticated:
            return Project.objects.filter(public=True)

        if show_type == "owned":
            return Project.objects.filter(owner=self.request.user)
        # Default: show all public projects and projects owned by the user.
        return Project.objects.filter(models.Q(public=True) | models.Q(owner=self.request.user))

    def perform_create(self, serializer: serializers.ModelSerializer) -> None:
        """Create a project and initialize its directory structure.

        Ensures that a user cannot have two projects with the same name.
        """
        name = serializer.validated_data["name"]
        if Project.objects.filter(owner=self.request.user, name=name).exists():
            msg = "Project name already exists for this user."
            raise serializers.ValidationError({"name": msg})
        project = serializer.save(owner=self.request.user)

        logger.info(
            "Creating project structure for project '%s' (ID: %d) owned by user %d",
            project.name,
            project.id,
            self.request.user.id,
        )

        # Create path structure: projects/user_{user_id}/project_{project_id}/
        # This should be consistent with the MEDIA_ROOT structure
        relative_path = Path("projects") / f"user_{self.request.user.id}" / f"project_{project.id}"
        project_base_path = Path(settings.MEDIA_ROOT) / relative_path
        project_name = f"project_{project.id}"

        logger.debug(
            "Project base path: %s, project name: %s",
            project_base_path,
            project_name,
        )

        # Ensure the parent directory exists
        try:
            project_base_path.parent.mkdir(parents=True, exist_ok=True)
            logger.debug("Created directory structure: %s", project_base_path.parent)
        except OSError as e:
            logger.exception("Failed to create directory structure")
            raise serializers.ValidationError({"non_field_errors": "Failed to create project directory"}) from e

        # Initialize project structure using user_sim package
        try:
            logger.debug(
                "Initializing project structure with init_proj(name=%s, path=%s)",
                project_name,
                project_base_path.parent,
            )

            init_proj(project_name, str(project_base_path.parent))

            logger.info(
                "Successfully initialized project structure for '%s' at %s",
                project.name,
                project_base_path,
            )

        except Exception as e:
            logger.exception(
                "Failed to initialize project structure for '%s'",
                project.name,
            )
            # Clean up the created directory if initialization failed
            try:
                if project_base_path.exists():
                    shutil.rmtree(project_base_path)
                    logger.debug("Cleaned up failed project directory: %s", project_base_path)
            except OSError as cleanup_error:
                logger.warning("Failed to clean up project directory: %s", cleanup_error)

            raise serializers.ValidationError(
                {"non_field_errors": f"Failed to initialize project structure: {e}"}
            ) from e

        # Update the run.yml file with project configuration
        try:
            project.update_run_yml()
            logger.debug("Updated run.yml configuration for project '%s'", project.name)
        except OSError as e:
            logger.warning(
                "Project created successfully but failed to update run.yml for '%s': %s",
                project.name,
                e,
            )

    def get_object(self) -> Project:
        """Override get_object to return 403 instead of 404 when object exists but user has no access."""
        # Get object by primary key
        obj = get_object_or_404(Project, pk=self.kwargs["pk"])

        # Check permissions
        if not self.get_permissions()[0].has_object_permission(self.request, self, obj):
            msg = "You do not have permission to access this project"
            raise PermissionDenied(msg)

        return obj

    @action(detail=False, methods=["get"], url_path="connectors")
    def list_connectors(self, request: Request) -> Response:
        """List all available Chatbot Connectors for the authenticated user."""
        connectors = ChatbotConnector.objects.filter(owner=request.user)
        serializer = ChatbotConnectorSerializer(connectors, many=True, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="check-name")
    def check_name(self, request: Request) -> Response:
        """Check if a project name is already used. It cant be none or empty."""
        name = request.query_params.get("project_name", None)
        if name is None or not name.strip():
            return Response(
                {"error": "No project name provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        exists = Project.objects.filter(owner=request.user, name=name).exists()
        return Response({"exists": exists}, status=status.HTTP_200_OK)


@api_view(["POST"])
def validate_yaml(request: Request) -> Response:
    """Validate YAML content using the YamlValidator class."""
    yaml_content = request.data.get("content")
    if not yaml_content:
        return Response({"error": "No content provided"}, status=status.HTTP_400_BAD_REQUEST)

    validator = YamlValidator()
    validation_errors = validator.validate(yaml_content)

    if validation_errors:
        formatted_errors = [
            {"path": error.path, "message": error.message, "line": error.line} for error in validation_errors
        ]
        return Response({"valid": False, "errors": formatted_errors}, status=status.HTTP_200_OK)

    return Response({"valid": True}, status=status.HTTP_200_OK)


@api_view(["GET"])
def fetch_file_content(request: Request, file_id: int) -> Response:
    """Fetch the content of a specific YAML file."""
    try:
        test_file = get_object_or_404(TestFile, id=file_id)

        # Check permissions - user should have access to the project
        if not test_file.project.public and test_file.project.owner != request.user:
            return Response(
                {"error": "You don't have permission to access this file"},
                status=status.HTTP_403_FORBIDDEN,
            )

        file_path = Path(test_file.file.path)
        # Check if file exists
        if not file_path.exists():
            return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)

        # Read the file content
        content = file_path.read_text()

        return Response({"id": test_file.id, "name": test_file.name, "yamlContent": content})

    except Http404:
        return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)
    except OSError as e:
        return Response(
            {"error": f"Error reading file: {e!s}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


class TestFilePermission(BasePermission):
    """Permission class for TestFile access."""

    def has_object_permission(self, request: Request, _view: Any, obj: TestFile) -> bool:  # noqa: ANN401
        """Allow access if project is public or user is the owner."""
        return obj.project.public or (request.user.is_authenticated and request.user == obj.project.owner)
