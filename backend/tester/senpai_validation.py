"""Adapters for the shared Senpai validators package."""

from __future__ import annotations

from typing import Any, Literal

from senpai_validators import ValidationResult, validate_connector, validate_profile, validate_rule

ValidationKind = Literal["profile", "rule", "connector"]

VALIDATORS = {
    "profile": validate_profile,
    "rule": validate_rule,
    "connector": validate_connector,
}


def validate_yaml_content(content: str, kind: ValidationKind = "profile") -> ValidationResult:
    """Validate YAML content with the same validators used by Senpai."""
    return VALIDATORS[kind](content)


def format_validation_errors(result: ValidationResult) -> list[dict[str, Any]]:
    """Convert Senpai validation issues to the existing API error shape."""
    formatted: list[dict[str, Any]] = []

    for issue in result.invalid_items:
        messages = issue.errors or ["Validation failed."]
        formatted.extend(
            {
                "path": issue.field_path or issue.area or "/",
                "message": message,
                "line": issue.line,
                "column": issue.column,
                "error_class": issue.error_class,
                "error_code": issue.error_code,
                "repair_instruction": issue.repair_instruction,
            }
            for message in messages
        )

    if formatted:
        return formatted

    return [{"path": "/", "message": message, "line": None} for message in result.errors]


def validation_response_payload(result: ValidationResult) -> dict[str, Any]:
    """Return a serializable payload for validator results."""
    payload: dict[str, Any] = {
        "valid": result.is_valid,
        "errors": format_validation_errors(result),
        "warnings": list(result.warnings),
    }
    if result.is_valid:
        payload["data"] = result.data
    return payload
