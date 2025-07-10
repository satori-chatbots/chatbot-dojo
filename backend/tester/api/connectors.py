"""Chatbot Technology API endpoints."""

from typing import ClassVar

from django.db.models.query import QuerySet
from django.http import JsonResponse
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from tester.models import CONNECTOR_CHOICES, ChatbotConnector
from tester.serializers import ChatbotConnectorSerializer


def get_technology_choices(_request: object) -> JsonResponse:
    """Return available technology choices."""
    return JsonResponse({"technology_choices": CONNECTOR_CHOICES})


class ChatbotConnectorViewSet(viewsets.ModelViewSet):
    """ViewSet for managing chatbot connectors."""

    serializer_class = ChatbotConnectorSerializer
    permission_classes: ClassVar = [permissions.IsAuthenticated]

    def get_queryset(self) -> QuerySet[ChatbotConnector]:
        """Return connectors only for the current authenticated user."""
        return ChatbotConnector.objects.filter(owner=self.request.user)

    def perform_create(self, serializer: ChatbotConnectorSerializer) -> None:
        """Set the owner to the current user when creating a connector."""
        serializer.save(owner=self.request.user)

    @action(detail=False, methods=["get"], url_path="check-name")
    def check_name(self, request: Request) -> Response:
        """Check if a connector name is already used by the current user. It can't be none or empty."""
        name = request.query_params.get("chatbot_name", None)
        if name is None or not name.strip():
            return Response(
                {"error": "No connector name provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Only check for existing names within the user's own connectors
        exists = ChatbotConnector.objects.filter(name=name, owner=request.user).exists()
        return Response({"exists": exists}, status=status.HTTP_200_OK)
