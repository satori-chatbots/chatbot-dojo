"""Test Errors API endpoints."""

from rest_framework import viewsets
from rest_framework.response import Response

from ..models import GlobalReport, TestError
from ..serializers import TestErrorSerializer


class TestErrorViewSet(viewsets.ModelViewSet):
    queryset = TestError.objects.all()
    serializer_class = TestErrorSerializer

    def list(self, request, *args, **kwargs):
        global_report_ids = request.query_params.get("global_report_ids", None)
        global_report_id = request.query_params.get("global_report_id", None)
        profile_report_ids = request.query_params.get("profile_report_ids", None)
        profile_report_id = request.query_params.get("profile_report_id", None)

        if global_report_ids is not None:
            global_reports = GlobalReport.objects.filter(id__in=global_report_ids.split(","))
            queryset = self.filter_queryset(self.get_queryset()).filter(global_report__in=global_reports)
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)

        if global_report_id is not None:
            queryset = self.filter_queryset(self.get_queryset()).filter(global_report=global_report_id)
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        if profile_report_ids is not None:
            queryset = self.filter_queryset(self.get_queryset()).filter(
                profile_report__in=profile_report_ids.split(",")
            )
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        if profile_report_id is not None:
            queryset = self.filter_queryset(self.get_queryset()).filter(profile_report=profile_report_id)
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
