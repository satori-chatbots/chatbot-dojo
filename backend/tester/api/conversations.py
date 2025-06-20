"""Conversations API endpoints.
"""

from rest_framework import viewsets
from rest_framework.response import Response

from ..models import Conversation, ProfileReport
from ..serializers import ConversationSerializer


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
        if profile_report_id is not None:
            queryset = self.filter_queryset(self.get_queryset()).filter(
                profile_report=profile_report_id
            )
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
