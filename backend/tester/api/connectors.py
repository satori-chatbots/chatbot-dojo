"""Chatbot Technology API endpoints."""

import subprocess
from typing import ClassVar

from django.core.cache import cache
from django.db.models.query import QuerySet
from django.http import JsonResponse
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.request import Request
from rest_framework.response import Response

from tester.models import ChatbotConnector
from tester.serializers import ChatbotConnectorSerializer


@api_view(["GET"])
def get_available_connectors(_request: Request) -> Response:
    """Get available connector technologies from TRACER."""
    cache_key = "available_connectors"
    cached_connectors = cache.get(cache_key)

    if cached_connectors:
        return Response({"connectors": cached_connectors}, status=status.HTTP_200_OK)

    try:
        result = subprocess.run(
            ["tracer", "--list-connectors"],
            capture_output=True,
            text=True,
            check=True,
            timeout=30,
        )

        # Parse the output to extract connector information
        connectors = []
        lines = result.stdout.strip().split("\n")
        current_connector = None

        for line in lines:
            line = line.strip()
            if line.startswith("•"):
                # Extract connector name
                connector_name = line.split("•")[1].strip()
                current_connector = {"name": connector_name}
            elif line.startswith("Description:") and current_connector:
                current_connector["description"] = line.split("Description:")[1].strip()
            elif line.startswith("Use:") and current_connector:
                current_connector["usage"] = line.split("Use:")[1].strip()
                connectors.append(current_connector)
                current_connector = None
        cache.set(cache_key, connectors, timeout=3600)  # Cache for 1 hour

        return Response({"connectors": connectors}, status=status.HTTP_200_OK)

    except subprocess.TimeoutExpired:
        return Response(
            {"error": "Timeout while fetching available connectors"},
            status=status.HTTP_408_REQUEST_TIMEOUT,
        )
    except subprocess.CalledProcessError as e:
        return Response(
            {"error": f"Failed to fetch connectors: {e.stderr}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    except Exception as e:
        return Response(
            {"error": f"Unexpected error: {e!s}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
def get_connector_parameters(request: Request) -> Response:
    """Get parameters for a specific connector technology."""
    technology = request.query_params.get("technology")
    if not technology:
        return Response(
            {"error": "Technology parameter is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    cache_key = f"connector_parameters_{technology}"
    cached_parameters = cache.get(cache_key)

    if cached_parameters:
        return Response(
            {"technology": technology, "parameters": cached_parameters},
            status=status.HTTP_200_OK,
        )

    try:
        result = subprocess.run(
            ["tracer", "--list-connector-params", technology],
            capture_output=True,
            text=True,
            check=True,
            timeout=30,
        )

        # Parse the output to extract parameter information
        parameters = []
        lines = result.stdout.strip().split("\n")
        current_param = None

        for line in lines:
            line = line.strip()
            if line.startswith("- Name:"):
                if current_param:
                    parameters.append(current_param)
                current_param = {"name": line.split("Name:")[1].strip()}
            elif line.startswith("Type:") and current_param:
                current_param["type"] = line.split("Type:")[1].strip()
            elif line.startswith("Required:") and current_param:
                current_param["required"] = line.split("Required:")[1].strip().lower() == "true"
            elif line.startswith("Default:") and current_param:
                current_param["default"] = line.split("Default:")[1].strip()
            elif line.startswith("Description:") and current_param:
                current_param["description"] = line.split("Description:")[1].strip()

        if current_param:
            parameters.append(current_param)
        cache.set(cache_key, parameters, timeout=3600)  # Cache for 1 hour

        return Response({"technology": technology, "parameters": parameters}, status=status.HTTP_200_OK)

    except subprocess.TimeoutExpired:
        return Response(
            {"error": "Timeout while fetching connector parameters"},
            status=status.HTTP_408_REQUEST_TIMEOUT,
        )
    except subprocess.CalledProcessError as e:
        return Response(
            {"error": f"Failed to fetch parameters for {technology}: {e.stderr}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    except Exception as e:
        return Response(
            {"error": f"Unexpected error: {e!s}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


def get_technology_choices(_request: object) -> JsonResponse:
    """Return available technology choices from TRACER (deprecated - use get_available_connectors)."""
    # Keep for backward compatibility but return empty choices since they're now dynamic
    return JsonResponse({"technology_choices": []})


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
