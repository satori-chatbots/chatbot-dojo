"""Tests for the Senpai Assistant API."""

import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from tester.models import CustomUser, SenpaiConversation, UserAPIKey
from tester.senpai import get_or_create_senpai_conversation

HTTP_CREATED = 201
HTTP_OK = 200
HTTP_BAD_REQUEST = 400


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
        self.api_key = UserAPIKey.objects.create(
            user=self.user,
            name="Primary OpenAI Key",
            provider="openai",
            api_key_encrypted="",
        )
        self.api_key.set_api_key("sk-test")
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

        user_root = self.media_root / "users" / f"user_{self.user.id}"
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

    def test_get_or_create_senpai_conversation_returns_existing_row_without_creating_duplicate(self) -> None:
        """The helper should reuse the user's OneToOne conversation row when it already exists."""
        existing = SenpaiConversation.objects.create(
            user=self.user,
            thread_id="thread-existing",
        )

        conversation, created = get_or_create_senpai_conversation(self.user)

        self.assertFalse(created)  # noqa: PT009
        self.assertEqual(conversation.pk, existing.pk)  # noqa: PT009
        self.assertEqual(conversation.thread_id, existing.thread_id)  # noqa: PT009
        self.assertEqual(SenpaiConversation.objects.filter(user=self.user).count(), 1)  # noqa: PT009

    @patch("tester.api.senpai.build_assistant_for_conversation")
    def test_send_message_uses_single_conversation(self, build_assistant_mock: MagicMock) -> None:
        """Sending a message should reuse or auto-create the user's only Senpai conversation."""
        conversation = SenpaiConversation.objects.create(
            user=self.user,
            thread_id="thread-1",
            assistant_api_key=self.api_key,
        )
        assistant = MagicMock()
        assistant.send_message.return_value = "Hello from Senpai"
        build_assistant_mock.return_value = assistant

        response = self.client.post(
            "/api/senpai/conversation/message/",
            {"message": "Hello"},
            format="json",
        )

        self.assertEqual(response.status_code, HTTP_OK)  # noqa: PT009
        self.assertFalse(response.data["created_new_thread"])  # noqa: PT009
        self.assertEqual(response.data["response"], "Hello from Senpai")  # noqa: PT009
        self.assertEqual(SenpaiConversation.objects.filter(user=self.user).count(), 1)  # noqa: PT009

        build_assistant_mock.assert_called_once_with(conversation)
        assistant.send_message.assert_called_once_with("Hello")
        assistant.close.assert_called_once()

    @patch("tester.api.senpai.build_assistant_for_conversation")
    def test_send_message_ignores_assistant_close_failure(self, build_assistant_mock: MagicMock) -> None:
        """Cleanup failures should not replace a successful assistant response."""
        SenpaiConversation.objects.create(
            user=self.user,
            thread_id="thread-1",
            assistant_api_key=self.api_key,
        )
        assistant = MagicMock()
        assistant.send_message.return_value = "Hello from Senpai"
        assistant.close.side_effect = RuntimeError("close failed")
        build_assistant_mock.return_value = assistant

        response = self.client.post(
            "/api/senpai/conversation/message/",
            {"message": "Hello"},
            format="json",
        )

        self.assertEqual(response.status_code, HTTP_OK)  # noqa: PT009
        self.assertEqual(response.data["response"], "Hello from Senpai")  # noqa: PT009
        assistant.close.assert_called_once()

    def test_send_message_requires_assistant_api_key(self) -> None:
        """The Senpai message endpoint should reject requests until an assistant API key is selected."""
        response = self.client.post(
            "/api/senpai/conversation/message/",
            {"message": "Hello"},
            format="json",
        )

        self.assertEqual(response.status_code, HTTP_BAD_REQUEST)  # noqa: PT009
        self.assertEqual(  # noqa: PT009
            response.data["error"],
            "No assistant API key is configured for this conversation.",
        )

    @patch("tester.api.senpai.build_assistant_for_conversation")
    def test_send_message_preserves_safe_runtime_error_details(self, build_assistant_mock: MagicMock) -> None:
        """User-actionable runtime failures should keep their safe client message."""
        build_assistant_mock.side_effect = RuntimeError("The selected assistant API key is empty.")

        response = self.client.post(
            "/api/senpai/conversation/message/",
            {"message": "Hello"},
            format="json",
        )

        self.assertEqual(response.status_code, HTTP_BAD_REQUEST)  # noqa: PT009
        self.assertEqual(  # noqa: PT009
            response.data["error"],
            "The selected assistant API key is empty.",
        )

    @patch("tester.api.senpai.build_assistant_for_conversation")
    def test_send_message_hides_filesystem_error_details(self, build_assistant_mock: MagicMock) -> None:
        """Filesystem failures should return a generic error without leaking server paths."""
        build_assistant_mock.side_effect = FileNotFoundError("/srv/private/users/1/projects missing")

        response = self.client.post(
            "/api/senpai/conversation/message/",
            {"message": "Hello"},
            format="json",
        )

        self.assertEqual(response.status_code, HTTP_BAD_REQUEST)  # noqa: PT009
        self.assertEqual(  # noqa: PT009
            response.data["error"],
            "Senpai Assistant workspace is unavailable.",
        )
        self.assertNotIn("/srv/private", response.data["error"])  # noqa: PT009

    @patch("tester.api.senpai.build_assistant_for_conversation")
    def test_send_message_hides_internal_runtime_error_details(self, build_assistant_mock: MagicMock) -> None:
        """Internal runtime failures should not leak implementation details to clients."""
        build_assistant_mock.side_effect = RuntimeError(
            "Unable to prepare SENSEI workspace for user 42.",
        )

        response = self.client.post(
            "/api/senpai/conversation/message/",
            {"message": "Hello"},
            format="json",
        )

        self.assertEqual(response.status_code, HTTP_BAD_REQUEST)  # noqa: PT009
        self.assertEqual(  # noqa: PT009
            response.data["error"],
            "Senpai Assistant is unavailable right now.",
        )
        self.assertNotIn("user 42", response.data["error"])  # noqa: PT009

    def test_api_key_endpoint_assigns_selected_user_api_key(self) -> None:
        """Users should be able to assign one of their stored API keys to Senpai."""
        response = self.client.patch(
            "/api/senpai/conversation/api-key/",
            {"assistant_api_key_id": self.api_key.id},
            format="json",
        )

        self.assertEqual(response.status_code, HTTP_OK)  # noqa: PT009
        conversation = SenpaiConversation.objects.get(user=self.user)
        self.assertEqual(conversation.assistant_api_key, self.api_key)  # noqa: PT009
        self.assertEqual(  # noqa: PT009
            response.data["conversation"]["assistant_api_key"]["id"],
            self.api_key.id,
        )

    def test_api_key_endpoint_omitted_field_keeps_existing_assignment(self) -> None:
        """Omitting assistant_api_key_id should not clear the current assignment."""
        SenpaiConversation.objects.create(
            user=self.user,
            thread_id="thread-1",
            assistant_api_key=self.api_key,
        )

        response = self.client.patch(
            "/api/senpai/conversation/api-key/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, HTTP_OK)  # noqa: PT009
        conversation = SenpaiConversation.objects.get(user=self.user)
        self.assertEqual(conversation.assistant_api_key, self.api_key)  # noqa: PT009
        self.assertEqual(  # noqa: PT009
            response.data["conversation"]["assistant_api_key"]["id"],
            self.api_key.id,
        )

    def test_api_key_endpoint_null_clears_existing_assignment(self) -> None:
        """Passing assistant_api_key_id=null should explicitly clear the assignment."""
        SenpaiConversation.objects.create(
            user=self.user,
            thread_id="thread-1",
            assistant_api_key=self.api_key,
        )

        response = self.client.patch(
            "/api/senpai/conversation/api-key/",
            {"assistant_api_key_id": None},
            format="json",
        )

        self.assertEqual(response.status_code, HTTP_OK)  # noqa: PT009
        conversation = SenpaiConversation.objects.get(user=self.user)
        self.assertIsNone(conversation.assistant_api_key)  # noqa: PT009
        self.assertIsNone(response.data["conversation"]["assistant_api_key"])  # noqa: PT009
