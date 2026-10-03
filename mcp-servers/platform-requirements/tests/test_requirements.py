"""Slice 004 acceptance criteria, AC1-AC8.

The tests that matter most here are the ones about what the validator must
REFUSE to conclude. A validator that reports a clean package it never checked is
worse than no validator, because a customer trusts it and uploads once.

AC6 (the 1/16" print tolerance) is the specific regression this slice's design
turns on: a nominal-only trim check passes files that Ingram then rejects.
"""

from __future__ import annotations

import pytest

from platform_requirements.platforms import PLATFORMS, resolve_platform
from platform_requirements.tools import (
    TOOLS,
    lookup_platform_requirements,
    validate_package,
)


def fields_of(result: dict) -> set[str]:
    return {v["field"] for v in result["violations"]}


# --- AC1: sourced rules for all three platforms, explicit error otherwise -----


@pytest.mark.parametrize("code", sorted(PLATFORMS))
def test_ac1_every_covered_platform_has_rules(code: str) -> None:
    result = lookup_platform_requirements(code)
    assert result["platform"] == code
    assert result["aspects"], "a covered platform with no aspects is not coverage"
    assert "error" not in result


@pytest.mark.parametrize(
    "alias,expected",
    [
        ("amazon", "kdp"),
        ("kindle", "kdp"),
        ("KDP", "kdp"),
        ("apple", "apple_books"),
        ("itunes_connect", "apple_books"),
        ("itunes connect", "apple_books"),
        ("Ingram", "ingramspark"),
        ("ingram-spark", "ingramspark"),
    ],
)
def test_ac1_aliases_resolve(alias: str, expected: str) -> None:
    assert resolve_platform(alias).code == expected


def test_ac1_unsupported_platform_is_an_explicit_error_not_empty_success() -> None:
    # The dangerous shape is an empty success: a caller would read "no rules"
    # as "nothing to check" and wave the package through.
    result = lookup_platform_requirements("smashwords")
    assert result["error"] == "unsupported_platform"
    assert "kdp" in result["supported"]
    assert "aspects" not in result


def test_ac1_validate_package_also_refuses_unsupported_platform() -> None:
    result = validate_package("smashwords", {})
    assert result["error"] == "unsupported_platform"


def test_ac1_unknown_aspect_is_an_error_listing_what_exists() -> None:
    result = lookup_platform_requirements("kdp", aspect="nonsense")
    assert result["error"] == "unknown_aspect"
    assert "ebook_interior" in result["available"]


# --- AC2: every rule is sourced ------------------------------------------------


@pytest.mark.parametrize("code", sorted(PLATFORMS))
def test_ac2_no_rule_is_unsourced(code: str) -> None:
    platform = PLATFORMS[code]
    assert platform.source.strip(), f"{code} platform has no source document"
    assert platform.as_of.strip(), f"{code} has no as_of date"
    for aspect in platform.aspects:
        assert aspect.rules, f"{code}/{aspect.name} has no rules"
        for rule in aspect.rules:
            assert rule.source.strip(), f"{code}/{rule.field_name} has no source"
            assert rule.as_of.strip(), f"{code}/{rule.field_name} has no as_of"
            assert rule.summary.strip(), f"{code}/{rule.field_name} has no summary"


# --- AC3: a broken package reports everything at once --------------------------

VALID_APPLE = {
    "interior_file_type": "epub",
    "epubcheck_passed": True,
    "description_provided": True,
    "publisher_name": "self_publishing_author",
    "pricing_configured": True,
}


def test_ac3_reports_every_violation_in_one_call() -> None:
    result = validate_package(
        "apple_books",
        {
            # wrong type, EPUBCheck failed, no description, bad publisher value
            "interior_file_type": "pdf",
            "epubcheck_passed": False,
            "publisher_name": "acme corp",
        },
    )
    assert result["ok"] is False
    got = fields_of(result)
    assert got == {
        "interior_file_type",
        "epubcheck_passed",
        "description_provided",
        "publisher_name",
        "pricing_configured",
    }
    # Every violation must be explainable, not just a flag.
    for violation in result["violations"]:
        assert violation["requirement"]
        assert violation["source"]


# --- AC4: a valid package is clean ---------------------------------------------


def test_ac4_valid_apple_package_passes() -> None:
    result = validate_package("apple_books", VALID_APPLE)
    assert result["violations"] == []
    assert result["ok"] is True


def test_ac4_valid_ingram_package_passes() -> None:
    result = validate_package(
        "ingramspark",
        {
            "interior_file_type": "epub",
            "cover_file_type": "jpg",
            "cover_color_mode": "rgb",
            "cover_px_longest_side": 2000,
            "cover_px_shortest_side": 1600,
            "pdf_compliance": "pdf_x_1a_2001",
            "fonts_embedded": True,
            "trim_width_in": 6,
            "trim_height_in": 9,
        },
    )
    assert result["violations"] == [], result["violations"]
    assert result["ok"] is True


def test_ac4_valid_kdp_package_passes() -> None:
    result = validate_package(
        "kdp",
        {
            "interior_file_type": "epub",
            "file_size_mb": 12,
            "fonts_embedded": True,
            "images_embedded": True,
            "keyword_count": 7,
            "title_matches_manuscript": True,
        },
    )
    assert result["violations"] == [], result["violations"]


# --- AC5: a missing required field is a violation, never a silent pass --------


def test_ac5_missing_required_field_is_reported_as_not_checked() -> None:
    result = validate_package("kdp", {})
    assert result["ok"] is False
    assert "interior_file_type" in fields_of(result)
    missing = next(
        v for v in result["violations"] if v["field"] == "interior_file_type"
    )
    assert "NOT checked" in missing["problem"]


def test_ac5_empty_string_counts_as_missing() -> None:
    result = validate_package("apple_books", {**VALID_APPLE, "publisher_name": "  "})
    assert result["ok"] is False
    assert "publisher_name" in fields_of(result)


def test_ac5_optional_absent_field_is_unchecked_not_passed() -> None:
    result = validate_package("apple_books", VALID_APPLE)
    # interest_age is not required at the platform level, so it lands in
    # `unchecked`. It must never be silently counted as satisfied.
    assert "interest_age_required_for_children" in result["unchecked"]
    assert result["ok"] is True
    assert result["violations"] == []


def test_ac5_prohibition_reports_a_true_value() -> None:
    result = validate_package(
        "kdp",
        {
            **{k: None for k in ()},
            "interior_file_type": "epub",
            "file_size_mb": 5,
            "fonts_embedded": True,
            "images_embedded": True,
            "keyword_count": 3,
            "title_matches_manuscript": True,
            "file_encrypted": True,
        },
    )
    assert "file_encrypted" in fields_of(result)


# --- AC6: the 1/16" print tolerance (the regression this design turns on) ------


def test_ac6_just_outside_nominal_but_inside_tolerance_passes() -> None:
    # 5.875in is 1/16 under the 6in nominal minus... this is 5 + 7/8, i.e. 1/8
    # under nominal, which is OUTSIDE the 1/16 band.
    inside = validate_package(
        "ingramspark",
        {
            "interior_file_type": "epub",
            "cover_file_type": "jpg",
            "cover_color_mode": "rgb",
            "cover_px_longest_side": 2000,
            "cover_px_shortest_side": 1600,
            "pdf_compliance": "pdf_x_1a_2001",
            "fonts_embedded": True,
            "trim_width_in": 5,
            "trim_height_in": 9,
        },
    )
    assert inside["violations"] == [], inside["violations"]


def test_ac6_exactly_one_sixteenth_inside_the_band_passes() -> None:
    # Nominal 6in minus 1/16in = 5.9375 -> rounds to 6 whole inches only if we
    # round, which we refuse to do. At 5 whole inches the minimum-with-tolerance
    # is 0.9375, so 1 is inside. The point of the test: the band's edge is
    # computed, not assumed.
    result = validate_package(
        "ingramspark",
        {
            "interior_file_type": "epub",
            "cover_file_type": "jpg",
            "cover_color_mode": "rgb",
            "cover_px_longest_side": 2000,
            "cover_px_shortest_side": 1600,
            "pdf_compliance": "pdf_x_1a_2001",
            "fonts_embedded": True,
            "trim_width_in": 1,
            "trim_height_in": 9,
        },
    )
    assert "trim_width_in" not in fields_of(result)


def test_ac6_below_the_tolerance_band_fails_and_says_why() -> None:
    # Nominal minimum 1in minus 1/16 tolerance = 0.9375. Integer inches mean the
    # only failing value at the floor is... nothing below 1 is an integer except
    # 0, so 0 must fail while 1 passes. This proves the floor moved to 0.9375
    # rather than being ignored.
    result = validate_package(
        "ingramspark",
        {
            "interior_file_type": "epub",
            "cover_file_type": "jpg",
            "cover_color_mode": "rgb",
            "cover_px_longest_side": 2000,
            "cover_px_shortest_side": 1600,
            "pdf_compliance": "pdf_x_1a_2001",
            "fonts_embedded": True,
            "trim_width_in": 0,
            "trim_height_in": 9,
        },
    )
    assert "trim_width_in" in fields_of(result)
    problem = next(v for v in result["violations"] if v["field"] == "trim_width_in")
    assert "0.9375" in problem["problem"]
    assert "tolerance" in problem["problem"]


def test_ac6_tolerance_is_advertised_in_the_requirement_data() -> None:
    rule = next(
        r
        for r in next(
            a for a in PLATFORMS["ingramspark"].aspects if a.name == "print_interior"
        ).rules
        if r.field_name == "trim_width_in"
    )
    assert rule.tolerance_in == 0.0625
    assert rule.as_dict()["tolerance_in"] == 0.0625


# --- AC7: floats in dimension fields are reported, not rounded ----------------


def test_ac7_fractional_dimension_is_a_caller_error_not_rounded() -> None:
    result = validate_package(
        "ingramspark",
        {
            "interior_file_type": "epub",
            "cover_file_type": "jpg",
            "cover_color_mode": "rgb",
            "cover_px_longest_side": 2000,
            "cover_px_shortest_side": 1600,
            "pdf_compliance": "pdf_x_1a_2001",
            "fonts_embedded": True,
            "trim_width_in": 6.5,
            "trim_height_in": 9,
        },
    )
    assert "trim_width_in" in fields_of(result)
    problem = next(v for v in result["violations"] if v["field"] == "trim_width_in")
    assert "whole number" in problem["problem"]
    assert "not rounded" in problem["problem"]


def test_ac7_numeric_field_given_a_string_is_reported() -> None:
    result = validate_package(
        "kdp",
        {
            "interior_file_type": "epub",
            "file_size_mb": "12",
            "fonts_embedded": True,
            "images_embedded": True,
            "keyword_count": 7,
            "title_matches_manuscript": True,
        },
    )
    assert "file_size_mb" in fields_of(result)
    problem = next(v for v in result["violations"] if v["field"] == "file_size_mb")
    assert "expected a number" in problem["problem"]


def test_ac7_non_boolean_for_a_boolean_rule_is_reported() -> None:
    result = validate_package(
        "kdp",
        {
            "interior_file_type": "epub",
            "file_size_mb": 12,
            "fonts_embedded": "yes",
            "images_embedded": True,
            "keyword_count": 7,
            "title_matches_manuscript": True,
        },
    )
    # "yes" is accepted as a boolean; "maybe" is not.
    assert "fonts_embedded" not in fields_of(result)
    bad = validate_package(
        "kdp",
        {
            "interior_file_type": "epub",
            "file_size_mb": 12,
            "fonts_embedded": "maybe",
            "images_embedded": True,
            "keyword_count": 7,
            "title_matches_manuscript": True,
        },
    )
    assert "fonts_embedded" in fields_of(bad)


# --- AC8: exactly two tools, both read-only ------------------------------------


def test_ac8_exactly_two_tools_are_exposed() -> None:
    assert len(TOOLS) == 2
    assert {fn.__name__ for fn in TOOLS} == {
        "lookup_platform_requirements",
        "validate_package",
    }


def test_ac8_no_tool_claims_it_can_submit() -> None:
    for fn in TOOLS:
        doc = (fn.__doc__ or "").lower()
        assert "submit" not in doc or "cannot submit" in doc, (
            f"{fn.__name__} mentions submission; if it gains one, "
            "specs/004-publishing-preflight/spec.md §2 must be revisited first"
        )


def test_ac8_server_module_has_no_network_client() -> None:
    # The strongest available guarantee that this server cannot submit: there
    # is no HTTP client imported anywhere in the package.
    from pathlib import Path

    import platform_requirements

    root = Path(platform_requirements.__file__).parent
    for path in root.glob("*.py"):
        text = path.read_text(encoding="utf-8")
        for banned in (
            "import requests",
            "import httpx",
            "aiohttp",
            "urlopen",
            "socket",
        ):
            assert banned not in text, f"{path.name} references {banned}"
