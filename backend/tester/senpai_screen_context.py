"""Backend-owned screen context enrichment for Senpai Assistant turns."""

from __future__ import annotations

from typing import Any

from django.contrib.auth import get_user_model

from tester.models import Project

User = get_user_model()

SENPAI_SCREEN_CONTEXT_FIELD_LIMIT = 24
LOW_VALUE_CONTEXT_KEYS = (
    "pathname",
    "screen_name",
    "context_type",
)


def enrich_senpai_screen_context(
    *,
    user: User,
    screen_context: dict[str, Any] | None,
    active_project_id: int | None,
) -> dict[str, Any] | None:
    """Return a compact, backend-authoritative context object for Senpai."""
    if screen_context is None:
        return None

    enriched = dict(screen_context)
    active_project = _get_owned_project(user, active_project_id)
    _add_common_project_context(enriched, active_project)

    return _fit_senpai_context_field_limit(enriched)


def _get_owned_project(user: User, active_project_id: int | None) -> Project | None:
    if active_project_id is None:
        return None
    return (
        Project.objects.select_related("chatbot_connector", "api_key").filter(id=active_project_id, owner=user).first()
    )


def _add_common_project_context(screen_context: dict[str, Any], project: Project | None) -> None:
    if project is None:
        if screen_context.get("has_active_project") is False:
            screen_context["active_project_exists"] = False
        return

    screen_context["active_project_exists"] = True
    screen_context["active_project_has_connector"] = project.chatbot_connector_id is not None
    screen_context["active_project_has_api_key"] = project.api_key_id is not None

    if project.chatbot_connector_id is not None:
        screen_context["active_project_connector_technology"] = project.chatbot_connector.technology


def _fit_senpai_context_field_limit(screen_context: dict[str, Any]) -> dict[str, Any]:
    """Drop redundant host fields first if enrichment reaches Senpai's field limit."""
    if len(screen_context) <= SENPAI_SCREEN_CONTEXT_FIELD_LIMIT:
        return screen_context

    compacted = dict(screen_context)
    for key in LOW_VALUE_CONTEXT_KEYS:
        if len(compacted) <= SENPAI_SCREEN_CONTEXT_FIELD_LIMIT:
            break
        compacted.pop(key, None)

    if len(compacted) <= SENPAI_SCREEN_CONTEXT_FIELD_LIMIT:
        return compacted

    return {key: compacted[key] for key in list(compacted)[:SENPAI_SCREEN_CONTEXT_FIELD_LIMIT]}
