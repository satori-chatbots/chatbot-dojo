"""Tests for the Senpai Assistant API."""

import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from tester.models import CustomUser, SenpaiConversation

HTTP_CREATED = 201
HTTP_OK = 200


class SenpaiConversationAPITests(TestCase):
    """Validate Senpai conversation initialization and messaging."""

    def setUp(self) -> None:
        """Create an authenticated user and isolated storage roots."""
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        self.media_root = Path(temp_dir.name) / "filevault"
        self.runtime_root = Path(temp_dir.name) / "senpai-runtime"

        override = override_settings(
            MEDIA_ROOT=self.media_root,
            SENPAI_ASSISTANT_RUNTIME_ROOT=self.runtime_root,
        )
        override.enable()
        self.addCleanup(override.disable)

        self.user = CustomUser.objects.create_user(email="owner@example.com")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_initialize_creates_single_conversation_and_user_directories(self) -> None:
        """Initialization should create one reusable conversation plus Senpai folders."""
        first_response = self.client.post("/api/senpai/conversation/initialize/", {}, format="json")
        second_response = self.client.post("/api/senpai/conversation/initialize/", {}, format="json")

        self.assertEqual(first_response.status_code, HTTP_CREATED)  # noqa: PT009
        self.assertEqual(second_response.status_code, HTTP_OK)  # noqa: PT009
        self.assertTrue(first_response.data["created_new_thread"])  # noqa: PT009
        self.assertFalse(second_response.data["created_new_thread"])  # noqa: PT009
        self.assertEqual(SenpaiConversation.objects.filter(user=self.user).count(), 1)  # noqa: PT009
        self.assertEqual(  # noqa: PT009
            first_response.data["conversation"]["thread_id"],
            second_response.data["conversation"]["thread_id"],
        )

        user_root = self.media_root / "projects" / f"user_{self.user.id}"
        self.assertTrue((user_root / "projects").is_dir())  # noqa: PT009
        self.assertTrue((user_root / "connectors").is_dir())  # noqa: PT009

    def test_initialize_with_force_new_replaces_existing_thread(self) -> None:
        """Force-new initialization should rotate the stored thread without creating another row."""
        first_response = self.client.post("/api/senpai/conversation/initialize/", {}, format="json")
        second_response = self.client.post(
            "/api/senpai/conversation/initialize/",
            {"force_new": True},
            format="json",
        )

        self.assertEqual(second_response.status_code, HTTP_CREATED)  # noqa: PT009
        self.assertNotEqual(  # noqa: PT009
            first_response.data["conversation"]["thread_id"],
            second_response.data["conversation"]["thread_id"],
        )
        self.assertEqual(SenpaiConversation.objects.filter(user=self.user).count(), 1)  # noqa: PT009

    @patch("tester.api.senpai.build_assistant_for_conversation")
    def test_send_message_uses_single_conversation(self, build_assistant_mock: MagicMock) -> None:
        """Sending a message should reuse or auto-create the user's only Senpai conversation."""
        assistant = MagicMock()
        assistant.send_message.return_value = "Hello from Senpai"
        build_assistant_mock.return_value = assistant

        response = self.client.post(
            "/api/senpai/conversation/message/",
            {"message": "Hello"},
            format="json",
        )

        self.assertEqual(response.status_code, HTTP_OK)  # noqa: PT009
        self.assertTrue(response.data["created_new_thread"])  # noqa: PT009
        self.assertEqual(response.data["response"], "Hello from Senpai")  # noqa: PT009
        self.assertEqual(SenpaiConversation.objects.filter(user=self.user).count(), 1)  # noqa: PT009

        conversation = SenpaiConversation.objects.get(user=self.user)
        build_assistant_mock.assert_called_once_with(conversation)
        assistant.send_message.assert_called_once_with("Hello")
        assistant.close.assert_called_once()
