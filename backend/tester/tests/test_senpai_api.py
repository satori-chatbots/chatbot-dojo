"""Tests for the Senpai Assistant API."""

import shutil
import tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from django.core.files.base import ContentFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from tester.models import (
    ChatbotConnector,
    CustomUser,
    ProfileExecution,
    Project,
    RuleFile,
    SenpaiConversation,
    SenseiCheckRule,
    TestFile,
    UserAPIKey,
    get_connector_export_relative_path,
    get_project_relative_path,
)
from tester.senpai import (
    SenpaiWorkspaceSnapshot,
    get_or_create_senpai_conversation,
    sync_database_records_to_senpai_workspace,
    sync_senpai_profile_files_to_test_files,
    sync_senpai_workspace_to_database,
)

HTTP_CREATED = 201
HTTP_OK = 200
HTTP_NO_CONTENT = 204
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
        self.assertEqual(response.data["pending_approvals"], [])  # noqa: PT009
        self.assertEqual(SenpaiConversation.objects.filter(user=self.user).count(), 1)  # noqa: PT009

        build_assistant_mock.assert_called_once_with(conversation)
        assistant.send_message.assert_called_once_with("Hello", active_project=None)
        assistant.close.assert_called_once()

    @patch("tester.api.senpai.build_assistant_for_conversation")
    def test_send_message_returns_pending_approvals(self, build_assistant_mock: MagicMock) -> None:
        """HITL interrupts should be returned so the client can resolve them."""
        SenpaiConversation.objects.create(
            user=self.user,
            thread_id="thread-1",
            assistant_api_key=self.api_key,
        )
        assistant = MagicMock()
        assistant.send_message.return_value = "Please review this change."
        assistant.get_pending_interrupts.return_value = [
            SimpleNamespace(
                id="approval-1",
                value={
                    "action_requests": [
                        {
                            "name": "save_profile",
                            "description": "Profile save request",
                        },
                    ],
                    "review_configs": [
                        {
                            "action_name": "save_profile",
                            "allowed_decisions": ["approve", "reject"],
                        },
                    ],
                },
            ),
        ]
        build_assistant_mock.return_value = assistant

        response = self.client.post(
            "/api/senpai/conversation/message/",
            {"message": "Create a profile"},
            format="json",
        )

        self.assertEqual(response.status_code, HTTP_OK)  # noqa: PT009
        self.assertEqual(response.data["response"], "Please review this change.")  # noqa: PT009
        self.assertEqual(response.data["pending_approvals"][0]["id"], "approval-1")  # noqa: PT009
        self.assertEqual(  # noqa: PT009
            response.data["pending_approvals"][0]["value"]["action_requests"][0]["name"],
            "save_profile",
        )

    @patch("tester.api.senpai.build_assistant_for_conversation")
    def test_message_endpoint_resumes_pending_approvals(self, build_assistant_mock: MagicMock) -> None:
        """Approval decisions should resume the blocked assistant thread."""
        SenpaiConversation.objects.create(
            user=self.user,
            thread_id="thread-1",
            assistant_api_key=self.api_key,
        )
        assistant = MagicMock()
        assistant.resume_pending_interrupts.return_value = "Saved."
        assistant.get_pending_interrupts.return_value = []
        build_assistant_mock.return_value = assistant

        response = self.client.post(
            "/api/senpai/conversation/message/",
            {"approval_decisions": [{"type": "approve"}]},
            format="json",
        )

        self.assertEqual(response.status_code, HTTP_OK)  # noqa: PT009
        self.assertEqual(response.data["response"], "Saved.")  # noqa: PT009
        self.assertEqual(response.data["pending_approvals"], [])  # noqa: PT009
        assistant.resume_pending_interrupts.assert_called_once_with([{"type": "approve"}])
        assistant.send_message.assert_not_called()

    @patch("tester.api.senpai.build_assistant_for_conversation")
    def test_message_endpoint_registers_assistant_saved_profiles(self, build_assistant_mock: MagicMock) -> None:
        """Profiles written directly by Senpai should become visible in the Test Center."""
        SenpaiConversation.objects.create(
            user=self.user,
            thread_id="thread-1",
            assistant_api_key=self.api_key,
        )
        connector = ChatbotConnector.objects.create(
            name="Primary Connector",
            technology="taskyto",
            owner=self.user,
        )
        project = Project.objects.create(
            name="Checkout QA",
            chatbot_connector=connector,
            owner=self.user,
        )
        profile_path = self.media_root / get_project_relative_path(
            self.user.id,
            project.id,
            "profiles",
            "assistant_profile.yaml",
        )
        profile_path.parent.mkdir(parents=True, exist_ok=True)
        profile_path.write_text(
            (Path(__file__).resolve().parents[1] / "templates" / "yaml" / "default.yaml").read_text(
                encoding="utf-8",
            ),
            encoding="utf-8",
        )
        assistant = MagicMock()
        assistant.resume_pending_interrupts.return_value = "Saved."
        assistant.get_pending_interrupts.return_value = []
        build_assistant_mock.return_value = assistant

        response = self.client.post(
            "/api/senpai/conversation/message/",
            {"approval_decisions": [{"type": "approve"}]},
            format="json",
        )

        self.assertEqual(response.status_code, HTTP_OK)  # noqa: PT009
        registered_file = TestFile.objects.get(project=project)
        self.assertEqual(registered_file.name, "assistant_profile")  # noqa: PT009
        manual_execution = ProfileExecution.objects.get(project=project, execution_type="manual")
        self.assertEqual(manual_execution.generated_profiles_count, 1)  # noqa: PT009

    def test_sync_removes_deleted_assistant_profiles(self) -> None:
        """Profiles removed by Senpai should also disappear from Test Center data."""
        connector = ChatbotConnector.objects.create(
            name="Primary Connector",
            technology="taskyto",
            owner=self.user,
        )
        project = Project.objects.create(
            name="Checkout QA",
            chatbot_connector=connector,
            owner=self.user,
        )
        profile_path = self.media_root / get_project_relative_path(
            self.user.id,
            project.id,
            "profiles",
            "assistant_profile.yaml",
        )
        profile_path.parent.mkdir(parents=True, exist_ok=True)
        profile_path.write_text("test_name: assistant_profile\n", encoding="utf-8")

        sync_senpai_profile_files_to_test_files(self.user)
        self.assertEqual(TestFile.objects.filter(project=project).count(), 1)  # noqa: PT009

        profile_path.unlink()
        sync_senpai_profile_files_to_test_files(self.user)

        self.assertEqual(TestFile.objects.filter(project=project).count(), 0)  # noqa: PT009
        manual_execution = ProfileExecution.objects.get(project=project, execution_type="manual")
        self.assertEqual(manual_execution.generated_profiles_count, 0)  # noqa: PT009

    def test_sync_removes_deleted_assistant_project(self) -> None:
        """Projects removed from Senpai's workspace should disappear from the dashboard."""
        connector = ChatbotConnector.objects.create(
            name="Primary Connector",
            technology="taskyto",
            owner=self.user,
        )
        project = Project.objects.create(
            name="Checkout QA",
            chatbot_connector=connector,
            owner=self.user,
        )
        project_path = Path(project.get_project_path())
        project_path.mkdir(parents=True, exist_ok=True)

        snapshot = sync_database_records_to_senpai_workspace(self.user)
        shutil.rmtree(project_path)
        sync_senpai_workspace_to_database(self.user, snapshot)

        self.assertFalse(Project.objects.filter(pk=project.pk).exists())  # noqa: PT009

    def test_sync_regenerates_deleted_connector_export(self) -> None:
        """Missing connector exports should be regenerated instead of deleting DB rows."""
        connector = ChatbotConnector.objects.create(
            name="Primary Connector",
            technology="taskyto",
            owner=self.user,
        )

        snapshot = sync_database_records_to_senpai_workspace(self.user)
        export_path = self.media_root / get_connector_export_relative_path(self.user.id, connector.id)
        self.assertTrue(export_path.exists())  # noqa: PT009

        export_path.unlink()
        sync_senpai_workspace_to_database(self.user, snapshot)

        self.assertTrue(ChatbotConnector.objects.filter(pk=connector.pk).exists())  # noqa: PT009
        self.assertTrue(export_path.exists())  # noqa: PT009

    def test_sync_removes_connector_when_custom_config_is_deleted(self) -> None:
        """A deleted custom config file is authoritative enough to remove the connector row."""
        connector = ChatbotConnector(
            name="Custom Connector",
            technology="custom",
            owner=self.user,
        )
        connector.custom_config_file.save(
            "custom-connector.yaml",
            ContentFile("endpoint: https://example.com/custom\n"),
            save=True,
        )

        snapshot = sync_database_records_to_senpai_workspace(self.user)
        Path(connector.custom_config_file.path).unlink()
        sync_senpai_workspace_to_database(self.user, snapshot)

        self.assertFalse(ChatbotConnector.objects.filter(pk=connector.pk).exists())  # noqa: PT009

    def test_sync_removes_rule_rows_when_assistant_deletes_rule_files(self) -> None:
        """Rule rows should not outlive YAML files deleted by the assistant."""
        connector = ChatbotConnector.objects.create(
            name="Primary Connector",
            technology="taskyto",
            owner=self.user,
        )
        project = Project.objects.create(
            name="Checkout QA",
            chatbot_connector=connector,
            owner=self.user,
        )
        Path(project.get_project_path()).mkdir(parents=True, exist_ok=True)
        rule_file = RuleFile(project=project)
        rule_file.file.save("rule.yaml", ContentFile("name: rule\n"), save=True)
        sensei_rule = SenseiCheckRule(project=project)
        sensei_rule.file.save("sensei-rule.yaml", ContentFile("name: sensei_rule\n"), save=True)

        snapshot = sync_database_records_to_senpai_workspace(self.user)
        Path(rule_file.file.path).unlink()
        Path(sensei_rule.file.path).unlink()
        sync_senpai_workspace_to_database(self.user, snapshot)

        self.assertFalse(RuleFile.objects.filter(pk=rule_file.pk).exists())  # noqa: PT009
        self.assertFalse(SenseiCheckRule.objects.filter(pk=sensei_rule.pk).exists())  # noqa: PT009

    def test_failed_connector_presync_does_not_delete_connector(self) -> None:
        """An export write failure must not be treated as an assistant delete."""
        connector = ChatbotConnector.objects.create(
            name="Primary Connector",
            technology="taskyto",
            owner=self.user,
        )

        with (
            patch("tester.senpai.sync_connector_export_file", side_effect=OSError("disk full")),
            pytest.raises(RuntimeError),
        ):
            sync_database_records_to_senpai_workspace(self.user)

        self.assertTrue(ChatbotConnector.objects.filter(pk=connector.pk).exists())  # noqa: PT009

    def test_missing_project_before_presync_is_not_deleted(self) -> None:
        """A project directory missing before an assistant turn should not be inferred as an assistant delete."""
        connector = ChatbotConnector.objects.create(
            name="Primary Connector",
            technology="taskyto",
            owner=self.user,
        )
        project = Project.objects.create(
            name="Checkout QA",
            chatbot_connector=connector,
            owner=self.user,
        )
        self.assertFalse(Path(project.get_project_path()).exists())  # noqa: PT009

        snapshot = sync_database_records_to_senpai_workspace(self.user)
        sync_senpai_workspace_to_database(self.user, snapshot)

        self.assertTrue(Project.objects.filter(pk=project.pk).exists())  # noqa: PT009

    def test_workspace_inspection_error_does_not_delete_project(self) -> None:
        """Temporary workspace access failures must not be inferred as assistant deletes."""
        connector = ChatbotConnector.objects.create(
            name="Primary Connector",
            technology="taskyto",
            owner=self.user,
        )
        project = Project.objects.create(
            name="Checkout QA",
            chatbot_connector=connector,
            owner=self.user,
        )
        snapshot = SenpaiWorkspaceSnapshot(
            connector_ids=set(),
            project_ids={project.id},
            test_file_ids=set(),
            rule_file_ids=set(),
            sensei_check_rule_ids=set(),
        )

        with (
            patch("tester.senpai._path_exists_for_sync", side_effect=RuntimeError("storage unavailable")),
            pytest.raises(RuntimeError),
        ):
            sync_senpai_workspace_to_database(self.user, snapshot)

        self.assertTrue(Project.objects.filter(pk=project.pk).exists())  # noqa: PT009

    def test_project_delete_endpoint_deletes_database_row(self) -> None:
        """The project dashboard delete endpoint should remove the project row."""
        connector = ChatbotConnector.objects.create(
            name="Primary Connector",
            technology="taskyto",
            owner=self.user,
        )
        project = Project.objects.create(
            name="Checkout QA",
            chatbot_connector=connector,
            owner=self.user,
        )
        Path(project.get_project_path()).mkdir(parents=True, exist_ok=True)

        response = self.client.delete(f"/api/projects/{project.id}/")

        self.assertEqual(response.status_code, HTTP_NO_CONTENT)  # noqa: PT009
        self.assertFalse(Project.objects.filter(pk=project.pk).exists())  # noqa: PT009

    def test_connector_delete_endpoint_deletes_database_row(self) -> None:
        """The connector settings delete endpoint should remove the connector row."""
        connector = ChatbotConnector.objects.create(
            name="Primary Connector",
            technology="taskyto",
            owner=self.user,
        )

        response = self.client.delete(f"/api/chatbotconnectors/{connector.id}/")

        self.assertEqual(response.status_code, HTTP_NO_CONTENT)  # noqa: PT009
        self.assertFalse(ChatbotConnector.objects.filter(pk=connector.pk).exists())  # noqa: PT009

    def test_api_key_delete_endpoint_deletes_database_row(self) -> None:
        """The profile API-key delete endpoint should remove the API key row."""
        api_key = UserAPIKey.objects.create(
            user=self.user,
            name="Secondary OpenAI Key",
            provider="openai",
            api_key_encrypted="",
        )
        api_key.set_api_key("sk-secondary")

        response = self.client.delete(f"/api/api-keys/{api_key.id}/")

        self.assertEqual(response.status_code, HTTP_NO_CONTENT)  # noqa: PT009
        self.assertFalse(UserAPIKey.objects.filter(pk=api_key.pk).exists())  # noqa: PT009

    @patch("tester.api.senpai.build_assistant_for_conversation")
    def test_send_message_passes_active_project_to_assistant(self, build_assistant_mock: MagicMock) -> None:
        """Sending a message should pass the selected host project as run-scoped context."""
        SenpaiConversation.objects.create(
            user=self.user,
            thread_id="thread-1",
            assistant_api_key=self.api_key,
        )
        connector = ChatbotConnector.objects.create(
            name="Primary Connector",
            technology="taskyto",
            owner=self.user,
        )
        project = Project.objects.create(
            name="Checkout QA",
            chatbot_connector=connector,
            owner=self.user,
        )
        assistant = MagicMock()
        assistant.send_message.return_value = "Hello from Senpai"
        build_assistant_mock.return_value = assistant

        response = self.client.post(
            "/api/senpai/conversation/message/",
            {"message": "Hello", "active_project_id": project.id},
            format="json",
        )

        self.assertEqual(response.status_code, HTTP_OK)  # noqa: PT009
        assistant.send_message.assert_called_once_with(
            "Hello",
            active_project=project.get_project_folder_name(),
        )

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
