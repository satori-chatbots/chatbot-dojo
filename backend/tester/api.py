import shutil
import signal
import subprocess
import time
import configparser
import traceback
from rest_framework import viewsets, status, permissions, serializers
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.decorators import api_view
from django.conf import settings
from .models import (
    ChatbotTechnology,
    Conversation,
    GlobalReport,
    ProfileGenerationTask,
    ProfileReport,
    TestCase,
    TestError,
    TestFile,
    Project,
    UserAPIKey,
)
from .serializers import (
    ChatbotTechnologySerializer,
    ConversationSerializer,
    GlobalReportSerializer,
    LoginSerializer,
    TestCaseSerializer,
    TestFileSerializer,
    ProjectSerializer,
    TestErrorSerializer,
    ProfileReportSerializer,
    RegisterSerializer,
    UserAPIKeySerializer,
)
from django.http import JsonResponse
from .models import TECHNOLOGY_CHOICES
import os
from .utils import check_keys
import yaml
from django.shortcuts import get_object_or_404
from django.db import transaction
import threading
import logging
import psutil
from django.contrib.auth import get_user_model
from knox.models import AuthToken
from django.contrib.auth import authenticate
from rest_framework.permissions import BasePermission
from django.core.exceptions import PermissionDenied
from django.db import models
from django.db.models import OuterRef, Subquery, Sum, Q
from django.core.files import File
from .validation_script import YamlValidator
import sys
import re

# We need this one since it already has the fernet key
from .models import cipher_suite

# Get the latest version of the user model
User = get_user_model()

# Import the RoleData class from user-simulator (Sensei)
base_dir = os.path.dirname(settings.BASE_DIR)
sys.path.append(os.path.join(base_dir, "user-simulator", "src"))
from user_sim.role_structure import RoleData


def extract_test_name_from_malformed_yaml(content):
    """
    Extract test_name from potentially malformed YAML using regex.
    Returns None if no test_name is found.
    """
    try:
        # Look for test_name: "value" or test_name: 'value' or test_name: value
        pattern = r'test_name:\s*[\'"]?([\w\d_-]+)[\'"]?'
        match = re.search(pattern, content.decode("utf-8"))
        if match:
            return match.group(1)
    except Exception:
        pass
    return None


# ------------- #
# - USERS API - #
# ------------- #


class LoginViewSet(viewsets.ViewSet):
    permission_classes = [permissions.AllowAny]
    serializer_class = LoginSerializer

    # Login the user
    def create(self, request):
        serializer = self.serializer_class(data=request.data)

        if serializer.is_valid():
            email = serializer.validated_data["email"]
            password = serializer.validated_data["password"]
            # Check if the user exists and the password is correct
            user = authenticate(email=email, password=password)

            # If the user exists, create a token
            if user:
                # This creates a token in the database
                _, token = AuthToken.objects.create(user)
                return Response(
                    {
                        "user": self.serializer_class(user).data,
                        "token": token,
                    }
                )
            else:
                # If the user does not exist, return an error
                return Response(
                    {"error": "Invalid credentials"},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UpdateProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request):
        serializer = RegisterSerializer(
            request.user, data=request.data, partial=True
        )  # Use RegisterSerializer for updating
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
def validate_token(request):
    """Validate if the provided token is valid and not expired"""
    if request.user.is_authenticated:
        return Response({"valid": True}, status=status.HTTP_200_OK)
    return Response({"valid": False}, status=status.HTTP_401_UNAUTHORIZED)


class RegisterViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.AllowAny]
    queryset = User.objects.all()
    serializer_class = RegisterSerializer

    def create(self, request):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Create user
        user = serializer.save()
        # Create token
        _, token = AuthToken.objects.create(user)

        return Response(
            {"user": serializer.data, "token": token}, status=status.HTTP_201_CREATED
        )


class UserAPIKeyViewSet(viewsets.ModelViewSet):
    serializer_class = UserAPIKeySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Return API keys only for the current authenticated user.
        return UserAPIKey.objects.filter(user=self.request.user)


# --------------------- #
# - CONVERSATIONS API - #
# --------------------- #


class ConversationViewSet(viewsets.ModelViewSet):
    queryset = Conversation.objects.all()
    serializer_class = ConversationSerializer

    def list(self, request, *args, **kwargs):
        profile_report_ids = request.query_params.get("profile_report_ids", None)
        profile_report_id = request.query_params.get("profile_report_id", None)

        if profile_report_ids is not None:
            profile_reports = ProfileReport.objects.filter(
                id__in=profile_report_ids.split(",")
            )
            queryset = self.filter_queryset(self.get_queryset()).filter(
                profile_report__in=profile_reports
            )
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        elif profile_report_id is not None:
            queryset = self.filter_queryset(self.get_queryset()).filter(
                profile_report=profile_report_id
            )
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        else:
            queryset = self.filter_queryset(self.get_queryset())
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)


# ------------------- #
# - TEST ERRORS API - #
# ------------------- #


class TestErrorViewSet(viewsets.ModelViewSet):
    queryset = TestError.objects.all()
    serializer_class = TestErrorSerializer

    def list(self, request, *args, **kwargs):
        global_report_ids = request.query_params.get("global_report_ids", None)
        global_report_id = request.query_params.get("global_report_id", None)
        profile_report_ids = request.query_params.get("profile_report_ids", None)
        profile_report_id = request.query_params.get("profile_report_id", None)

        if global_report_ids is not None:
            global_reports = GlobalReport.objects.filter(
                id__in=global_report_ids.split(",")
            )
            queryset = self.filter_queryset(self.get_queryset()).filter(
                global_report__in=global_reports
            )
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)

        elif global_report_id is not None:
            queryset = self.filter_queryset(self.get_queryset()).filter(
                global_report=global_report_id
            )
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        elif profile_report_ids is not None:
            queryset = self.filter_queryset(self.get_queryset()).filter(
                profile_report__in=profile_report_ids.split(",")
            )
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        elif profile_report_id is not None:
            queryset = self.filter_queryset(self.get_queryset()).filter(
                profile_report=profile_report_id
            )
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        else:
            queryset = self.filter_queryset(self.get_queryset())
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)


# ----------------------- #
# - PROFILE REPORTS API - #
# ----------------------- #


class ProfileReportViewSet(viewsets.ModelViewSet):
    queryset = ProfileReport.objects.all()
    serializer_class = ProfileReportSerializer

    def list(self, request, *args, **kwargs):
        global_report_ids = request.query_params.get("global_report_ids", None)
        global_report_id = request.query_params.get("global_report_id", None)

        if global_report_ids is not None:
            global_reports = GlobalReport.objects.filter(
                id__in=global_report_ids.split(",")
            )
            queryset = self.filter_queryset(self.get_queryset()).filter(
                global_report__in=global_reports
            )
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)

        elif global_report_id is not None:
            queryset = self.filter_queryset(self.get_queryset()).filter(
                global_report=global_report_id
            )
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        else:
            queryset = self.filter_queryset(self.get_queryset())
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)


# ---------------------- #
# - GLOBAL REPORTS API - #
# ---------------------- #


class GlobalReportViewSet(viewsets.ModelViewSet):
    queryset = GlobalReport.objects.all()
    serializer_class = GlobalReportSerializer

    def list(self, request, *args, **kwargs):
        test_cases = request.query_params.get("test_cases_ids", None)
        test_case = request.query_params.get("test_case_id", None)

        if test_cases is not None:
            test_cases = test_cases.split(",")
            queryset = self.filter_queryset(self.get_queryset()).filter(
                test_case__in=test_cases
            )
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        elif test_case is not None:
            # Get the global report for a single test case
            queryset = (
                self.filter_queryset(self.get_queryset())
                .filter(test_case=test_case)
                .first()
            )
            serializer = self.get_serializer(queryset)
            return Response(serializer.data)
        else:
            queryset = self.filter_queryset(self.get_queryset())
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)


# ---------------------- #
# - CHATBOT TECHNOLOGY - #
# ---------------------- #


def get_technology_choices(request):
    return JsonResponse({"technology_choices": TECHNOLOGY_CHOICES})


class ChatbotTechnologyViewSet(viewsets.ModelViewSet):
    queryset = ChatbotTechnology.objects.all()
    serializer_class = ChatbotTechnologySerializer

    # Check if the technology name is already used
    @action(detail=False, methods=["get"], url_path="check-name")
    def check_name(self, request):
        """Check if a technology name is already used. It cant be none or empty."""
        name = request.query_params.get("chatbot_name", None)
        if name is None or not name.strip():
            return Response(
                {"error": "No technology name provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        exists = ChatbotTechnology.objects.filter(name=name).exists()
        return Response({"exists": exists}, status=status.HTTP_200_OK)


# ----------------- #
# - TEST CASES API #
# ----------------- #


class TestCaseAccessPermission(BasePermission):
    """Permission class for TestCase access"""

    def has_object_permission(self, request, view, obj):
        # Allow access if project is public or user is the owner
        return obj.project.public or (
            request.user.is_authenticated and request.user == obj.project.owner
        )


class TestCaseViewSet(viewsets.ModelViewSet):
    queryset = TestCase.objects.all()
    serializer_class = TestCaseSerializer
    permission_classes = [TestCaseAccessPermission]

    def get_queryset(self):
        """Filter queryset based on query params and permissions"""
        project_ids = self.request.query_params.get("project_ids", None)
        testcase_id = self.request.query_params.get("testcase_id", None)

        # Start with base queryset
        queryset = TestCase.objects.all()

        # Filter by project IDs if provided
        if project_ids:
            queryset = queryset.filter(project__in=project_ids.split(","))

        # Filter by test case ID if provided
        if testcase_id:
            queryset = queryset.filter(id=testcase_id)

        # Filter based on permissions
        if self.request.user.is_authenticated:
            return queryset.filter(
                models.Q(project__public=True)
                | models.Q(project__owner=self.request.user)
            )
        return queryset.filter(project__public=True)

    def get_object(self):
        """Override get_object to handle permissions"""
        obj = get_object_or_404(TestCase, pk=self.kwargs["pk"])
        self.check_object_permissions(self.request, obj)
        return obj

    @action(detail=False, methods=["get"], url_path="check-name")
    def check_name(self, request, *args, **kwargs):
        """Check if a test name is already used in the project"""
        project_id = request.query_params.get("project_id", None)
        test_name = request.query_params.get("test_name", None)

        if project_id is None:
            return Response(
                {"error": "No project ID provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if test_name is None or not test_name.strip():
            return Response({"exists": False}, status=status.HTTP_200_OK)

        exists = TestCase.objects.filter(project=project_id, name=test_name).exists()
        return Response({"exists": exists}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="paginated")
    def get_paginated(self, request):
        page = int(request.query_params.get("page", 1))
        per_page = int(request.query_params.get("per_page", 10))
        sort_column = request.query_params.get("sort_column", "executed_at")
        sort_direction = request.query_params.get("sort_direction", "descending")
        project_ids = request.query_params.get("project_ids", "").split(",")
        status = request.query_params.get("status", "")
        search = request.query_params.get("search", "").strip()

        # Since total_cost and num_errors are not fields in the TestCase model
        # Annotate each TestCase with total_cost and num_errors
        queryset = TestCase.objects.annotate(
            # total_cost comes from the first GlobalReport found for the TestCase
            total_cost=Subquery(
                GlobalReport.objects.filter(test_case=OuterRef("pk")).values(
                    "total_cost"
                )[:1]
            ),
            # num_errors is the sum of all errors for that test case
            num_errors=Subquery(
                TestError.objects.filter(global_report__test_case=OuterRef("pk"))
                .values("global_report__test_case")
                .annotate(errors_count=Sum("count"))
                .values("errors_count")[:1]
            ),
        )

        # Filter by projects if any selected
        if project_ids and project_ids[0]:
            queryset = queryset.filter(project__in=project_ids)

        # Add status filter
        if status and status != "ALL":
            queryset = queryset.filter(status=status)

        # Add search filter
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(id__icontains=search)
            )

        # Handle sorting (executed_at, total_cost, num_errors, etc.)
        # Make sure these match possible columns from the frontend
        valid_sort_fields = {
            "executed_at",
            "status",
            "execution_time",
            "total_cost",
            "num_errors",
            "name",
            "project",
        }
        if sort_column not in valid_sort_fields:
            sort_column = "executed_at"

        sort_prefix = "-" if sort_direction == "descending" else ""
        queryset = queryset.order_by(f"{sort_prefix}{sort_column}")

        # Pagination
        total = queryset.count()
        start = (page - 1) * per_page
        end = start + per_page
        items = queryset[start:end]

        serializer = TestCaseSerializer(items, many=True)
        return Response(
            {
                "items": serializer.data,
                "total": total,
                "page": page,
                "per_page": per_page,
            }
        )


# ------------ #
# - PROJECTS - #
# ------------ #


class ProjectAccessPermission(BasePermission):
    def has_object_permission(self, request, view, obj):
        # Allow read if project is public
        if request.method in ["GET", "HEAD", "OPTIONS"]:
            return obj.public or obj.owner == request.user
        # Allow write if owner
        return obj.owner == request.user


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [ProjectAccessPermission]
    # queryset = Project.objects.all()
    # For now we dont need pagination since there are not many projects
    # And it makes the frontend not be able to access response.data.length
    pagination_class = None

    def get_queryset(self):
        """Filter queryset based on query params"""
        show_type = self.request.query_params.get("show", "all")

        if not self.request.user.is_authenticated:
            return Project.objects.filter(public=True)

        if show_type == "owned":
            return Project.objects.filter(owner=self.request.user)
        else:  # show_type == "all"
            return Project.objects.filter(
                models.Q(public=True) | models.Q(owner=self.request.user)
            )

    def perform_create(self, serializer):
        name = serializer.validated_data["name"]
        if Project.objects.filter(owner=self.request.user, name=name).exists():
            raise serializers.ValidationError(
                {"name": "Project name already exists for this user."}
            )
        project = serializer.save(owner=self.request.user)

        # Get the path of the script
        base_dir = os.path.dirname(settings.BASE_DIR)
        init_script_path = os.path.join(
            base_dir, "user-simulator", "src", "init_project.py"
        )

        # Create path structure: filevault/projects/user_{user_id}/project_{project_id}/
        relative_path = os.path.join(
            "filevault",
            "projects",
            f"user_{self.request.user.id}",
            f"project_{project.id}",
        )
        project_path = os.path.join(base_dir, relative_path)

        if os.path.exists(init_script_path):
            try:
                subprocess.run(
                    ["python", init_script_path, "--project_name", project_path],
                    check=True,
                )
                print(
                    f"Project {project.name} (ID: {project.id}) initialized successfully at {project_path}"
                )
            except subprocess.CalledProcessError as e:
                print(f"Error initializing project structure: {e}")
        else:
            print(f"Warning: Could not find init_project.py at {init_script_path}")

    def get_object(self):
        """Override get_object to return 403 instead of 404 when object exists but user has no access"""
        # Get object by primary key
        obj = get_object_or_404(Project, pk=self.kwargs["pk"])

        # Check permissions
        if not self.get_permissions()[0].has_object_permission(self.request, self, obj):
            raise PermissionDenied("You do not have permission to access this project")

        return obj

    @action(detail=False, methods=["get"], url_path="technologies")
    def list_technologies(self, request):
        """List all available Chatbot Technologies."""
        technologies = ChatbotTechnology.objects.all()
        serializer = ChatbotTechnologySerializer(technologies, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # Check if the project name is already used by the user
    @action(detail=False, methods=["get"], url_path="check-name")
    def check_name(self, request):
        """Check if a project name is already used. It cant be none or empty."""
        name = request.query_params.get("project_name", None)
        if name is None or not name.strip():
            return Response(
                {"error": "No project name provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        exists = Project.objects.filter(owner=request.user, name=name).exists()
        return Response({"exists": exists}, status=status.HTTP_200_OK)


# ------------------------- #
# - USER PROFILES - YAMLS - #
# ------------------------- #


@api_view(["POST"])
def validate_yaml(request):
    """Validate YAML content using the YamlValidator class."""
    yaml_content = request.data.get("content")
    if not yaml_content:
        return Response(
            {"error": "No content provided"}, status=status.HTTP_400_BAD_REQUEST
        )

    validator = YamlValidator()
    validation_errors = validator.validate(yaml_content)

    if validation_errors:
        formatted_errors = [
            {"path": error.path, "message": error.message, "line": error.line}
            for error in validation_errors
        ]
        return Response(
            {"valid": False, "errors": formatted_errors}, status=status.HTTP_200_OK
        )

    return Response({"valid": True}, status=status.HTTP_200_OK)


@api_view(["GET"])
def fetch_file_content(request, file_id):
    """
    Fetch the content of a specific YAML file
    """
    try:
        test_file = get_object_or_404(TestFile, id=file_id)

        # Check permissions - user should have access to the project
        if not test_file.project.public and test_file.project.owner != request.user:
            return Response(
                {"error": "You don't have permission to access this file"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Check if file exists
        if not os.path.exists(test_file.file.path):
            return Response(
                {"error": "File not found"}, status=status.HTTP_404_NOT_FOUND
            )

        # Read the file content
        with open(test_file.file.path, "r") as file:
            content = file.read()

        return Response(
            {"id": test_file.id, "name": test_file.name, "yamlContent": content}
        )

    except TestFile.DoesNotExist:
        return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response(
            {"error": f"Error reading file: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


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
        ignore_validation_errors = request.data.get("ignore_validation_errors", False)

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
        ignore_validation_errors = request.data.get("ignore_validation_errors", False)
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


# ----------------------------- #
# - EXECUTE AUTOTEST ON FILES - #
# ----------------------------- #


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

        # Load OPENAI_API_KEY from keys.properties
        # check_keys(["OPENAI_API_KEY"])

        # Load api key from the project and decipher it
        try:
            api_key_instance = project.api_key
            if api_key_instance is not None:
                openai_api_key = cipher_suite.decrypt(
                    api_key_instance.api_key_encrypted
                ).decode()
                os.environ["OPENAI_API_KEY"] = openai_api_key
                print(f"API key successfully loaded for project {project.name}")
            else:
                print(f"No API key found for project {project.name}")
        except Exception as e:
            print(f"Error loading/decrypting API key for project {project.name}: {e}")

        # Set executed dir to MEDIA / projects / user_{user_id} / project_{project_id} / profiles / {testcase_id}
        # This way we can copy all the selected profiles into this directory and execute them

        # Get user and project id
        user_id = request.user.id
        project_id = project.id

        project_path = os.path.join(
            settings.MEDIA_ROOT,
            "projects",
            f"user_{user_id}",
            f"project_{project_id}",
        )
        print(f"Project path: {project_path}")

        # Make in a transaction to avoid partial saves
        with transaction.atomic():
            # Create TestCase instance first to get its ID
            if test_name:
                print(f"Test name: {test_name}")
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

            # Get the user and project id
            user_id = request.user.id
            project_id = project.id
            results_path = os.path.join(
                settings.MEDIA_ROOT,
                "results",
                f"user_{user_id}",
                f"project_{project_id}",
                f"testcase_{test_case.id}",
            )
            print(f"Results path: {results_path}")

            # Create a unique subdirectory for this TestCase
            user_profiles_path = os.path.join(
                project_path, "profiles", f"testcase_{test_case.id}"
            )
            os.makedirs(user_profiles_path, exist_ok=True)
            print(f"User profiles path: {user_profiles_path}")

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
                        print(f"Error loading YAML file: {e}")

                # Save the path and name of the copied file
                copied_files.append(
                    {"path": copied_file_rel_path, "name": name_extracted}
                )

            # Save the copied files to the TestCase instance
            test_case.copied_files = copied_files

            test_case.status = "RUNNING"
            test_case.save()

            # Get the number of conversations
            # And the list of names
            total_conversations = 0
            names = []

            for copied_file in copied_files:
                file_path = os.path.join(settings.MEDIA_ROOT, copied_file["path"])
                try:
                    # Load the YAML content
                    with open(file_path, "r") as file:
                        yaml_content = yaml.safe_load(file)

                    # Get the test_name from the file
                    test_name = yaml_content.get("test_name", "Unknown")
                    names.append(test_name)

                    # Use RoleData to properly calculate the number of conversations
                    try:
                        # RoleData expects the parsed YAML content, not the file path
                        # Personality file can be None, project_folder is required
                        role_data = RoleData(
                            yaml_file=yaml_content,
                            personality_file=None,
                            project_folder=project_path,
                        )
                        # The conversation_number attribute has the calculated number
                        num_conversations = role_data.conversation_number
                        print(
                            f"Profile '{test_name}': {num_conversations} conversations"
                        )
                        total_conversations += num_conversations
                    except Exception as e:
                        print(f"Error using RoleData for {test_name}: {str(e)}")
                        # Fall back to manual counting if RoleData fails
                        conv_data = yaml_content.get("conversation")

                        if isinstance(conv_data, list):
                            num_conversations = sum(
                                item.get("number", 0)
                                for item in conv_data
                                if isinstance(item, dict)
                            )
                        elif isinstance(conv_data, dict):
                            num_conversations = conv_data.get("number", 0)
                        else:
                            num_conversations = 0

                        total_conversations += num_conversations
                        print(
                            f"Fallback count for '{test_name}': {num_conversations} conversations"
                        )

                except Exception as e:
                    print(f"Error processing YAML file: {str(e)}")

            test_case.total_conversations = total_conversations
            test_case.profiles_names = names
            print(f"Total conversations calculated: {total_conversations}")

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
                project_path,
                profiles_directory,
                results_path,
                test_case,
                technology,
                link,
            ),
        ).start()

        return Response(
            {"message": "Started execution", "test_case_id": test_case.id},
            status=status.HTTP_202_ACCEPTED,
        )


def process_profile_report_from_conversation(conversation_file_path):
    """Read common fields from first conversation file"""
    to_print = False

    with open(conversation_file_path, "r") as file:
        data = yaml.safe_load_all(file)
        first_doc = next(data)

        # Extract conversation specs
        conv_specs = first_doc.get("conversation", {})
        interaction_style = next(
            (
                item["interaction_style"]
                for item in conv_specs
                if "interaction_style" in item
            ),
            {},
        )
        number = next((item["number"] for item in conv_specs if "number" in item), 0)
        steps = next((item["steps"] for item in conv_specs if "steps" in item), None)
        # Extract all_answered with limit if present
        all_answered_item = next(
            (item for item in conv_specs if "all_answered" in item), None
        )
        all_answered = None
        if all_answered_item:
            if isinstance(all_answered_item["all_answered"], dict):
                all_answered = all_answered_item["all_answered"]
            else:
                all_answered = {"value": all_answered_item["all_answered"]}

        if to_print:
            print("-" * 50)
            print("- PROFILE REPORT FROM CONVERSATION -")
            print(f"Serial: {first_doc.get('serial')}")
            print(f"Language: {first_doc.get('language')}")
            print(
                f"Personality: {next((item['personality'] for item in first_doc.get('context', []) if isinstance(item, dict) and 'personality' in item), '')}"
            )
            print(
                f"Context details: {[(item) for item in first_doc.get('context', []) if not isinstance(item, dict) or 'personality' not in item]}"
            )
            print(f"Interaction style: {interaction_style}")
            print(f"Number conversations: {number}")

        return {
            "serial": first_doc.get("serial"),
            "language": first_doc.get("language"),
            "personality": next(
                (
                    item["personality"]
                    for item in first_doc.get("context", [])
                    if isinstance(item, dict) and "personality" in item
                ),
                "",
            ),
            "context_details": [
                item
                for item in first_doc.get("context", [])
                if not isinstance(item, dict) or "personality" not in item
            ],
            "interaction_style": interaction_style,
            "number_conversations": number,
            "steps": steps,
            "all_answered": all_answered,
        }


def process_conversation(conversation_file_path):
    """Process individual conversation file"""

    # File name without extension
    name = os.path.splitext(os.path.basename(conversation_file_path))[0]
    with open(conversation_file_path, "r") as file:
        docs = list(yaml.safe_load_all(file))
        main_doc = docs[0]

        # Split the document at the separator lines
        conversation_data = {
            "name": name,
            "ask_about": main_doc.get("ask_about", {}),
            "data_output": main_doc.get("data_output", {}),
            "errors": main_doc.get("errors", {}),
            "total_cost": float(main_doc.get("total_cost($)", 0)),
            "conversation_time": float(docs[1].get("conversation time", 0)),
            "response_times": docs[1].get("assistant response time", []),
            "response_time_avg": docs[1]
            .get("response time report", {})
            .get("average", 0),
            "response_time_max": docs[1].get("response time report", {}).get("max", 0),
            "response_time_min": docs[1].get("response time report", {}).get("min", 0),
            "interaction": docs[2].get("interaction", []),
        }
        return conversation_data


"""
                script_path,
                script_cwd,
                project_path,
                profiles_directory,
                results_path,
                test_case,
                technology,
                link,"""


def run_asyn_test_execution(
    script_path,
    script_cwd,
    project_path,
    profiles_directory,
    results_path,
    test_case,
    technology,
    link: None,
):
    try:
        start_time = time.time()
        # Build the command list
        command = [
            "python",
            script_path,
            "--technology",
            technology,
            "--project_folder",
            project_path,
            "--user",
            profiles_directory,
            "--extract",
            results_path,
        ]

        # Add the link only if it is not None
        if link:
            command.extend(["--chatbot", link])
        else:
            # Place holder because --chatbot is a needed parameter
            command.extend(["--chatbot", "http://localhost:5000"])

        print(f"\nExecuting command: {command}")
        print(f"Results path: {results_path}")
        print(f"Project path: {project_path}")

        # Start the subprocess
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=script_cwd,
        )
        # Save the process id and mark the test as RUNNING
        test_case.process_id = process.pid
        test_case.status = "RUNNING"
        test_case.save()

        # To store final conversation count (using a mutable container so inner function can update it)
        final_conversation_count = [0]

        def monitor_conversations(conversations_dir, total_conversations, test_case_id):
            # Get a local copy of the test case object
            local_test_case = TestCase.objects.get(id=test_case_id)
            while True:
                local_test_case.refresh_from_db()
                if local_test_case.status != "RUNNING":
                    print("Monitoring stopped because status changed.")
                    break

                try:
                    executed_conversations = 0
                    # NEW PATH: conversations are now in conversation_outputs/{profile}
                    conversation_outputs_dir = os.path.join(
                        conversations_dir, "conversation_outputs"
                    )
                    if os.path.exists(conversation_outputs_dir):
                        for profile in local_test_case.profiles_names:
                            profile_dir = os.path.join(
                                conversation_outputs_dir, profile
                            )
                            if os.path.exists(profile_dir):
                                subdirs = os.listdir(profile_dir)
                                if subdirs:
                                    # Assume the first subdirectory is the one we need
                                    date_hour_dir = os.path.join(
                                        profile_dir, subdirs[0]
                                    )
                                    executed_conversations += len(
                                        os.listdir(date_hour_dir)
                                    )

                        local_test_case.executed_conversations = executed_conversations
                        local_test_case.save()
                        final_conversation_count[0] = executed_conversations

                        if executed_conversations >= total_conversations:
                            print("All conversations found. Exiting monitoring.")
                            break
                except Exception as e:
                    print(f"Error in monitor_conversations: {e}")
                    break

                time.sleep(3)

        # Start the monitoring thread
        conversations_dir = results_path
        print(f"Monitoring conversations in: {conversations_dir}")
        total_conversations = test_case.total_conversations
        monitoring_thread = threading.Thread(
            target=monitor_conversations,
            args=(conversations_dir, total_conversations, test_case.id),
        )
        monitoring_thread.daemon = True
        monitoring_thread.start()

        # Poll the process every few seconds to check if it has finished
        stdout, stderr = b"", b""
        timeout_seconds = 3
        while True:
            try:
                # This will check if the process is still running
                stdout, stderr = process.communicate(timeout=timeout_seconds)
                break
            except subprocess.TimeoutExpired:
                # If the process is still running, check if the test was stopped
                test_case.refresh_from_db()
                if test_case.status == "STOPPED":
                    print("Stop flag detected. Terminating subprocess.")
                    try:
                        proc = psutil.Process(test_case.process_id)
                        for child in proc.children(recursive=True):
                            child.terminate()
                        proc.terminate()
                        psutil.wait_procs([proc], timeout=timeout_seconds)
                    except Exception as ex:
                        print(f"Error while terminating process: {ex}")
                    # Continue polling until process exits
                    continue

        # Wait for the monitoring thread to finish
        monitoring_thread.join(timeout=10)

        end_time = time.time()
        elapsed_time = round(end_time - start_time, 2)

        # Check immediately if the test was stopped.
        test_case.refresh_from_db()
        if test_case.status == "STOPPED":
            print("Test execution was stopped by the user.")
            test_case.result = "Test execution was stopped by the user."
            test_case.execution_time = elapsed_time
            test_case.save()
            return

        # Otherwise, update test_case with results (marking as COMPLETED)
        test_case.execution_time = elapsed_time
        test_case.result = stdout.decode().strip() or stderr.decode().strip()
        test_case.executed_conversations = final_conversation_count[0]
        test_case.status = "COMPLETED"
        test_case.save()
        print("COMPLETED")

        # Continue with report processing only if we’re not stopped
        # NEW PATH: reports are now in reports/__stats_reports__
        report_path = os.path.join(results_path, "reports", "__stats_reports__")
        if not os.path.exists(report_path):
            test_case.status = "ERROR"
            test_case.result += "\nError accessing __stats_reports__ directory"
            test_case.save()
            return

        report_file = None
        try:
            for file in os.listdir(report_path):
                if file.startswith("report_") and file.endswith(".yml"):
                    report_file = file
                    break
        except OSError:
            test_case.status = "ERROR"
            test_case.result += "\nError accessing report directory"
            test_case.save()
            return

        if report_file is None:
            test_case.status = "ERROR"
            test_case.result += "\nReport file not found"
            test_case.save()
            return

        # Set status to COMPLETED if we reached here, then proceed with report processing.
        test_case.status = "COMPLETED"
        test_case.save()

        # In the documents there is a global, and then a profile_report for each test_case
        documents = []
        with open(os.path.join(report_path, report_file), "r") as file:
            documents = list(yaml.safe_load_all(file))

        # ----------------- #
        # - GLOBAL REPORT - #
        # ----------------- #
        global_report = documents[0]

        global_avg_response_time = global_report["Global report"][
            "Average assistant response time"
        ]
        global_min_response_time = global_report["Global report"][
            "Minimum assistant response time"
        ]
        global_max_response_time = global_report["Global report"][
            "Maximum assistant response time"
        ]

        global_total_cost = global_report["Global report"]["Total Cost"]

        global_report_instance = GlobalReport.objects.create(
            name="Global Report",
            avg_execution_time=global_avg_response_time,
            min_execution_time=global_min_response_time,
            max_execution_time=global_max_response_time,
            total_cost=global_total_cost,
            test_case=test_case,
        )

        global_report_instance.save()

        # Errors in the global report
        global_errors = global_report["Global report"]["Errors"]
        # print(f"Global errors: {global_errors}")
        for error in global_errors:
            error_code = error["error"]
            error_count = error["count"]
            error_conversations = [conv for conv in error["conversations"]]

            test_error = TestError.objects.create(
                code=error_code,
                count=error_count,
                conversations=error_conversations,
                global_report=global_report_instance,
            )

            test_error.save()

        global_report_instance.save()

        # ------------------- #
        # - PROFILE REPORTS - #
        # ------------------- #

        # Profile reports are in the documents from 1 to n
        for profile_report in documents[1:]:
            profile_report_name = profile_report["Test name"]
            profile_report_avg_response_time = profile_report[
                "Average assistant response time"
            ]
            profile_report_min_response_time = profile_report[
                "Minimum assistant response time"
            ]
            profile_report_max_response_time = profile_report[
                "Maximum assistant response time"
            ]

            test_total_cost = profile_report["Total Cost"]

            profile_report_instance = ProfileReport.objects.create(
                name=profile_report_name,
                avg_execution_time=profile_report_avg_response_time,
                min_execution_time=profile_report_min_response_time,
                max_execution_time=profile_report_max_response_time,
                total_cost=test_total_cost,
                global_report=global_report_instance,
                # Initialize common fields
                # Decided this so that if the first conversation file is missing, the profile report is still created
                serial="",
                language="",
                personality="",
                context_details=[],
                interaction_style={},
                number_conversations=0,
            )

            # Process conversations directory
            # It is the {project_id}/{profile_report_name}/{a date + hour}
            conversations_dir = os.path.join(results_path, profile_report_name)
            # Since we dont have the date and hour, we get the first directory (the only one)
            # Process conversations directory with NEW PATH
            # It is now in conversation_outputs/{profile_name}/{a date + hour}
            conversations_dir = os.path.join(
                results_path, "conversation_outputs", profile_report_name
            )
            if os.path.exists(conversations_dir):
                subdirs = os.listdir(conversations_dir)
                if subdirs:
                    # Since we dont have the date and hour, we get the first directory (the only one)
                    conversations_dir = os.path.join(conversations_dir, subdirs[0])
                    print(f"Conversations dir: {conversations_dir}")

                    # Get the first conversation file to extract common fields
                    conv_files = sorted(
                        [f for f in os.listdir(conversations_dir) if f.endswith(".yml")]
                    )
                    print(f"Conversation files: {conv_files}")
                    if conv_files:
                        print(f"First conversation file: {conv_files[0]}")
                        first_conv_path = os.path.join(conversations_dir, conv_files[0])
                        profile_data = process_profile_report_from_conversation(
                            first_conv_path
                        )

                    # Update profile report with common fields
                    for field, value in profile_data.items():
                        setattr(profile_report_instance, field, value)
                    profile_report_instance.save()

                    # Process each conversation file
                    for conv_file in conv_files:
                        conv_path = os.path.join(conversations_dir, conv_file)
                        conv_data = process_conversation(conv_path)

                        Conversation.objects.create(
                            profile_report=profile_report_instance, **conv_data
                        )

            # Errors in the profile report
            test_errors = profile_report["Errors"]
            print(f"Test errors: {test_errors}")
            for error in test_errors:
                error_code = error["error"]
                error_count = error["count"]
                error_conversations = [conv for conv in error["conversations"]]

                test_error = TestError.objects.create(
                    code=error_code,
                    count=error_count,
                    conversations=error_conversations,
                    profile_report=profile_report_instance,
                )

                test_error.save()

            profile_report_instance.save()
        test_case.save()

    except Exception as e:
        if test_case.status == "STOPPED":
            return
        print("SETUP ERROR")
        test_case.result = f"Error: {e}\n{traceback.format_exc()}"
        test_case.execution_time = 0
        test_case.status = "ERROR"
        test_case.save()


logger = logging.getLogger(__name__)


@api_view(["POST"])
def stop_test_execution(request):
    test_case_id = request.data.get("test_case_id")
    logger.info(f"Stopping test case: {test_case_id}")

    try:
        test_case = TestCase.objects.get(id=test_case_id)
        if test_case.result is None:
            test_case.result = ""

        if test_case.process_id and test_case.status == "RUNNING":
            try:
                # Use psutil to terminate process and its children
                process = psutil.Process(test_case.process_id)
                for child in process.children(recursive=True):
                    child.terminate()
                process.terminate()
                psutil.wait_procs([process], timeout=3)

                test_case.status = "STOPPED"
                test_case.result += " Test execution stopped by user."
                test_case.save()

                logger.info(f"Test case {test_case_id} stopped successfully")
                return Response({"message": "Test execution stopped"}, status=200)

            except psutil.NoSuchProcess:
                logger.warning(f"Process {test_case.process_id} not found")
                test_case.status = "STOPPED"
                test_case.result = "Test execution stopped (process not found)"
                test_case.save()
                return Response({"message": "Test execution stopped"}, status=200)
        else:
            logger.warning(f"No running process found for test case {test_case_id}")
            return Response({"error": "No running process found"}, status=400)

    except TestCase.DoesNotExist:
        logger.error(f"Test case {test_case_id} not found")
        return Response({"error": "Test case not found"}, status=404)


def run_async_profile_generation(task_id, technology, conversations, turns, user_id):
    task = ProfileGenerationTask.objects.get(id=task_id)
    task.status = "RUNNING"
    task.save()

    try:
        # Set up paths
        base_dir = os.path.dirname(settings.BASE_DIR)
        tfm_script_path = os.path.join(base_dir, "tfm", "src", "main.py")

        # Create output directory
        output_dir = os.path.join(
            settings.MEDIA_ROOT,
            "projects",
            f"user_{user_id}",
            f"project_{task.project.id}",
            "profiles",
        )
        os.makedirs(output_dir, exist_ok=True)

        # Build and execute command
        command = [
            "python",
            tfm_script_path,
            "-t",
            technology,
            "-s",
            str(conversations),
            "-n",
            str(turns),
            "-o",
            output_dir,
        ]

        process = subprocess.Popen(
            command, stdout=subprocess.PIPE, stderr=subprocess.PIPE
        )
        task.process_id = process.pid
        task.save()

        stdout, stderr = process.communicate()

        # Check the return code of the subprocess
        if process.returncode != 0:
            task.status = "ERROR"
            task.error_message = f"Subprocess failed with return code {process.returncode}. Error: {stderr.decode().strip()}"
            task.save()
            return

        # Process generated files and save to database
        generated_files = []
        file_ids = []

        if os.path.exists(output_dir):
            generated_files = [
                f for f in os.listdir(output_dir) if f.endswith((".yaml", ".yml"))
            ]

            for filename in generated_files:
                file_path = os.path.join(output_dir, filename)

                # Extract test_name from YAML
                test_name = None
                with open(file_path, "r") as f:
                    try:
                        content = yaml.safe_load(f)
                        test_name = content.get(
                            "test_name", os.path.splitext(filename)[0]
                        )
                    except yaml.YAMLError:
                        test_name = os.path.splitext(filename)[0]

                # Create TestFile
                with open(file_path, "rb") as f:
                    django_file = File(f)
                    test_file = TestFile.objects.create(
                        name=test_name,
                        project=task.project,
                        is_valid=True,
                    )
                    test_file.file.save(filename, django_file)
                    file_ids.append(test_file.id)

        # Update task status
        task.status = "COMPLETED"
        task.generated_file_ids = file_ids
        task.save()

    except Exception as e:
        task.status = "ERROR"
        task.error_message = str(e)
        task.save()


@api_view(["POST"])
def generate_profiles(request):
    """
    Start a profile generation task and return immediately.
    """
    # Authentication check
    if not request.user.is_authenticated:
        return Response(
            {"error": "Authentication required to generate profiles."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Get parameters
    project_id = request.data.get("project_id")
    conversations = request.data.get("conversations", 5)
    turns = request.data.get("turns", 5)

    if not project_id:
        return Response(
            {"error": "No project ID provided."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Check project exists and user has permission
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

    # Start generation in background thread
    threading.Thread(
        target=run_async_profile_generation,
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
                "generated_files": len(task.generated_file_ids),
                "error_message": task.error_message,
            }
        )
    except ProfileGenerationTask.DoesNotExist:
        return Response({"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND)
