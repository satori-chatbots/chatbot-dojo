"""Helpers for integrating Senpai Assistant into the backend."""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import TYPE_CHECKING
from uuid import uuid4

from django.conf import settings
from langchain.chat_models import init_chat_model

try:
    from senpai_assistant import create_assistant_for_paths
    from senpai_assistant.embeddings.get_embedding import MODEL_NAME, get_embedding
except ModuleNotFoundError:
    create_assistant_for_paths = None
    MODEL_NAME = None
    get_embedding = None

from tester.models import (
    CustomUser,
    SenpaiConversation,
    UserAPIKey,
    ensure_user_sensei_directory,
    get_user_sensei_root_path,
)

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from langchain_core.language_models.chat_models import BaseChatModel
    from senpai_assistant import Assistant


DEFAULT_ASSISTANT_MODELS = {
    "openai": ("gpt-4o-mini", "openai"),
    "gemini": ("gemini-2.5-flash", "google_genai"),
}


def _ensure_directory(path: Path) -> Path:
    """Create a directory tree if needed and return the normalized path."""
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_senpai_embedding_model_cache_root() -> Path:
    """Return the shared writable root for embedding model caches."""
    return _ensure_directory(Path(settings.SENPAI_EMBEDDING_MODEL_CACHE_ROOT))


def configure_embedding_model_environment(cache_root: Path) -> None:
    """Point Hugging Face, sentence-transformers, and Torch caches at a writable embedding cache root."""
    hf_home = _ensure_directory(cache_root / "huggingface")
    hub_cache = _ensure_directory(hf_home / "hub")
    transformers_cache = _ensure_directory(hf_home / "transformers")
    sentence_transformers_home = _ensure_directory(hf_home / "sentence-transformers")
    torch_home = _ensure_directory(cache_root / "torch")

    os.environ["HF_HOME"] = str(hf_home)
    os.environ["HF_HUB_CACHE"] = str(hub_cache)
    os.environ["HUGGINGFACE_HUB_CACHE"] = str(hub_cache)
    os.environ["TRANSFORMERS_CACHE"] = str(transformers_cache)
    os.environ["SENTENCE_TRANSFORMERS_HOME"] = str(sentence_transformers_home)
    os.environ["TORCH_HOME"] = str(torch_home)
    os.environ["HOME"] = str(cache_root)


def warmup_senpai_embedding_model() -> None:
    """Download and initialize Senpai's embedding model into the configured cache root."""
    embedding_cache_root = get_senpai_embedding_model_cache_root()
    configure_embedding_model_environment(embedding_cache_root)

    if MODEL_NAME is None or get_embedding is None:
        msg = (
            "Senpai Assistant is not installed in this backend environment. "
            "Rebuild the backend image so the new dependency is installed."
        )
        raise RuntimeError(msg)

    logger.info(
        "Warming up Senpai embedding model %s using cache root %s",
        MODEL_NAME,
        embedding_cache_root,
    )
    get_embedding("warmup")


def build_chat_model_for_user_api_key(api_key: UserAPIKey) -> BaseChatModel:
    """Build the assistant chat model using the selected stored API key."""
    provider_config = DEFAULT_ASSISTANT_MODELS.get(api_key.provider)
    if provider_config is None:
        msg = f"Unsupported assistant API key provider: {api_key.provider}"
        raise RuntimeError(msg)

    decrypted_api_key = api_key.get_api_key()
    if not decrypted_api_key:
        msg = "The selected assistant API key is empty."
        raise RuntimeError(msg)

    model_name, model_provider = provider_config
    return init_chat_model(
        model_name,
        model_provider=model_provider,
        api_key=decrypted_api_key,
        temperature=0.3,
    )


def get_senpai_runtime_root() -> Path:
    """Return the shared runtime root for Senpai artifacts."""
    runtime_root = Path(settings.SENPAI_ASSISTANT_RUNTIME_ROOT)
    runtime_root.mkdir(parents=True, exist_ok=True)
    return runtime_root


def get_user_senpai_path(user: CustomUser) -> Path:
    """Return the authenticated user's SENSEI root path, ensuring it exists."""
    user_root = ensure_user_sensei_directory(user.id)
    if user_root is None:
        msg = f"Unable to prepare SENSEI workspace for user {user.id}."
        raise RuntimeError(msg)
    return get_user_sensei_root_path(user.id)


def get_or_create_senpai_conversation(
    user: CustomUser,
    *,
    force_new: bool = False,
) -> tuple[SenpaiConversation, bool]:
    """Return the user's active Senpai conversation, optionally replacing it."""
    get_user_senpai_path(user)

    conversation = getattr(user, "senpai_conversation", None)
    if conversation is None:
        return (
            SenpaiConversation.objects.create(
                user=user,
                thread_id=uuid4().hex,
            ),
            True,
        )

    if force_new:
        conversation.thread_id = uuid4().hex
        conversation.save(update_fields=["thread_id", "updated_at"])
        return conversation, True

    return conversation, False


def build_assistant_for_conversation(conversation: SenpaiConversation) -> Assistant:
    """Create a Senpai assistant bound to the stored conversation thread."""
    if create_assistant_for_paths is None:
        msg = (
            "Senpai Assistant is not installed in this backend environment. "
            "Rebuild the backend image so the new dependency is installed."
        )
        raise RuntimeError(msg)

    user_path = get_user_senpai_path(conversation.user)
    runtime_root = get_senpai_runtime_root()
    embedding_model_cache_root = get_senpai_embedding_model_cache_root()
    configure_embedding_model_environment(embedding_model_cache_root)
    if conversation.assistant_api_key is None:
        msg = "No assistant API key is configured for this conversation."
        raise RuntimeError(msg)
    model = build_chat_model_for_user_api_key(conversation.assistant_api_key)

    logger.debug(
        (
            "Creating Senpai assistant for user_id=%s thread_id=%s "
            "user_path=%s runtime_root=%s embedding_model_cache_root=%s provider=%s"
        ),
        conversation.user_id,
        conversation.thread_id,
        user_path,
        runtime_root,
        embedding_model_cache_root,
        conversation.assistant_api_key.provider,
    )

    return create_assistant_for_paths(
        user_path=user_path,
        thread_id=conversation.thread_id,
        runtime_root=runtime_root,
        model=model,
        require_checkpointer=False,
    )
