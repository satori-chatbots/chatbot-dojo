"""
Test Cases API endpoints.
"""

from django.db import models
from django.db.models import OuterRef, Q, Subquery, Sum
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from ..models import GlobalReport, TestCase, TestError
from ..serializers import TestCaseSerializer


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
