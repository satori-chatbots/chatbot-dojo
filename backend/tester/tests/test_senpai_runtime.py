"""Tests for Senpai runtime environment configuration."""

import os
import tempfile
from pathlib import Path

from django.test import SimpleTestCase

from tester.senpai import configure_model_cache_environment


class SenpaiRuntimeTests(SimpleTestCase):
    """Verify Senpai runtime cache directories are configured under a writable root."""

    def test_configure_model_cache_environment_uses_runtime_root(self) -> None:
        """All relevant cache environment variables should be pointed at the runtime root."""
        with tempfile.TemporaryDirectory() as temp_dir:
            runtime_root = Path(temp_dir) / "senpai-runtime"

            configure_model_cache_environment(runtime_root)

            self.assertEqual(os.environ["HOME"], str(runtime_root))  # noqa: PT009
            self.assertEqual(os.environ["HF_HOME"], str(runtime_root / "huggingface"))  # noqa: PT009
            self.assertEqual(os.environ["HF_HUB_CACHE"], str(runtime_root / "huggingface" / "hub"))  # noqa: PT009
            self.assertEqual(  # noqa: PT009
                os.environ["HUGGINGFACE_HUB_CACHE"],
                str(runtime_root / "huggingface" / "hub"),
            )
            self.assertEqual(  # noqa: PT009
                os.environ["TRANSFORMERS_CACHE"],
                str(runtime_root / "huggingface" / "transformers"),
            )
            self.assertEqual(  # noqa: PT009
                os.environ["SENTENCE_TRANSFORMERS_HOME"],
                str(runtime_root / "huggingface" / "sentence-transformers"),
            )
            self.assertEqual(os.environ["TORCH_HOME"], str(runtime_root / "torch"))  # noqa: PT009

            self.assertTrue((runtime_root / "huggingface" / "hub").is_dir())  # noqa: PT009
            self.assertTrue((runtime_root / "huggingface" / "transformers").is_dir())  # noqa: PT009
            self.assertTrue((runtime_root / "huggingface" / "sentence-transformers").is_dir())  # noqa: PT009
            self.assertTrue((runtime_root / "torch").is_dir())  # noqa: PT009
