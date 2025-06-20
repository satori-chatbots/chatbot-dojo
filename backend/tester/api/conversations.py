"""Conversations API endpoints."""

from typing import Any

from rest_framework import viewsets
from rest_framework.request import Request
from rest_framework.response import Response

from tester.models import Conversation, ProfileReport
from tester.serializers import ConversationSerializer


class ConversationViewSet(viewsets.ModelViewSet):
    """ViewSet for managing conversations."""

    queryset = Conversation.objects.all()
    serializer_class = ConversationSerializer

    def list(self, request: Request, *_args: Any, **_kwargs: Any) -> Response:  # noqa: ANN401
        """List conversations.

        Can be filtered by a single `profile_report_id` or a comma-separated
        list of `profile_report_ids` provided as query parameters.

        Args:
            request: The HTTP request object.
            *_args: Variable length argument list (unused).
            **_kwargs: Arbitrary keyword arguments (unused).

        Returns:
            A Response object containing the serialized conversation data.
        """
        queryset = self.filter_queryset(self.get_queryset())
        profile_report_ids = request.query_params.get("profile_report_ids")
        profile_report_id = request.query_params.get("profile_report_id")

        if profile_report_ids:
            id_list = profile_report_ids.split(",")
            profile_reports = ProfileReport.objects.filter(id__in=id_list)
            queryset = queryset.filter(profile_report__in=profile_reports)
        elif profile_report_id:
            queryset = queryset.filter(profile_report=profile_report_id)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
