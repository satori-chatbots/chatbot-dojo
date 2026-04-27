"""Tests for Senpai runtime environment configuration."""

import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, override_settings

from tester.senpai import (
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
