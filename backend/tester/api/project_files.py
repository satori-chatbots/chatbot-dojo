"""
Project Files API endpoints for handling personalities, rules, and types files.
"""

import os
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from ..models import Project, PersonalityFile, RuleFile, TypeFile, ProjectConfig
from ..serializers import (
    PersonalityFileSerializer,
    RuleFileSerializer,
    TypeFileSerializer,
    ProjectConfigSerializer,
)


class ProjectFilePermission(BasePermission):
    """Permission class for Project File access"""

    def has_object_permission(self, request, view, obj):
        # Allow access if project is public or user is the owner
        return obj.project.public or (
            request.user.is_authenticated and request.user == obj.project.owner
        )


class PersonalityFileViewSet(viewsets.ModelViewSet):
    queryset = PersonalityFile.objects.all()
    serializer_class = PersonalityFileSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_classes = [permissions.IsAuthenticated, ProjectFilePermission]

    def list(self, request, *args, **kwargs):
        """Return a list of all personality files, filtered by project if specified."""
        project_id = request.query_params.get("project_id", None)
        if project_id is not None:
            project = get_object_or_404(Project, id=project_id)
            queryset = self.filter_queryset(self.get_queryset()).filter(project=project)
        else:
            queryset = self.filter_queryset(self.get_queryset())

        # Check if files are missing and clean up
        for file in queryset:
            if not os.path.exists(file.file.path):
                file.delete()

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(
        detail=False,
        methods=["post"],
        url_path="upload",
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload(self, request):
        """Upload personality files to a project."""
        uploaded_files = request.FILES.getlist("file")
        project_id = request.data.get("project")

        if not project_id:
            return Response(
                {"error": "No project ID provided."}, status=status.HTTP_400_BAD_REQUEST
            )

        project = get_object_or_404(Project, id=project_id)

        # Check permissions
        if project.owner != request.user:
            return Response(
                {"error": "You do not own this project."},
                status=status.HTTP_403_FORBIDDEN,
            )

        created_files = []
        for uploaded_file in uploaded_files:
            personality_file = PersonalityFile.objects.create(
                file=uploaded_file, project=project
            )
            created_files.append(personality_file)

        serializer = self.get_serializer(created_files, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class RuleFileViewSet(viewsets.ModelViewSet):
    queryset = RuleFile.objects.all()
    serializer_class = RuleFileSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_classes = [permissions.IsAuthenticated, ProjectFilePermission]

    def list(self, request, *args, **kwargs):
        """Return a list of all rule files, filtered by project if specified."""
        project_id = request.query_params.get("project_id", None)
        if project_id is not None:
            project = get_object_or_404(Project, id=project_id)
            queryset = self.filter_queryset(self.get_queryset()).filter(project=project)
        else:
            queryset = self.filter_queryset(self.get_queryset())

        # Check if files are missing and clean up
        for file in queryset:
            if not os.path.exists(file.file.path):
                file.delete()

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(
        detail=False,
        methods=["post"],
        url_path="upload",
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload(self, request):
        """Upload rule files to a project."""
        uploaded_files = request.FILES.getlist("file")
        project_id = request.data.get("project")

        if not project_id:
            return Response(
                {"error": "No project ID provided."}, status=status.HTTP_400_BAD_REQUEST
            )

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
    queryset = TypeFile.objects.all()
    serializer_class = TypeFileSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_classes = [permissions.IsAuthenticated, ProjectFilePermission]

    def list(self, request, *args, **kwargs):
        """Return a list of all type files, filtered by project if specified."""
        project_id = request.query_params.get("project_id", None)
        if project_id is not None:
            project = get_object_or_404(Project, id=project_id)
            queryset = self.filter_queryset(self.get_queryset()).filter(project=project)
        else:
            queryset = self.filter_queryset(self.get_queryset())

        # Check if files are missing and clean up
        for file in queryset:
            if not os.path.exists(file.file.path):
                file.delete()

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(
        detail=False,
        methods=["post"],
        url_path="upload",
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload(self, request):
        """Upload type files to a project."""
        uploaded_files = request.FILES.getlist("file")
        project_id = request.data.get("project")

        if not project_id:
            return Response(
                {"error": "No project ID provided."}, status=status.HTTP_400_BAD_REQUEST
            )

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


class ProjectConfigViewSet(viewsets.ModelViewSet):
    queryset = ProjectConfig.objects.all()
    serializer_class = ProjectConfigSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Filter configs to only those owned by the user."""
        project_id = self.request.query_params.get("project_id", None)
        if project_id:
            return ProjectConfig.objects.filter(
                project_id=project_id, project__owner=self.request.user
            )
        return ProjectConfig.objects.filter(project__owner=self.request.user)

    def perform_create(self, serializer):
        """Ensure the project belongs to the user."""
        project = serializer.validated_data["project"]
        if project.owner != self.request.user:
            raise PermissionError("You do not own this project.")

        config = serializer.save()
        # Update the run.yml file
        project.update_run_yml()

    def perform_update(self, serializer):
        """Update the run.yml file after saving."""
        config = serializer.save()
        config.project.update_run_yml()
