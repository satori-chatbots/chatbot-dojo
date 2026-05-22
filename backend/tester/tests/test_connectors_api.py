"""Tests for chatbot connector metadata endpoints."""

from unittest.mock import MagicMock, patch

from chatbot_connectors.core import Parameter
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

HTTP_OK = 200


class ConnectorMetadataAPITests(TestCase):
    """Validate connector parameter metadata returned to the frontend."""

    def setUp(self) -> None:
        """Clear cached connector metadata before each test."""
        cache.clear()
        self.client = APIClient()

    @patch("tester.api.connectors.ChatbotFactory.get_chatbot_parameters")
    def test_millionbot_parameters_include_local_compatibility_fields(
        self, get_chatbot_parameters_mock: MagicMock
    ) -> None:
        """MillionBot should expose new runtime parameters before every dependency is upgraded."""
        get_chatbot_parameters_mock.return_value = [
            Parameter(
                name="bot_id",
                type="string",
                required=True,
                description="The Bot ID for the MillionBot.",
            )
        ]

        response = self.client.get("/api/chatbotconnectors/parameters/?technology=millionbot")

        self.assertEqual(response.status_code, HTTP_OK)  # noqa: PT009
        parameter_names = {parameter["name"] for parameter in response.data["parameters"]}
        self.assertIn("bot_id", parameter_names)  # noqa: PT009
        self.assertIn("api_key", parameter_names)  # noqa: PT009
        self.assertIn("site_url", parameter_names)  # noqa: PT009
        self.assertIn("chat_session_token", parameter_names)  # noqa: PT009
