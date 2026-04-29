"""Helpers for integrating Senpai Assistant into the backend."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Protocol
from uuid import uuid4

from django.conf import settings
from langchain.chat_models import init_chat_model

try:
    from senpai_assistant import create_assistant_for_paths
    from senpai_assistant.assistant import tools as senpai_tools
    from senpai_assistant.embeddings.get_embedding import MODEL_NAME, get_embedding
except ModuleNotFoundError:
    create_assistant_for_paths = None
    senpai_tools = None
    MODEL_NAME = None
    get_embedding = None

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
    ensure_user_sensei_directory,
    get_connector_export_relative_path,
    get_project_relative_path,
    get_user_sensei_root_path,
    sync_connector_export_file,
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


@dataclass(frozen=True)
class SenpaiWorkspaceSnapshot:
    """DB-backed files that existed before an assistant turn."""

    connector_ids: set[int]
    project_ids: set[int]
    test_file_ids: set[int]
    rule_file_ids: set[int]
    sensei_check_rule_ids: set[int]


class YamlTargetResolver(Protocol):
    """Callable signature for Senpai's YAML target resolver."""

    def __call__(self, project_root: Path, folder_name: str, filename: str) -> tuple[Path | None, str | None]:
        """Resolve a project YAML target."""


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
    if _SENPAI_TOOL_RESOLUTION_PATCHED or senpai_tools is None:
        return

    original_resolver = senpai_tools._resolve_project_yaml_target  # noqa: SLF001
    senpai_tools._resolve_project_yaml_target = _build_extensionless_yaml_resolver(original_resolver)  # noqa: SLF001
    _SENPAI_TOOL_RESOLUTION_PATCHED = True


def _build_extensionless_yaml_resolver(original_resolver: YamlTargetResolver) -> YamlTargetResolver:
    """Build a Senpai YAML resolver that retries extensionless names with YAML suffixes."""

    def resolve_project_yaml_target(
        project_root: Path, folder_name: str, filename: str
    ) -> tuple[Path | None, str | None]:
        target, error = original_resolver(project_root, folder_name, filename)
        if target is not None and target.exists():
            return target, error

        requested = Path(filename)
        if requested.suffix or requested.name in {"", ".", ".."}:
            return target, error

        candidates = _find_extensionless_yaml_candidates(
            project_root,
            folder_name,
            requested.as_posix().removeprefix("./"),
        )
        if len(candidates) > 1:
            return None, _ambiguous_extensionless_yaml_error(project_root, filename, candidates)
        if len(candidates) == 1:
            return candidates[0], None

        return target, error

    return resolve_project_yaml_target


def _find_extensionless_yaml_candidates(project_root: Path, folder_name: str, normalized: str) -> list[Path]:
    """Return existing YAML files matching an extensionless profile/rule path."""
    if senpai_tools is None:
        return []
    if "/" in normalized:
        return _find_relative_extensionless_yaml_candidates(project_root, folder_name, normalized)
    return _find_basename_extensionless_yaml_candidates(project_root, folder_name, normalized)


def _find_relative_extensionless_yaml_candidates(project_root: Path, folder_name: str, normalized: str) -> list[Path]:
    """Resolve extensionless project-relative YAML candidates."""
    if senpai_tools is None:
        return []

    workspace_root = senpai_tools._project_workspace_root(project_root)  # noqa: SLF001
    folder_roots = [
        (root / folder_name).resolve()
        for root in senpai_tools._iter_project_roots(project_root)  # noqa: SLF001
        if (root / folder_name).is_dir()
    ]
    return [
        candidate
        for candidate in ((workspace_root / f"{normalized}{extension}").resolve() for extension in YAML_EXTENSIONS)
        if candidate.is_file()
        and _is_relative_to(candidate, workspace_root)
        and any(candidate.is_relative_to(folder_root) for folder_root in folder_roots)
    ]


def _find_basename_extensionless_yaml_candidates(
    project_root: Path, folder_name: str, filename_stem: str
) -> list[Path]:
    """Resolve extensionless basename YAML candidates across project folders."""
    if senpai_tools is None:
        return []

    candidates: list[Path] = []
    for root in senpai_tools._iter_project_roots(project_root):  # noqa: SLF001
        folder = root / folder_name
        if folder.is_dir():
            for extension in YAML_EXTENSIONS:
                candidates.extend(path.resolve() for path in folder.rglob(f"{filename_stem}{extension}"))
    return [candidate for candidate in candidates if candidate.is_file()]


def _ambiguous_extensionless_yaml_error(project_root: Path, filename: str, candidates: list[Path]) -> str:
    """Return a Senpai-style ambiguity message for extensionless YAML matches."""
    joined = ", ".join(_format_project_workspace_path(project_root, candidate) for candidate in candidates)
    return f"Ambiguous filename: {filename}. Use one of: {joined}"


def _format_project_workspace_path(project_root: Path, target: Path) -> str:
    """Return a stable path for a file inside Senpai's project workspace."""
    workspace_root = project_root / "projects" if (project_root / "projects").is_dir() else project_root
    workspace_root = workspace_root.resolve()
    target = target.resolve()

    if ((workspace_root / "profiles").is_dir() or (workspace_root / "rules").is_dir()) and target.parent.name in {
        "profiles",
        "rules",
    }:
        return target.name

    try:
        return target.relative_to(workspace_root).as_posix()
    except ValueError:
        return target.name


def _is_relative_to(path: Path, parent: Path) -> bool:
    """Return whether path is within parent without raising on mismatch."""
    try:
        path.relative_to(parent)
    except ValueError:
        return False
    return True


def _path_exists_for_sync(path: Path) -> bool:
    """Return path existence, treating filesystem access errors as sync failures."""
    try:
        path.stat()
    except FileNotFoundError:
        return False
    except OSError as exc:
        msg = f"Unable to inspect Senpai workspace path: {path}"
        raise RuntimeError(msg) from exc
    return True


def sync_database_records_to_senpai_workspace(user: CustomUser) -> SenpaiWorkspaceSnapshot:
    """Ensure DB-backed assistant-visible files exist before Senpai runs."""
    connector_ids = set()
    media_root = Path(settings.MEDIA_ROOT)
    for connector in ChatbotConnector.objects.filter(owner=user).iterator():
        try:
            sync_connector_export_file(connector)
        except (OSError, RuntimeError) as exc:
            logger.exception("Failed to prepare connector export for connector %s", connector.pk)
            msg = "Unable to prepare connector workspace files for Senpai."
            raise RuntimeError(msg) from exc
        export_path = media_root / get_connector_export_relative_path(user.id, connector.id)
        if _path_exists_for_sync(export_path):
            connector_ids.add(connector.id)

    projects = Project.objects.filter(owner=user)
    return SenpaiWorkspaceSnapshot(
        connector_ids=connector_ids,
        project_ids={project.id for project in projects if _path_exists_for_sync(Path(project.get_project_path()))},
        test_file_ids={
            test_file.id
            for test_file in TestFile.objects.filter(project__in=projects)
            if _path_exists_for_sync(Path(test_file.file.path))
        },
        rule_file_ids={
            rule_file.id
            for rule_file in RuleFile.objects.filter(project__in=projects)
            if _path_exists_for_sync(Path(rule_file.file.path))
        },
        sensei_check_rule_ids={
            rule.id
            for rule in SenseiCheckRule.objects.filter(project__in=projects)
            if _path_exists_for_sync(Path(rule.file.path))
        },
    )


def sync_senpai_workspace_to_database(user: CustomUser, snapshot: SenpaiWorkspaceSnapshot) -> None:
    """Reflect assistant filesystem deletes back into database records."""
    _delete_missing_senpai_connectors(user, snapshot)
    _delete_missing_senpai_projects(user, snapshot)
    sync_senpai_profile_files_to_test_files(user, snapshot=snapshot)
    _delete_missing_senpai_rule_files(user, snapshot)


def sync_senpai_profile_files_to_test_files(user: CustomUser, snapshot: SenpaiWorkspaceSnapshot | None = None) -> None:
    """Register assistant-created project profile files as TestFile rows."""
    for project in Project.objects.filter(owner=user).iterator():
        _sync_project_senpai_profile_files(user, project, snapshot=snapshot)


def _sync_project_senpai_profile_files(
    user: CustomUser, project: Project, snapshot: SenpaiWorkspaceSnapshot | None = None
) -> None:
    """Synchronize assistant-created profile files for one project."""
    profiles_root = Path(settings.MEDIA_ROOT) / get_project_relative_path(user.id, project.id, "profiles")
    if profiles_root.is_dir():
        _register_existing_senpai_profile_files(project, profiles_root)
    _delete_missing_project_test_files(project, snapshot=snapshot)
    _update_manual_execution_profile_count(project)


def _register_existing_senpai_profile_files(project: Project, profiles_root: Path) -> None:
    """Create missing TestFile rows for profile YAML files that exist on disk."""
    manual_execution: ProfileExecution | None = None
    for profile_path in _iter_profile_yaml_files(profiles_root):
        relative_path = profile_path.relative_to(Path(settings.MEDIA_ROOT)).as_posix()
        test_file = TestFile.objects.filter(project=project, file=relative_path).first()
        if test_file is None:
            manual_execution = manual_execution or project.get_or_create_current_manual_execution()
            TestFile.objects.create(
                file=relative_path,
                name=profile_path.stem,
                project=project,
                execution=manual_execution,
            )
        else:
            test_file.save(update_execution_profile_count=False)


def _iter_profile_yaml_files(profiles_root: Path) -> list[Path]:
    """Return sorted profile YAML files directly under a profile directory."""
    return sorted(path for path in profiles_root.iterdir() if path.is_file() and path.suffix.lower() in YAML_EXTENSIONS)


def _delete_missing_project_test_files(project: Project, snapshot: SenpaiWorkspaceSnapshot | None = None) -> None:
    """Delete TestFile rows whose profile file no longer exists on disk."""
    for test_file in TestFile.objects.filter(project=project):
        if snapshot is not None and test_file.id not in snapshot.test_file_ids:
            continue
        if not _path_exists_for_sync(Path(test_file.file.path)):
            test_file.delete()


def _delete_missing_senpai_projects(user: CustomUser, snapshot: SenpaiWorkspaceSnapshot) -> None:
    """Delete projects whose assistant-visible project directory was removed."""
    for project in Project.objects.filter(owner=user, id__in=snapshot.project_ids).iterator():
        if not _path_exists_for_sync(Path(project.get_project_path())):
            logger.info("Deleting project %s because its Senpai workspace directory is missing", project.pk)
            project.delete()


def _delete_missing_senpai_connectors(user: CustomUser, snapshot: SenpaiWorkspaceSnapshot) -> None:
    """Delete connectors whose assistant-visible connector files were removed."""
    media_root = Path(settings.MEDIA_ROOT)
    for connector in ChatbotConnector.objects.filter(owner=user, id__in=snapshot.connector_ids).iterator():
        export_path = media_root / get_connector_export_relative_path(user.id, connector.id)
        custom_config_missing = (
            bool(connector.custom_config_file)
            and not _path_exists_for_sync(Path(connector.custom_config_file.path))
        )
        if not _path_exists_for_sync(export_path) or custom_config_missing:
            logger.info("Deleting connector %s because its Senpai workspace file is missing", connector.pk)
            connector.delete()


def _delete_missing_senpai_rule_files(user: CustomUser, snapshot: SenpaiWorkspaceSnapshot) -> None:
    """Delete rule DB rows whose assistant-visible YAML files were removed."""
    projects = Project.objects.filter(owner=user)
    for rule_file in RuleFile.objects.filter(project__in=projects, id__in=snapshot.rule_file_ids):
        if not _path_exists_for_sync(Path(rule_file.file.path)):
            rule_file.delete()
    for sensei_rule in SenseiCheckRule.objects.filter(project__in=projects, id__in=snapshot.sensei_check_rule_ids):
        if not _path_exists_for_sync(Path(sensei_rule.file.path)):
            sensei_rule.delete()


def _update_manual_execution_profile_count(project: Project) -> None:
    """Refresh the manual execution profile count after filesystem sync."""
    manual_execution = project.profile_executions.filter(execution_type="manual").first()
    if manual_execution is None:
        return

    manual_execution.generated_profiles_count = manual_execution.test_files.count()
    manual_execution.save(update_fields=["generated_profiles_count"])
