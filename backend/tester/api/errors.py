"""Test Errors API endpoints."""

from typing import Any

from rest_framework import viewsets
from rest_framework.request import Request
from rest_framework.response import Response

from tester.models import TestError
from tester.serializers import TestErrorSerializer


class TestErrorViewSet(viewsets.ModelViewSet):
    """API endpoint for viewing and managing TestError instances."""

    queryset = TestError.objects.all()
    serializer_class = TestErrorSerializer

    def list(self, request: Request, *_args: Any, **_kwargs: Any) -> Response:  # noqa: ANN401
        """List test errors, with optional filtering by report IDs.

        This method allows for cumulative filtering using the following query parameters:
        - `global_report_ids`: A comma-separated list of GlobalReport IDs.
        - `global_report_id`: A single GlobalReport ID.
        - `profile_report_ids`: A comma-separated list of ProfileReport IDs.
        - `profile_report_id`: A single ProfileReport ID.
        """
        queryset = self.get_queryset()

        global_report_ids = request.query_params.get("global_report_ids")
        if global_report_ids:
            ids = global_report_ids.split(",")
            queryset = queryset.filter(global_report__id__in=ids)

        global_report_id = request.query_params.get("global_report_id")
        if global_report_id:
            queryset = queryset.filter(global_report__id=global_report_id)

        profile_report_ids = request.query_params.get("profile_report_ids")
        if profile_report_ids:
            ids = profile_report_ids.split(",")
            queryset = queryset.filter(profile_report__id__in=ids)

        profile_report_id = request.query_params.get("profile_report_id")
        if profile_report_id:
            queryset = queryset.filter(profile_report__id=profile_report_id)

        # Apply any generic filtering backends after custom filtering
        filtered_queryset = self.filter_queryset(queryset)

        serializer = self.get_serializer(filtered_queryset, many=True)
        return Response(serializer.data)
