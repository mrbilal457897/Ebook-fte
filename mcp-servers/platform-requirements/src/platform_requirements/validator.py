"""Package pre-flight validation.

Two behaviours here exist specifically to stop a validator lying:

1. **An absent field is `unknown`, never a pass.** Silently skipping what it
   cannot check is how a validator reports a clean package it never looked at.
   A required field that is missing is a violation.

2. **All violations are returned at once.** Reporting only the first error
   produces exactly the one-error-per-upload loop this slice exists to remove.

Every violation carries the rule id, the requirement's own wording, and the
source document, so the Publishing Advisor can explain *why* instead of asserting.
"""

from __future__ import annotations

from typing import Any

from platform_requirements.platforms import (
    Rule,
    platform_codes,
    resolve_platform,
)

# Field names are snake_case; a caller that sends camelCase or a typo would
# otherwise be silently treated as "absent" — which, per the note above, means
# silently treated as unchecked.
_TRUE_STRINGS = frozenset({"true", "yes", "y", "1"})
_FALSE_STRINGS = frozenset({"false", "no", "n", "0"})


class UnsupportedPlatformError(ValueError):
    """Raised for a platform this server has no authoritative data for."""

    def __init__(self, requested: str, supported: list[str]) -> None:
        super().__init__(
            f"No authoritative requirements for {requested!r}. "
            f"This server covers: {', '.join(sorted(supported))}."
        )
        self.requested = requested
        self.supported = supported


def _violation(rule: Rule, problem: str, value: Any) -> dict[str, Any]:
    return {
        "field": rule.field_name,
        "problem": problem,
        "requirement": rule.summary,
        "source": rule.source,
        "as_of": rule.as_of,
        "value": value,
    }


def _coerce_bool(rule: Rule, raw: Any) -> bool | None:
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, str):
        lowered = raw.strip().lower()
        if lowered in _TRUE_STRINGS:
            return True
        if lowered in _FALSE_STRINGS:
            return False
    return None


def _tolerance_note(tolerance: float) -> str:
    if tolerance:
        return f', including {tolerance:g}" print tolerance'
    return ""


def _too_high(rule: Rule, tolerance: float) -> str:
    units = rule.units or ""
    return (
        f"maximum is {rule.max_value + tolerance:g}{units}{_tolerance_note(tolerance)}"
    )


def _too_low(rule: Rule, tolerance: float) -> str:
    units = rule.units or ""
    return (
        f"minimum is {rule.min_value - tolerance:g}{units}{_tolerance_note(tolerance)}"
    )


def _check_rule(rule: Rule, raw: Any) -> list[dict[str, Any]]:
    """Evaluate one rule against one supplied value.

    Returns a list because a single field can breach a rule in more than one way
    (a 700 MB file that is also the wrong format is two different problems, and
    the author needs to hear both).
    """
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        if rule.required:
            return [
                _violation(
                    rule,
                    "required field was not supplied, so this requirement was NOT checked",
                    None,
                )
            ]
        # Not required and not supplied: genuinely not applicable. Reported
        # separately from a pass by the caller so it is never counted as one.
        return []

    out: list[dict[str, Any]] = []

    if rule.kind == "boolean":
        as_bool = _coerce_bool(rule, raw)
        if as_bool is None:
            return [
                _violation(
                    rule,
                    f"expected a yes/no value, got {type(raw).__name__}",
                    raw,
                )
            ]
        if rule.prohibition and as_bool:
            out.append(_violation(rule, "this breaks a platform prohibition", raw))
        elif not rule.prohibition and rule.required and not as_bool:
            out.append(_violation(rule, "this is required by the platform", raw))
        return out

    if rule.kind == "enum":
        value = raw.strip().lower() if isinstance(raw, str) else raw
        if value not in rule.allowed:
            out.append(
                _violation(rule, f"must be one of {', '.join(rule.allowed)}", raw)
            )
        return out

    if rule.kind == "limit":
        if isinstance(raw, bool) or not isinstance(raw, (int, float)):
            out.append(
                _violation(rule, f"expected a number, got {type(raw).__name__}", raw)
            )
            return out
        if isinstance(raw, float) and not raw.is_integer():
            # Rounding a dimension would be inventing a number the customer
            # never gave us, and for a 1/16" tolerance it is exactly the kind of
            # rounding that decides a pass or a rejection.
            out.append(
                _violation(
                    rule,
                    "must be a whole number of "
                    f"{rule.units or 'units'}; not rounded on your behalf",
                    raw,
                )
            )
            return out
        # With a print tolerance, the comparison has to be against the band, not
        # the nominal value: Ingram allows 1/16" variance on all books, so a
        # file 1/32" over nominal still prints and a file 1/8" over does not.
        tolerance = rule.tolerance_in or 0
        if rule.max_value is not None and raw > rule.max_value + tolerance:
            out.append(_violation(rule, _too_high(rule, tolerance), raw))
        if rule.min_value is not None and raw < rule.min_value - tolerance:
            out.append(_violation(rule, _too_low(rule, tolerance), raw))
        return out

    return out


def validate_package(platform_code: str, package: dict[str, Any]) -> dict[str, Any]:
    """Check a declared package against one platform's rules.

    `package` holds the facts the customer declared about their files — not file
    bytes. See specs/004-publishing-preflight/spec.md §2: byte-level validation
    (EPUBCheck, PDF/X conformance) needs an artifact store that does not exist
    yet, so this slice validates what can be validated from declarations and
    says so in the result.
    """
    platform = resolve_platform(platform_code)
    if platform is None:
        raise UnsupportedPlatformError(platform_code, platform_codes())

    if not isinstance(package, dict):
        return {
            "platform": platform.code,
            "ok": False,
            "violations": [
                {
                    "field": "(package)",
                    "problem": "expected an object of declared package facts",
                    "requirement": "package must be an object",
                    "source": platform.source,
                    "as_of": platform.as_of,
                    "value": type(package).__name__,
                }
            ],
            "unchecked": [],
            "rules_evaluated": 0,
            "validated_from_declarations_only": True,
            "submission": platform.submission_model,
        }

    violations: list[dict[str, Any]] = []
    unchecked: list[str] = []
    evaluated = 0

    for aspect in platform.aspects:
        for rule in aspect.rules:
            evaluated += 1
            raw = package.get(rule.field_name)
            if raw is None and not rule.required:
                unchecked.append(rule.field_name)
            violations.extend(_check_rule(rule, raw))

    return {
        "platform": platform.code,
        "platform_name": platform.display_name,
        "ok": not violations,
        "violations": violations,
        # Explicitly separated from "passed": an unchecked field is not a pass.
        "unchecked": sorted(set(unchecked)),
        "rules_evaluated": evaluated,
        "validated_from_declarations_only": True,
        "limitations": [
            (
                "Validated from the facts supplied in the package, not from the files "
                "themselves. A package can pass this and still be rejected for "
                "something only a real EPUBCheck run or PDF/X conformance check sees."
            ),
        ],
        "submission": platform.submission_model,
        "as_of": platform.as_of,
    }
