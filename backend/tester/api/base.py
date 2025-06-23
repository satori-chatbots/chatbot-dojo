"""Base module with common imports and utilities for the tester API."""

import logging
import re
import sys
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

# Get the latest version of the user model
User = get_user_model()

# Setup logging
logger = logging.getLogger(__name__)

# Import the RoleData class from user-simulator (Sensei)
# Use pathlib for modern path manipulation
base_dir = Path(settings.BASE_DIR).parent
sys.path.append(str(base_dir / "user-simulator" / "src"))


def extract_test_name_from_malformed_yaml(content: bytes) -> str | None:
    """Extract test_name from potentially malformed YAML using regex.

    Returns None if no test_name is found.
    """
    try:
        # Look for test_name: "value" or test_name: 'value' or test_name: value
        pattern = r'test_name:\s*[\'"]?([\w\d_-]+)[\'"]?'
        # The content is bytes, so it needs to be decoded for regex matching.
        match = re.search(pattern, content.decode("utf-8"))
        if match:
            return match.group(1)
    except (AttributeError, UnicodeDecodeError) as e:
        # This can happen if content is not bytes or has an encoding error.
        # We log this for debugging but return None as the function is designed
        # to fail gracefully.
        logger.debug("Could not extract test_name from content: %s", e)
    return None


# Define available models for each provider
LLM_MODELS = {
    "openai": [
        {"id": "gpt-4o", "name": "GPT-4o"},
        {"id": "gpt-4o-mini", "name": "GPT-4o Mini"},
        {"id": "gpt-4.1", "name": "GPT-4.1"},
        {"id": "gpt-4.1-mini", "name": "GPT-4.1 Mini"},
        {"id": "gpt-4.1-nano", "name": "GPT-4.1 Nano"},
    ],
    "gemini": [
        {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash"},
        {"id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash"},
    ],
}


@api_view(["GET"])
def get_available_models(request: Request) -> Response:
    """Get available LLM models for a specific provider."""
    provider = request.query_params.get("provider")

    if not provider:
        return Response({"error": "Provider parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

    if provider not in LLM_MODELS:
        return Response({"error": f"Unsupported provider: {provider}"}, status=status.HTTP_400_BAD_REQUEST)

    return Response({"models": LLM_MODELS[provider]})


@api_view(["GET"])
def get_all_providers(request: Request) -> Response:  # noqa: ARG001
    """Get all available LLM providers."""
    providers = [
        {"id": "openai", "name": "OpenAI"},
        {"id": "gemini", "name": "Google Gemini"},
    ]
    return Response({"providers": providers})
