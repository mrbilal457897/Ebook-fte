"""The two tools this server exposes, and only these two.

specs/004-publishing-preflight/spec.md §3.1: both are read-only and neither
writes, submits, or reaches the network. A read-only pre-flight server cannot
become the thing that publishes — which is the entire point, given that no
submission API exists to call anyway (research.md).

Principle 6: no "get anything about publishing" tool. Two named operations,
each with a fixed vocabulary.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from platform_requirements.platforms import PLATFORMS, Rule, resolve_platform
from platform_requirements.validator import (
    UnsupportedPlatformError,
    platform_codes,
)
from platform_requirements.validator import (
    validate_package as _validate_package,
)

# TOOLS defined after function declarations


def _aspect_payload(
    name: str, description: str, rules: tuple[Rule, ...]
) -> dict[str, Any]:
    return {
        "aspect": name,
        "description": description,
        "rules": [r.as_dict() for r in rules],
    }


def lookup_platform_requirements(
    platform: str, aspect: str | None = None
) -> dict[str, Any]:
    """Authoritative publishing requirements for a platform, with sources.

    Use this whenever a question is about what a platform demands -- trim sizes,
    cover dimensions, keyword counts, file caps, ISBN rules, what happens after
    upload. Every rule comes back with the primary document it was read from and
    the date it was last checked, so you can tell the customer where the
    requirement comes from instead of asserting it.

    An unsupported platform returns an explicit error. It must never return an
    empty success, because that reads as "this platform has no requirements" and
    would let a package through unchecked.

    Args:
        platform: Platform code or common alias: kdp / amazon / kindle,
            apple_books / apple / itunes_connect, ingramspark / ingram.
        aspect: Optional group of rules. Omit for the full platform.

    Returns:
        The platform's submission model, the source document, and the rules.
    """
    resolved = resolve_platform(platform)
    if resolved is None:
        return {
            "error": "unsupported_platform",
            "requested": platform,
            "supported": platform_codes(),
            "message": (
                f"No authoritative requirements for {platform!r}. This server "
                f"covers: {', '.join(sorted(platform_codes()))}. Say so plainly "
                "rather than guessing — an invented trim size is worse than no "
                "answer."
            ),
        }

    aspects = resolved.aspects
    if aspect:
        found = resolved.aspect(aspect.strip().lower())
        if found is None:
            return {
                "error": "unknown_aspect",
                "requested": aspect,
                "available": [a.name for a in resolved.aspects],
                "message": (
                    f"{resolved.display_name} has no aspect {aspect!r}. "
                    f"Available: {', '.join(a.name for a in resolved.aspects)}."
                ),
            }
        aspects = (found,)

    return {
        "platform": resolved.code,
        "platform_name": resolved.display_name,
        "as_of": resolved.as_of,
        "source": resolved.source,
        "submission": resolved.submission_model,
        "aspects": [_aspect_payload(a.name, a.description, a.rules) for a in aspects],
    }


def validate_package(platform: str, package: dict[str, Any]) -> dict[str, Any]:
    """Check a declared submission package against a platform's requirements.

    Call this before telling a customer to go upload anything. It returns EVERY
    violation at once, not just the first, because the failure mode this prevents
    is an author fixing one error per upload.

    Pass the facts about the files, not the files themselves -- see `package`
    below for the field names each platform reads.

    The result separates three things that are easy to conflate:
      - `violations`  the package breaks these
      - `unchecked`   required-by-nobody fields that were not supplied; these
                      were NOT verified, and are not passes
      - `ok`          true only when violations is empty

    Args:
        platform: Platform code or alias, same vocabulary as above.
        package: Declared package facts. Valid keys come from
            `lookup_platform_requirements`; unrecognised keys are ignored.

    Returns:
        Violations with the rule and its source, the unchecked field list, and
        an explicit statement that validation was from declarations only.
    """
    try:
        return _validate_package(platform, package)
    except UnsupportedPlatformError as exc:
        return {
            "error": "unsupported_platform",
            "requested": exc.requested,
            "supported": exc.supported,
            "message": str(exc),
        }


TOOLS: tuple[Callable[..., Any], ...] = (lookup_platform_requirements, validate_package)


__all__ = ["PLATFORMS", "TOOLS", "lookup_platform_requirements", "validate_package"]
