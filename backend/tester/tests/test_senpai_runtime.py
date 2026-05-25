"""Tests for Senpai runtime environment configuration."""

import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, TestCase, override_settings

from tester.models import CustomUser, SenpaiConversation, UserAPIKey
from tester.senpai import (
    build_assistant_for_conversation,
    build_chat_model_for_user_api_key,
    configure_embedding_model_environment,
    get_senpai_embedding_model_cache_root,
)


class StubAPIKey:
    """Small stub that matches the fields Senpai uses from UserAPIKey."""

    def __init__(self, provider: str, api_key_value: str) -> None:
        """Store the provider and returnable secret for the test double."""
        self.provider = provider
        self._secret = api_key_value

    def get_api_key(self) -> str:
        """Return the configured secret."""
        return self._secret


class SenpaiRuntimeTests(SimpleTestCase):
    """Verify Senpai runtime cache directories are configured under a writable root."""

    def test_configure_embedding_model_environment_uses_cache_root(self) -> None:
        """All relevant cache environment variables should be pointed at the embedding model cache root."""
        with tempfile.TemporaryDirectory() as temp_dir:
            cache_root = Path(temp_dir) / "senpai-embedding-model-cache"
            original_home = "/original-home"

            with patch.dict(os.environ, {"HOME": original_home}, clear=False):
                configure_embedding_model_environment(cache_root)

                self.assertEqual(os.environ["HOME"], original_home)  # noqa: PT009
                self.assertEqual(os.environ["HF_HOME"], str(cache_root / "huggingface"))  # noqa: PT009
                self.assertEqual(os.environ["HF_HUB_CACHE"], str(cache_root / "huggingface" / "hub"))  # noqa: PT009
                self.assertEqual(  # noqa: PT009
                    os.environ["HUGGINGFACE_HUB_CACHE"],
                    str(cache_root / "huggingface" / "hub"),
                )
                self.assertEqual(  # noqa: PT009
                    os.environ["TRANSFORMERS_CACHE"],
                    str(cache_root / "huggingface" / "transformers"),
                )
                self.assertEqual(  # noqa: PT009
                    os.environ["SENTENCE_TRANSFORMERS_HOME"],
                    str(cache_root / "huggingface" / "sentence-transformers"),
                )
                self.assertEqual(os.environ["TORCH_HOME"], str(cache_root / "torch"))  # noqa: PT009

            self.assertTrue((cache_root / "huggingface" / "hub").is_dir())  # noqa: PT009
            self.assertTrue((cache_root / "huggingface" / "transformers").is_dir())  # noqa: PT009
            self.assertTrue((cache_root / "huggingface" / "sentence-transformers").is_dir())  # noqa: PT009
            self.assertTrue((cache_root / "torch").is_dir())  # noqa: PT009

    def test_get_senpai_embedding_model_cache_root_uses_settings_override(self) -> None:
        """The embedding model cache root should come from Django settings."""
        with tempfile.TemporaryDirectory() as temp_dir:
            cache_root = Path(temp_dir) / "custom-embedding-model-cache"
            with override_settings(SENPAI_EMBEDDING_MODEL_CACHE_ROOT=cache_root):
                resolved = get_senpai_embedding_model_cache_root()

            self.assertEqual(resolved, cache_root)  # noqa: PT009
            self.assertTrue(cache_root.is_dir())  # noqa: PT009

    @patch("tester.senpai.init_chat_model")
    def test_build_chat_model_for_openai_key_uses_expected_defaults(self, init_chat_model_mock: MagicMock) -> None:
        """OpenAI assistant keys should map to the Senpai default OpenAI model."""
        build_chat_model_for_user_api_key(StubAPIKey(provider="openai", api_key_value="test-openai-key"))  # type: ignore[arg-type]

        init_chat_model_mock.assert_called_once_with(
            "gpt-4o-mini",
            model_provider="openai",
            api_key="test-openai-key",
            temperature=0.3,
        )

    @patch("tester.senpai.init_chat_model")
    def test_build_chat_model_for_gemini_key_uses_expected_defaults(self, init_chat_model_mock: MagicMock) -> None:
        """Gemini assistant keys should map to the Senpai default Gemini model."""
        build_chat_model_for_user_api_key(StubAPIKey(provider="gemini", api_key_value="test-gemini-key"))  # type: ignore[arg-type]

        init_chat_model_mock.assert_called_once_with(
            "gemini-2.5-flash",
            model_provider="google_genai",
            api_key="test-gemini-key",
            temperature=0.3,
        )


class SenpaiAssistantBuilderTests(TestCase):
    """Verify Chatbot Dojo wires Senpai Assistant construction options."""

    @patch("tester.senpai.build_chat_model_for_user_api_key")
    @patch("tester.senpai.create_assistant_for_paths")
    def test_build_assistant_for_conversation_passes_host_tools(
        self,
        create_assistant_mock: MagicMock,
        build_model_mock: MagicMock,
    ) -> None:
        """Chatbot Dojo runtime tools should be injected into Senpai Assistant."""
        with tempfile.TemporaryDirectory() as temp_dir:
            media_root = Path(temp_dir) / "filevault"
            runtime_root = Path(temp_dir) / "senpai-runtime"
            embedding_root = Path(temp_dir) / "embedding-cache"
            with override_settings(
                MEDIA_ROOT=media_root,
                SENPAI_ASSISTANT_RUNTIME_ROOT=runtime_root,
                SENPAI_EMBEDDING_MODEL_CACHE_ROOT=embedding_root,
            ):
                user = CustomUser.objects.create_user(email="owner@example.com")
                api_key = UserAPIKey.objects.create(
                    user=user,
                    name="Assistant key",
                    provider="openai",
                    api_key_encrypted="",
                )
                conversation = SenpaiConversation.objects.create(
                    user=user,
                    thread_id="thread-1",
                    assistant_api_key=api_key,
                )
                model = object()
                assistant = object()
                build_model_mock.return_value = model
                create_assistant_mock.return_value = assistant

                result = build_assistant_for_conversation(conversation)

        self.assertIs(result, assistant)  # noqa: PT009
        create_assistant_mock.assert_called_once()
        kwargs = create_assistant_mock.call_args.kwargs
        self.assertEqual(kwargs["thread_id"], "thread-1")  # noqa: PT009
        self.assertEqual(kwargs["model"], model)  # noqa: PT009
        self.assertFalse(kwargs["require_checkpointer"])  # noqa: PT009
        self.assertEqual(  # noqa: PT009
            {tool.name for tool in kwargs["host_tools"]},
            {
                "analyze_dashboard_execution_results",
                "get_active_backend_executions",
                "get_sensei_chat_execution_summary",
                "get_sensei_check_execution_summary",
                "get_tracer_execution_summary",
                "list_sensei_chat_executions",
                "list_sensei_check_executions",
                "list_tracer_executions",
                "start_sensei_chat_execution",
                "start_sensei_check_execution",
                "start_tracer_generation",
            },
        )
