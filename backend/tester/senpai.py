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
    Project,
    SenpaiConversation,
    TestFile,
    UserAPIKey,
    ensure_user_sensei_directory,
    get_project_relative_path,
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
YAML_EXTENSIONS = {".yaml", ".yml"}
_SENPAI_TOOL_RESOLUTION_PATCHED = False


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

    conversation, created = SenpaiConversation.objects.get_or_create(
        user=user,
        defaults={"thread_id": uuid4().hex},
    )

    if force_new:
        conversation.thread_id = uuid4().hex
        conversation.save(update_fields=["thread_id", "updated_at"])
        return conversation, True

    return conversation, created


def build_assistant_for_conversation(conversation: SenpaiConversation) -> Assistant:
    """Create a Senpai assistant bound to the stored conversation thread."""
    if conversation.assistant_api_key is None:
        msg = "No assistant API key is configured for this conversation."
        raise RuntimeError(msg)

    patch_senpai_tool_resolution()

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


def patch_senpai_tool_resolution() -> None:
    """Allow Senpai delete/read tools to resolve extensionless YAML profile names."""
    global _SENPAI_TOOL_RESOLUTION_PATCHED  # noqa: PLW0603
    if _SENPAI_TOOL_RESOLUTION_PATCHED:
        return

    try:
        from senpai_assistant.assistant import tools as senpai_tools
    except ModuleNotFoundError:
        return

    original_resolver = senpai_tools._resolve_project_yaml_target

    def resolve_project_yaml_target(
        project_root: Path, folder_name: str, filename: str
    ) -> tuple[Path | None, str | None]:
        target, error = original_resolver(project_root, folder_name, filename)
        if target is not None and target.exists():
            return target, error

        requested = Path(filename)
        if requested.suffix or requested.name in {"", ".", ".."}:
            return target, error

        normalized = requested.as_posix()
        normalized = normalized.removeprefix("./")

        candidates: list[Path] = []
        if "/" in normalized:
            workspace_root = senpai_tools._project_workspace_root(project_root)
            for extension in senpai_tools.YAML_EXTENSIONS:
                candidate = (workspace_root / f"{normalized}{extension}").resolve()
                try:
                    candidate.relative_to(workspace_root)
                except ValueError:
                    continue
                valid_folder_roots = [
                    (root / folder_name).resolve()
                    for root in senpai_tools._iter_project_roots(project_root)
                    if (root / folder_name).is_dir()
                ]
                if any(candidate.is_relative_to(folder_root) for folder_root in valid_folder_roots):
                    candidates.append(candidate)
        else:
            for root in senpai_tools._iter_project_roots(project_root):
                folder = root / folder_name
                if not folder.is_dir():
                    continue
                for extension in senpai_tools.YAML_EXTENSIONS:
                    candidates.extend(path.resolve() for path in folder.rglob(f"{requested.name}{extension}"))

        existing_candidates = [candidate for candidate in candidates if candidate.is_file()]
        if len(existing_candidates) > 1:
            joined = ", ".join(
                senpai_tools._relative_workspace_path(project_root, candidate) for candidate in existing_candidates
            )
            return None, f"Ambiguous filename: {filename}. Use one of: {joined}"
        if len(existing_candidates) == 1:
            return existing_candidates[0], None

        return target, error

    senpai_tools._resolve_project_yaml_target = resolve_project_yaml_target
    _SENPAI_TOOL_RESOLUTION_PATCHED = True


def sync_senpai_profile_files_to_test_files(user: CustomUser) -> None:
    """Register assistant-created project profile files as TestFile rows."""
    for project in Project.objects.filter(owner=user).iterator():
        profiles_root = Path(settings.MEDIA_ROOT) / get_project_relative_path(user.id, project.id, "profiles")
        existing_test_files = TestFile.objects.filter(project=project)
        if not profiles_root.is_dir():
            for test_file in existing_test_files:
                if not Path(test_file.file.path).exists():
                    test_file.delete()
            continue

        manual_execution = None
        profile_files = sorted(
            path for path in profiles_root.iterdir() if path.is_file() and path.suffix.lower() in YAML_EXTENSIONS
        )
        for profile_path in profile_files:
            relative_path = profile_path.relative_to(Path(settings.MEDIA_ROOT)).as_posix()
            test_file = TestFile.objects.filter(project=project, file=relative_path).first()

            if test_file is None:
                if manual_execution is None:
                    manual_execution = project.get_or_create_current_manual_execution()
                TestFile.objects.create(
                    file=relative_path,
                    name=profile_path.stem,
                    project=project,
                    execution=manual_execution,
                )
                continue

            test_file.save(update_execution_profile_count=False)

        manual_execution = manual_execution or project.profile_executions.filter(execution_type="manual").first()
        if manual_execution is not None:
            for test_file in TestFile.objects.filter(project=project, execution=manual_execution):
                if not Path(test_file.file.path).exists():
                    test_file.delete()
            manual_execution.generated_profiles_count = manual_execution.test_files.count()
            manual_execution.save(update_fields=["generated_profiles_count"])
