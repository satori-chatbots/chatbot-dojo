"""Chatbot Technology API endpoints."""

from typing import ClassVar

import yaml
from chatbot_connectors import ChatbotFactory
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.db.models.query import QuerySet
from django.http import JsonResponse
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.request import Request
from rest_framework.response import Response

from tester.models import ChatbotConnector
from tester.serializers import ChatbotConnectorSerializer

# Cache timeout for connector information (1 hour)
CACHE_TIMEOUT_SECONDS = 3600


@api_view(["GET"])
def get_available_connectors(_request: Request) -> Response:
    """Get available connector technologies from ChatbotFactory."""
    cache_key = "available_connectors"
    cached_connectors = cache.get(cache_key)

    if cached_connectors:
        return Response({"connectors": cached_connectors}, status=status.HTTP_200_OK)

    try:
        available_types = ChatbotFactory.get_available_types()
        registered_connectors = ChatbotFactory.get_registered_connectors()

        connectors = []
        for connector_type in sorted(available_types):
            connector_info = registered_connectors.get(connector_type, {})
            description = connector_info.get("description", "No description available")

            connectors.append(
                {"name": connector_type, "description": description, "usage": f"--technology {connector_type}"}
            )

        cache.set(cache_key, connectors, timeout=CACHE_TIMEOUT_SECONDS)  # Cache for 1 hour
        return Response({"connectors": connectors}, status=status.HTTP_200_OK)

    except (ImportError, AttributeError) as e:
        return Response(
            {"error": f"Error retrieving connector information: {e!s}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    except (OSError, RuntimeError) as e:
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
        params = ChatbotFactory.get_chatbot_parameters(technology)

        # Convert parameter objects to dictionaries
        parameters = []
        for param in params:
            param_dict = {
                "name": param.name,
                "type": param.type,
                "required": param.required,
                "description": param.description,
            }
            if param.default is not None:
                param_dict["default"] = param.default
            parameters.append(param_dict)

        cache.set(cache_key, parameters, timeout=CACHE_TIMEOUT_SECONDS)  # Cache for 1 hour
        return Response({"technology": technology, "parameters": parameters}, status=status.HTTP_200_OK)

    except ValueError:
        available_types = ChatbotFactory.get_available_types()
        return Response(
            {"error": f"Invalid technology '{technology}'. Available types: {', '.join(available_types)}"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except (ImportError, AttributeError) as e:
        return Response(
            {"error": f"Error retrieving parameters: {e!s}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    except (OSError, RuntimeError) as e:
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

    @action(detail=True, methods=["get", "put"], url_path="config")
    def config(self, request: Request, pk: str | None = None) -> Response:  # noqa: ARG002
        """Get or update the custom YAML configuration for a connector."""
        connector = self.get_object()

        if request.method == "GET":
            return self._handle_get_config(connector)
        if request.method == "PUT":
            return self._handle_put_config(request, connector)

        # Explicit return for any other HTTP method (though DRF should handle this)
        return Response(
            {"error": "Method not allowed"},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def _handle_get_config(self, connector: ChatbotConnector) -> Response:
        """Handle GET request for configuration."""
        if connector.custom_config_file:
            try:
                with connector.custom_config_file.open("r") as f:
                    content = f.read()
                return Response(
                    {"content": content, "name": connector.name, "id": connector.id}, status=status.HTTP_200_OK
                )
            except OSError as e:
                return Response(
                    {"error": f"Failed to read configuration: {e!s}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
        else:
            # Return empty configuration
            return Response({"content": "", "name": connector.name, "id": connector.id}, status=status.HTTP_200_OK)

    def _handle_put_config(self, request: Request, connector: ChatbotConnector) -> Response:
        """Handle PUT request for configuration."""
        content = request.data.get("content", "")

        # Validate YAML syntax
        try:
            yaml.safe_load(content)
        except yaml.YAMLError as e:
            return Response(
                {"error": f"Invalid YAML syntax: {e!s}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Save the configuration to a file
        try:
            file_content = ContentFile(content)
            file_name = f"{connector.name}_config.yml"

            # Delete old file if it exists
            if connector.custom_config_file:
                connector.custom_config_file.delete(save=False)

            # Save new file
            connector.custom_config_file.save(file_name, file_content)
            connector.save()

            return Response(
                {"message": "Configuration updated successfully", "id": connector.id}, status=status.HTTP_200_OK
            )

        except OSError as e:
            return Response(
                {"error": f"Failed to save configuration: {e!s}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
