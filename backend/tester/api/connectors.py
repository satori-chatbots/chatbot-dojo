"""Chatbot Technology API endpoints."""

from django.http import JsonResponse
from rest_framework import status, viewsets
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

    queryset = ChatbotConnector.objects.all()
    serializer_class = ChatbotConnectorSerializer

    @action(detail=False, methods=["get"], url_path="check-name")
    def check_name(self, request: Request) -> Response:
        """Check if a connector name is already used. It can't be none or empty."""
        name = request.query_params.get("chatbot_name", None)
        if name is None or not name.strip():
            return Response(
                {"error": "No connector name provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        exists = ChatbotConnector.objects.filter(name=name).exists()
        return Response({"exists": exists}, status=status.HTTP_200_OK)
