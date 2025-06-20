"""Reports API endpoints for Profile and Global reports."""

from typing import Any

from rest_framework import viewsets
from rest_framework.request import Request
from rest_framework.response import Response

from tester.models import GlobalReport, ProfileReport
from tester.serializers import GlobalReportSerializer, ProfileReportSerializer


class ProfileReportViewSet(viewsets.ModelViewSet):
    """API ViewSet for managing ProfileReports."""

    queryset = ProfileReport.objects.all()
    serializer_class = ProfileReportSerializer

    def list(self, request: Request, *_args: Any, **_kwargs: Any) -> Response:  # noqa: ANN401
        """List ProfileReports, optionally filtered by GlobalReport IDs."""
        global_report_ids = request.query_params.get("global_report_ids", None)
        global_report_id = request.query_params.get("global_report_id", None)

        if global_report_ids is not None:
            global_reports = GlobalReport.objects.filter(id__in=global_report_ids.split(","))
            queryset = self.filter_queryset(self.get_queryset()).filter(global_report__in=global_reports)
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)

        if global_report_id is not None:
            queryset = self.filter_queryset(self.get_queryset()).filter(global_report=global_report_id)
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class GlobalReportViewSet(viewsets.ModelViewSet):
    """API ViewSet for managing GlobalReports."""

    queryset = GlobalReport.objects.all()
    serializer_class = GlobalReportSerializer

    def list(self, request: Request, *_args: Any, **_kwargs: Any) -> Response:  # noqa: ANN401
        """List GlobalReports, optionally filtered by TestCase IDs."""
        test_cases = request.query_params.get("test_cases_ids", None)
        test_case = request.query_params.get("test_case_id", None)

        if test_cases is not None:
            test_cases = test_cases.split(",")
            queryset = self.filter_queryset(self.get_queryset()).filter(test_case__in=test_cases)
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        if test_case is not None:
            # Get the global report for a single test case
            queryset = self.filter_queryset(self.get_queryset()).filter(test_case=test_case).first()
            serializer = self.get_serializer(queryset)
            return Response(serializer.data)
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
