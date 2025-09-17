"""Project Files API endpoints for handling personalities, rules, and types files."""

from pathlib import Path
from typing import Any, ClassVar

import yaml
from django.db.models.query import QuerySet
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import Serializer
from rest_framework.views import APIView

from tester.models import PersonalityFile, Project, ProjectConfig, RuleFile, SenseiCheckRule, TypeFile
from tester.serializers import (
    PersonalityFileSerializer,
    ProjectConfigSerializer,
    RuleFileSerializer,
    SenseiCheckRuleSerializer,
    TypeFileSerializer,
)


class ProjectFilePermission(BasePermission):
    """Permission class for Project File access."""

    def has_object_permission(self, request: Request, _view: APIView, obj: Any) -> bool:  # noqa: ANN401
        """Check if the user has permission to access the project file.

        Allows access if the project is public, or if the user is authenticated
        and is the owner of the project.
        """
        return obj.project.public or (request.user.is_authenticated and request.user == obj.project.owner)


class PersonalityFileViewSet(viewsets.ModelViewSet):
    """ViewSet for managing PersonalityFile instances."""

    queryset = PersonalityFile.objects.all()
    serializer_class = PersonalityFileSerializer
    parser_classes: ClassVar[list[Any]] = [MultiPartParser, FormParser, JSONParser]
    permission_classes: ClassVar[list[Any]] = [permissions.IsAuthenticated, ProjectFilePermission]

    def list(self, request: Request, *_args: Any, **_kwargs: Any) -> Response:  # noqa: ANN401
        """Return a list of all personality files, filtered by project if specified."""
        project_id = request.query_params.get("project_id", None)
        if project_id is not None:
            project = get_object_or_404(Project, id=project_id)
            queryset = self.filter_queryset(self.get_queryset()).filter(project=project)
        else:
            queryset = self.filter_queryset(self.get_queryset())

        # Check if files are missing and clean up
        for file in queryset:
            if not Path(file.file.path).exists():
                file.delete()

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(
        detail=False,
        methods=["post"],
        url_path="upload",
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload(self, request: Request) -> Response:
        """Upload personality files to a project."""
        uploaded_files = request.FILES.getlist("file")
        project_id = request.data.get("project")

        if not project_id:
            return Response({"error": "No project ID provided."}, status=status.HTTP_400_BAD_REQUEST)

        project = get_object_or_404(Project, id=project_id)

        # Check permissions
        if project.owner != request.user:
            return Response(
                {"error": "You do not own this project."},
                status=status.HTTP_403_FORBIDDEN,
            )

        created_files = []
        for uploaded_file in uploaded_files:
            personality_file = PersonalityFile.objects.create(file=uploaded_file, project=project)
            created_files.append(personality_file)

        serializer = self.get_serializer(created_files, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class RuleFileViewSet(viewsets.ModelViewSet):
    """ViewSet for managing RuleFile instances."""

    queryset = RuleFile.objects.all()
    serializer_class = RuleFileSerializer
    parser_classes: ClassVar[list[Any]] = [MultiPartParser, FormParser, JSONParser]
    permission_classes: ClassVar[list[Any]] = [permissions.IsAuthenticated, ProjectFilePermission]

    def list(self, request: Request, *_args: Any, **_kwargs: Any) -> Response:  # noqa: ANN401
        """Return a list of all rule files, filtered by project if specified."""
        project_id = request.query_params.get("project_id", None)
        if project_id is not None:
            project = get_object_or_404(Project, id=project_id)
            queryset = self.filter_queryset(self.get_queryset()).filter(project=project)
        else:
            queryset = self.filter_queryset(self.get_queryset())

        # Check if files are missing and clean up
        for file in queryset:
            if not Path(file.file.path).exists():
                file.delete()

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(
        detail=False,
        methods=["post"],
        url_path="upload",
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload(self, request: Request) -> Response:
        """Upload rule files to a project."""
        uploaded_files = request.FILES.getlist("file")
        project_id = request.data.get("project")

        if not project_id:
            return Response({"error": "No project ID provided."}, status=status.HTTP_400_BAD_REQUEST)

        project = get_object_or_404(Project, id=project_id)

        # Check permissions
        if project.owner != request.user:
            return Response(
                {"error": "You do not own this project."},
                status=status.HTTP_403_FORBIDDEN,
            )

        created_files = []
        for uploaded_file in uploaded_files:
            rule_file = RuleFile.objects.create(file=uploaded_file, project=project)
            created_files.append(rule_file)

        serializer = self.get_serializer(created_files, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class TypeFileViewSet(viewsets.ModelViewSet):
    """ViewSet for managing TypeFile instances."""

    queryset = TypeFile.objects.all()
    serializer_class = TypeFileSerializer
    parser_classes: ClassVar[list[Any]] = [MultiPartParser, FormParser, JSONParser]
    permission_classes: ClassVar[list[Any]] = [permissions.IsAuthenticated, ProjectFilePermission]

    def list(self, request: Request, *_args: Any, **_kwargs: Any) -> Response:  # noqa: ANN401
        """Return a list of all type files, filtered by project if specified."""
        project_id = request.query_params.get("project_id", None)
        if project_id is not None:
            project = get_object_or_404(Project, id=project_id)
            queryset = self.filter_queryset(self.get_queryset()).filter(project=project)
        else:
            queryset = self.filter_queryset(self.get_queryset())

        # Check if files are missing and clean up
        for file in queryset:
            if not Path(file.file.path).exists():
                file.delete()

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(
        detail=False,
        methods=["post"],
        url_path="upload",
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload(self, request: Request) -> Response:
        """Upload type files to a project."""
        uploaded_files = request.FILES.getlist("file")
        project_id = request.data.get("project")

        if not project_id:
            return Response({"error": "No project ID provided."}, status=status.HTTP_400_BAD_REQUEST)

        project = get_object_or_404(Project, id=project_id)

        # Check permissions
        if project.owner != request.user:
            return Response(
                {"error": "You do not own this project."},
                status=status.HTTP_403_FORBIDDEN,
            )

        created_files = []
        for uploaded_file in uploaded_files:
            type_file = TypeFile.objects.create(file=uploaded_file, project=project)
            created_files.append(type_file)

        serializer = self.get_serializer(created_files, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class SenseiCheckRuleViewSet(viewsets.ModelViewSet):
    """ViewSet for managing SenseiCheckRule instances."""

    queryset = SenseiCheckRule.objects.all()
    serializer_class = SenseiCheckRuleSerializer
    parser_classes: ClassVar[list[Any]] = [MultiPartParser, FormParser, JSONParser]
    permission_classes: ClassVar[list[Any]] = [permissions.IsAuthenticated, ProjectFilePermission]

    def list(self, request: Request, *_args: Any, **_kwargs: Any) -> Response:  # noqa: ANN401
        """Return a list of all sensei check rules, filtered by project if specified."""
        project_id = request.query_params.get("project_id", None)
        if project_id is not None:
            project = get_object_or_404(Project, id=project_id)
            queryset = self.filter_queryset(self.get_queryset()).filter(project=project)
        else:
            queryset = self.filter_queryset(self.get_queryset())

        # Check if files are missing and clean up
        for file in queryset:
            if not Path(file.file.path).exists():
                file.delete()

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(
        detail=False,
        methods=["post"],
        url_path="upload",
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload(self, request: Request) -> Response:
        """Upload sensei check rules to a project."""
        uploaded_files = request.FILES.getlist("file")
        project_id = request.data.get("project")

        if not project_id:
            return Response({"error": "No project ID provided."}, status=status.HTTP_400_BAD_REQUEST)

        project = get_object_or_404(Project, id=project_id)

        # Check permissions
        if project.owner != request.user:
            return Response(
                {"error": "You do not own this project."},
                status=status.HTTP_403_FORBIDDEN,
            )

        created_files = []
        for uploaded_file in uploaded_files:
            sensei_check_rule = SenseiCheckRule.objects.create(file=uploaded_file, project=project)
            created_files.append(sensei_check_rule)

        serializer = self.get_serializer(created_files, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=["patch"],
        url_path="toggle-active",
    )
    def toggle_active(self, request: Request, pk: str | None = None) -> Response:  # noqa: ARG002
        """Toggle the 'active' field in a sensei check rule file."""
        rule = self.get_object()

        # Check permissions
        if rule.project.owner != request.user:
            return Response(
                {"error": "You do not own this project."},
                status=status.HTTP_403_FORBIDDEN,
            )

        active_value = request.data.get("active")
        if active_value is None:
            return Response(
                {"error": "Active value is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            if rule.file:
                # Read the current content
                with rule.file.open("r") as file:
                    content = file.read()

                # Parse YAML
                data = yaml.safe_load(content) or {}

                # Update the active field with Python boolean
                data["active"] = bool(active_value)

                # Write back to file with custom dumper to ensure True/False capitalization
                with rule.file.open("w") as file:
                    # Use a custom dumper that represents booleans as True/False
                    class CustomDumper(yaml.SafeDumper):
                        pass

                    def bool_representer(dumper: yaml.SafeDumper, data: bool) -> yaml.ScalarNode:  # noqa: FBT001
                        return dumper.represent_scalar("tag:yaml.org,2002:bool", "True" if data else "False")

                    CustomDumper.add_representer(bool, bool_representer)
                    yaml.dump(data, file, Dumper=CustomDumper, default_flow_style=False)

                # Return updated data
                serializer = self.get_serializer(rule)
                return Response(serializer.data, status=status.HTTP_200_OK)
            return Response(
                {"error": "No file found for this rule."},
                status=status.HTTP_404_NOT_FOUND,
            )

        except (yaml.YAMLError, OSError, ValueError) as e:
            return Response(
                {"error": f"Error updating rule file: {e!s}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ProjectConfigViewSet(viewsets.ModelViewSet):
    """ViewSet for managing ProjectConfig instances."""

    queryset = ProjectConfig.objects.all()
    serializer_class = ProjectConfigSerializer
    permission_classes: ClassVar[list[Any]] = [permissions.IsAuthenticated]

    def get_queryset(self) -> QuerySet[ProjectConfig]:
        """Filter configs to only those owned by the user."""
        project_id = self.request.query_params.get("project_id", None)
        if project_id:
            return ProjectConfig.objects.filter(project_id=project_id, project__owner=self.request.user)
        return ProjectConfig.objects.filter(project__owner=self.request.user)

    def perform_create(self, serializer: Serializer) -> None:
        """Ensure the project belongs to the user."""
        project = serializer.validated_data["project"]
        if project.owner != self.request.user:
            msg = "You do not own this project."
            raise PermissionDenied(msg)

        serializer.save()
        # Update the run.yml file
        project.update_run_yml()

    def perform_update(self, serializer: Serializer) -> None:
        """Update the run.yml file after saving."""
        config = serializer.save()
        config.project.update_run_yml()
