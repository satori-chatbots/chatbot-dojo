"""API endpoints for managing and retrieving TestCases."""

from typing import Any, ClassVar

from django.db.models import OuterRef, Q, Subquery, Sum
from django.db.models.query import QuerySet
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from tester.models import GlobalReport, TestCase, TestError
from tester.serializers import TestCaseSerializer


class TestCaseAccessPermission(BasePermission):
    """Custom permission to only allow owners of a project to access its test cases."""

    def has_object_permission(self, request: Request, _view: APIView, obj: TestCase) -> bool:
        """Check if the user has permission to access the TestCase object.

        Allows access if the project is public or the user is the project owner.
        """
        return obj.project.public or (request.user.is_authenticated and request.user == obj.project.owner)


class TestCaseViewSet(viewsets.ModelViewSet):
    """API ViewSet for managing TestCases."""

    queryset = TestCase.objects.all()
    serializer_class = TestCaseSerializer
    permission_classes: ClassVar[list[type[BasePermission]]] = [TestCaseAccessPermission]

    def get_queryset(self) -> QuerySet[TestCase]:
        """Filter queryset based on query params and user permissions.

        - Filters by `project_ids` or a single `testcase_id`.
        - Ensures users can only see public test cases or their own.
        """
        project_ids = self.request.query_params.get("project_ids")
        testcase_id = self.request.query_params.get("testcase_id")

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
            return queryset.filter(Q(project__public=True) | Q(project__owner=self.request.user))
        return queryset.filter(project__public=True)

    def get_object(self) -> TestCase:
        """Override get_object to handle permissions correctly."""
        obj = get_object_or_404(TestCase, pk=self.kwargs["pk"])
        self.check_object_permissions(self.request, obj)
        return obj

    @action(detail=False, methods=["get"], url_path="check-name")
    def check_name(self, request: Request, *_args: Any, **_kwargs: Any) -> Response:  # noqa: ANN401
        """Check if a test name is already used in a specific project."""
        project_id = request.query_params.get("project_id")
        test_name = request.query_params.get("test_name")

        if not project_id:
            return Response(
                {"error": "No project ID provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not test_name or not test_name.strip():
            return Response({"exists": False}, status=status.HTTP_200_OK)

        exists = TestCase.objects.filter(project=project_id, name=test_name).exists()
        return Response({"exists": exists}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="paginated")
    def get_paginated(self, request: Request) -> Response:
        """Return a paginated, sorted, and filtered list of test cases."""
        page = int(request.query_params.get("page", 1))
        per_page = int(request.query_params.get("per_page", 10))
        sort_column = request.query_params.get("sort_column", "executed_at")
        sort_direction = request.query_params.get("sort_direction", "descending")
        project_ids_str = request.query_params.get("project_ids", "")
        project_ids = project_ids_str.split(",") if project_ids_str else []
        status_filter = request.query_params.get("status", "")
        search = request.query_params.get("search", "").strip()

        # Annotate each TestCase with total_cost and num_errors
        queryset = TestCase.objects.annotate(
            total_cost=Subquery(GlobalReport.objects.filter(test_case=OuterRef("pk")).values("total_cost")[:1]),
            num_errors=Subquery(
                TestError.objects.filter(global_report__test_case=OuterRef("pk"))
                .values("global_report__test_case")
                .annotate(errors_count=Sum("count"))
                .values("errors_count")[:1]
            ),
        )

        # Filter by projects if any selected
        if project_ids:
            queryset = queryset.filter(project__in=project_ids)

        # Add status filter
        if status_filter and status_filter != "ALL":
            queryset = queryset.filter(status=status_filter)

        # Add search filter
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(id__icontains=search))

        # Handle sorting
        valid_sort_fields = {"executed_at", "status", "execution_time", "total_cost", "num_errors", "name", "project"}
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
