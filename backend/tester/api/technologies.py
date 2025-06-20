"""Chatbot Technology API endpoints."""

from django.http import JsonResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import TECHNOLOGY_CHOICES, ChatbotTechnology
from ..serializers import ChatbotTechnologySerializer


def get_technology_choices(request):
    return JsonResponse({"technology_choices": TECHNOLOGY_CHOICES})


class ChatbotTechnologyViewSet(viewsets.ModelViewSet):
    queryset = ChatbotTechnology.objects.all()
    serializer_class = ChatbotTechnologySerializer

    @action(detail=False, methods=["get"], url_path="check-name")
    def check_name(self, request):
        """Check if a technology name is already used. It cant be none or empty."""
        name = request.query_params.get("chatbot_name", None)
        if name is None or not name.strip():
            return Response(
                {"error": "No technology name provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        exists = ChatbotTechnology.objects.filter(name=name).exists()
        return Response({"exists": exists}, status=status.HTTP_200_OK)
