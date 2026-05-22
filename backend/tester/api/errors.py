"""Test Errors API endpoints."""

from typing import Any

from rest_framework import status, viewsets
from rest_framework.request import Request
from rest_framework.response import Response

from tester.models import TestError
from tester.serializers import TestErrorSerializer


def _parse_id_filter(value: str, parameter_name: str) -> list[int] | Response:
    """Parse one ID or a comma-separated ID list from a query parameter."""
    raw_ids = [raw_id.strip() for raw_id in value.split(",") if raw_id.strip()]
    if not raw_ids:
        return []

    invalid_ids = [raw_id for raw_id in raw_ids if not raw_id.isdecimal()]
    if invalid_ids:
        return Response(
            {
                "error": f"Invalid {parameter_name}. Expected numeric ID values.",
                "invalid_values": invalid_ids,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    return [int(raw_id) for raw_id in raw_ids]


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
            ids = _parse_id_filter(global_report_ids, "global_report_ids")
            if isinstance(ids, Response):
                return ids
            queryset = queryset.filter(global_report__id__in=ids)

        global_report_id = request.query_params.get("global_report_id")
        if global_report_id:
            ids = _parse_id_filter(global_report_id, "global_report_id")
            if isinstance(ids, Response):
                return ids
            queryset = queryset.filter(global_report__id=ids[0])

        profile_report_ids = request.query_params.get("profile_report_ids")
        if profile_report_ids:
            ids = _parse_id_filter(profile_report_ids, "profile_report_ids")
            if isinstance(ids, Response):
                return ids
            queryset = queryset.filter(profile_report__id__in=ids)

        profile_report_id = request.query_params.get("profile_report_id")
        if profile_report_id:
            ids = _parse_id_filter(profile_report_id, "profile_report_id")
            if isinstance(ids, Response):
                return ids
            queryset = queryset.filter(profile_report__id=ids[0])

        # Apply any generic filtering backends after custom filtering
        filtered_queryset = self.filter_queryset(queryset)

        serializer = self.get_serializer(filtered_queryset, many=True)
        return Response(serializer.data)
