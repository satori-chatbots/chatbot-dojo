"""Tests for Senpai runtime environment configuration."""

import os
import tempfile
from pathlib import Path

from django.test import SimpleTestCase, override_settings

from tester.senpai import configure_embedding_model_environment, get_senpai_embedding_model_cache_root


class SenpaiRuntimeTests(SimpleTestCase):
    """Verify Senpai runtime cache directories are configured under a writable root."""

    def test_configure_embedding_model_environment_uses_cache_root(self) -> None:
        """All relevant cache environment variables should be pointed at the embedding model cache root."""
        with tempfile.TemporaryDirectory() as temp_dir:
            cache_root = Path(temp_dir) / "senpai-embedding-model-cache"

            configure_embedding_model_environment(cache_root)

            self.assertEqual(os.environ["HOME"], str(cache_root))  # noqa: PT009
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
