"""Authoritative publishing-platform requirements.

Every rule here is transcribed from the platform's own primary documentation and
carries a `source`. Specs/004-publishing-preflight/spec.md §3.2 requires that
invariant: an unsourced rule is a test failure, not a style nit, because an
invented trim size is worse than no answer at all.

This module holds DATA, not logic, and deliberately no network access and no
model calls. If a rule here is wrong the fix is a correction against the cited
document — never an inference.

`as_of` is the date the rule was last checked against that document. These
platforms change their specs without announcement, so a stale rule is a known
failure mode and the date is part of the answer.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

RuleKind = Literal["limit", "enum", "required", "boolean"]


@dataclass(frozen=True)
class Rule:
    """One checkable requirement.

    `field_name` is the key the caller supplies in its declared package.
    """

    field_name: str
    kind: RuleKind
    summary: str
    source: str
    as_of: str
    # limit: inclusive maximum
    max_value: float | None = None
    min_value: float | None = None
    # enum / boolean: the permitted set
    allowed: tuple[str, ...] = ()
    # Number of inches of print tolerance the platform allows. IngramSpark
    # tolerates 1/16"; a nominal-only check passes files printing then rejects.
    tolerance_in: float | None = None
    units: str | None = None
    # True when the field must be present at all.
    required: bool = False
    # True when the answer is a prohibition ("must not contain X") rather than
    # a bound. Kept explicit so the wording is never softened by accident.
    prohibition: bool = False

    def as_dict(self) -> dict[str, object]:
        out: dict[str, object] = {
            "field": self.field_name,
            "kind": self.kind,
            "summary": self.summary,
            "source": self.source,
            "as_of": self.as_of,
        }
        if self.max_value is not None:
            out["max"] = self.max_value
        if self.min_value is not None:
            out["min"] = self.min_value
        if self.allowed:
            out["allowed"] = list(self.allowed)
        if self.tolerance_in is not None:
            out["tolerance_in"] = self.tolerance_in
        if self.units is not None:
            out["units"] = self.units
        if self.required:
            out["required"] = True
        if self.prohibition:
            out["prohibition"] = True
        return out


@dataclass(frozen=True)
class Aspect:
    """A named group of rules within a platform."""

    name: str
    description: str
    rules: tuple[Rule, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class Platform:
    code: str
    display_name: str
    # Stated once per platform and returned with every lookup, because it is the
    # single most important fact for the agent to not get wrong.
    submission_model: str
    source: str
    as_of: str
    aspects: tuple[Aspect, ...] = field(default_factory=tuple)

    def aspect(self, name: str) -> Aspect | None:
        for a in self.aspects:
            if a.name == name:
                return a
        return None


KDP_SOURCE = (
    "Amazon KDP help: 'Save Your Manuscript File' / 'Upload and Preview Book Content'"
)
APPLE_SOURCE = "Apple: 'Publish your book from the web' (Apple Books for Authors)"
INGRAM_SOURCE = "IngramSpark File Creation Guide (hubfs document, rev. 2026-08-24)"

WEB_PORTAL_ONLY = (
    "No public self-publisher submission API. The author uploads through the "
    "platform's web portal and presses publish; this system prepares and "
    "validates the package and cannot submit it."
)

AS_OF = "2026-10-01"

KDP = Platform(
    code="kdp",
    display_name="Amazon Kindle Direct Publishing",
    submission_model=WEB_PORTAL_ONLY,
    source=KDP_SOURCE,
    as_of=AS_OF,
    aspects=(
        Aspect(
            name="ebook_interior",
            description="Accepted manuscript formats and hard limits for an eBook.",
            rules=(
                Rule(
                    field_name="interior_file_type",
                    kind="enum",
                    allowed=("epub", "doc", "docx", "rtf", "html", "txt", "pdf"),
                    summary=(
                        "KDP converts these formats; EPUB is what the Online "
                        "Previewer supports for reflowable eBooks."
                    ),
                    source=KDP_SOURCE,
                    as_of=AS_OF,
                    required=True,
                ),
                Rule(
                    field_name="file_size_mb",
                    kind="limit",
                    max_value=650,
                    units="MB",
                    summary="Manuscript files over 650 MB fail to convert on upload.",
                    source=KDP_SOURCE,
                    as_of=AS_OF,
                    required=True,
                ),
                Rule(
                    field_name="pdf_required_for_bleed",
                    kind="boolean",
                    summary=(
                        "A PDF is required if the book has images or elements "
                        "bleeding to the page edge. Japanese, Hebrew, Latin and "
                        "Yiddish accept PDF only."
                    ),
                    source=KDP_SOURCE,
                    as_of=AS_OF,
                ),
            ),
        ),
        Aspect(
            name="file_hygiene",
            description="Content that causes a rejection at KDP's manual review.",
            rules=(
                Rule(
                    field_name="contains_printer_marks",
                    kind="boolean",
                    summary=(
                        "Submitted files must not contain crop marks, trim "
                        "marks, bookmarks, comments, invisible objects, "
                        "annotations or placeholder text. Printer's marks must "
                        "be disabled."
                    ),
                    source=KDP_SOURCE,
                    as_of=AS_OF,
                    prohibition=True,
                ),
                Rule(
                    field_name="file_encrypted",
                    kind="boolean",
                    summary="Do not lock or encrypt the file.",
                    source=KDP_SOURCE,
                    as_of=AS_OF,
                    prohibition=True,
                ),
                Rule(
                    field_name="fonts_embedded",
                    kind="boolean",
                    summary=(
                        "Embed all fonts in the native file. KDP recommends full "
                        "embedding over subsetting."
                    ),
                    source=KDP_SOURCE,
                    as_of=AS_OF,
                    required=True,
                ),
                Rule(
                    field_name="images_embedded",
                    kind="boolean",
                    summary="Embed all images in the native file before submission.",
                    source=KDP_SOURCE,
                    as_of=AS_OF,
                    required=True,
                ),
            ),
        ),
        Aspect(
            name="metadata",
            description="Book-detail requirements that must match the manuscript.",
            rules=(
                Rule(
                    field_name="keyword_count",
                    kind="limit",
                    max_value=7,
                    units="keywords",
                    summary=(
                        "KDP accepts 7 keyword slots for an eBook. Multi-word "
                        "phrases count as one keyword."
                    ),
                    source="Amazon KDP help: 'Entering Your Book Details'",
                    as_of=AS_OF,
                    required=True,
                ),
                Rule(
                    field_name="title_matches_manuscript",
                    kind="boolean",
                    summary=(
                        "Title, subtitle, author name, series information and "
                        "ISBN inside the manuscript file must match the details "
                        "entered at title setup."
                    ),
                    source="Amazon KDP help: 'Upload and Preview Book Content'",
                    as_of=AS_OF,
                    required=True,
                ),
                Rule(
                    field_name="language_matches_content",
                    kind="boolean",
                    summary=(
                        "The language selected on the eBook detail page must "
                        "match the manuscript's actual language; this is one of "
                        "the most common side-panel errors."
                    ),
                    source="Amazon KDP help: 'Upload and Preview Book Content'",
                    as_of=AS_OF,
                ),
            ),
        ),
        Aspect(
            name="review",
            description="What happens after upload.",
            rules=(
                Rule(
                    field_name="manual_review_required",
                    kind="boolean",
                    summary=(
                        "KDP manually checks the manuscript and cover after "
                        "submission. Files are not live on acceptance alone; "
                        "publishing is a separate action the author takes."
                    ),
                    source=KDP_SOURCE,
                    as_of=AS_OF,
                ),
            ),
        ),
    ),
)

APPLE_BOOKS = Platform(
    code="apple_books",
    display_name="Apple Books for Authors",
    submission_model=(
        "No public self-publisher book-upload API. The author uploads EPUB, "
        "cover and sample through the Apple Books for Authors portal (which "
        "requires an iTunes Connect account), then sets pricing and clearances "
        "in iTunes Connect."
    ),
    source=APPLE_SOURCE,
    as_of=AS_OF,
    aspects=(
        Aspect(
            name="ebook_interior",
            description="EPUB requirements for Apple Books.",
            rules=(
                Rule(
                    field_name="interior_file_type",
                    kind="enum",
                    allowed=("epub",),
                    summary=(
                        "Apple Books requires an EPUB; the authoring formats "
                        "(DOCX, Pages) must be exported to EPUB first."
                    ),
                    source=APPLE_SOURCE,
                    as_of=AS_OF,
                    required=True,
                ),
                Rule(
                    field_name="epubcheck_passed",
                    kind="boolean",
                    summary=(
                        "Every submission must pass the latest version of "
                        "EPUBCheck. This is Apple's machine-readable gate and "
                        "the single most common rejection cause."
                    ),
                    source=APPLE_SOURCE,
                    as_of=AS_OF,
                    required=True,
                ),
            ),
        ),
        Aspect(
            name="metadata",
            description="Book-detail requirements for the Apple Books record.",
            rules=(
                Rule(
                    field_name="description_provided",
                    kind="boolean",
                    summary=(
                        "Title, author name and a detailed description for the "
                        "product page are entered after upload."
                    ),
                    source=APPLE_SOURCE,
                    as_of=AS_OF,
                    required=True,
                ),
                Rule(
                    field_name="interest_age_required_for_children",
                    kind="boolean",
                    summary=(
                        "Interest Age is required for books intended for "
                        "children and teenagers, and must be set for those "
                        "titles."
                    ),
                    source=APPLE_SOURCE,
                    as_of=AS_OF,
                ),
                Rule(
                    field_name="explicit_content_flag",
                    kind="boolean",
                    summary=(
                        "Books containing explicit content must be flagged as "
                        "such on the record."
                    ),
                    source=APPLE_SOURCE,
                    as_of=AS_OF,
                ),
                Rule(
                    field_name="publisher_name",
                    kind="enum",
                    allowed=("publisher", "self_publishing_author"),
                    summary=(
                        "Enter the publisher name, or — if self-publishing — "
                        "the author's first and last name."
                    ),
                    source=APPLE_SOURCE,
                    as_of=AS_OF,
                    required=True,
                ),
                Rule(
                    field_name="original_publication_date",
                    kind="boolean",
                    summary=(
                        "If the book was first published on another platform, "
                        "its original publication date must be given. If never "
                        "published, Apple uses the Apple Books release date."
                    ),
                    source=APPLE_SOURCE,
                    as_of=AS_OF,
                ),
            ),
        ),
        Aspect(
            name="pricing",
            description="Pricing and availability are set separately from upload.",
            rules=(
                Rule(
                    field_name="pricing_configured",
                    kind="boolean",
                    summary=(
                        "The book is NOT purchasable until pricing and "
                        "availability are set in iTunes Connect after the "
                        "title imports."
                    ),
                    source=APPLE_SOURCE,
                    as_of=AS_OF,
                    required=True,
                ),
                Rule(
                    field_name="hours_until_visible_in_connect",
                    kind="limit",
                    max_value=24,
                    units="hours",
                    summary="A book can take up to 24 hours to appear in iTunes Connect.",
                    source=APPLE_SOURCE,
                    as_of=AS_OF,
                ),
            ),
        ),
    ),
)

INGRAMSPARK = Platform(
    code="ingramspark",
    display_name="IngramSpark",
    submission_model=(
        "No public self-publisher submission API; the author uploads through "
        "the IngramSpark web portal. Note Ingram is also a distributor to "
        "Amazon, Apple, Kobo and B&N, so an ebook-only author may need only "
        "one submission here rather than one per retailer."
    ),
    source=INGRAM_SOURCE,
    as_of=AS_OF,
    aspects=(
        Aspect(
            name="ebook_interior",
            description="EPUB distribution requirements.",
            rules=(
                Rule(
                    field_name="interior_file_type",
                    kind="enum",
                    allowed=("epub",),
                    summary="EPUB 3.0 is required for ebook distribution.",
                    source=INGRAM_SOURCE,
                    as_of=AS_OF,
                    required=True,
                ),
            ),
        ),
        Aspect(
            name="ebook_cover",
            description="Front-cover requirements for ebook distribution.",
            rules=(
                Rule(
                    field_name="cover_file_type",
                    kind="enum",
                    allowed=("jpg", "jpeg"),
                    summary="The ebook cover must be a .JPG file.",
                    source=INGRAM_SOURCE,
                    as_of=AS_OF,
                    required=True,
                ),
                Rule(
                    field_name="cover_file_size_mb",
                    kind="limit",
                    max_value=100,
                    units="MB",
                    summary="Ebook cover must be 100 MB or less.",
                    source=INGRAM_SOURCE,
                    as_of=AS_OF,
                ),
                Rule(
                    field_name="cover_color_mode",
                    kind="enum",
                    allowed=("rgb",),
                    summary="All front covers must be RGB.",
                    source=INGRAM_SOURCE,
                    as_of=AS_OF,
                    required=True,
                ),
                Rule(
                    field_name="cover_px_longest_side",
                    kind="limit",
                    min_value=1873,
                    units="px",
                    summary="Minimum 1873 pixels along the longest side.",
                    source=INGRAM_SOURCE,
                    as_of=AS_OF,
                    required=True,
                ),
                Rule(
                    field_name="cover_px_shortest_side",
                    kind="limit",
                    min_value=1600,
                    units="px",
                    summary="Minimum 1600 pixels on the shortest side (350 dpi).",
                    source=INGRAM_SOURCE,
                    as_of=AS_OF,
                    required=True,
                ),
            ),
        ),
        Aspect(
            name="print_interior",
            description="Print-ready PDF requirements.",
            rules=(
                Rule(
                    field_name="pdf_compliance",
                    kind="enum",
                    allowed=("pdf_x_1a_2001", "pdf_x_3_2002"),
                    summary="Print PDFs must be PDF/X-1a:2001 or PDF/X-3:2002 compliant.",
                    source=INGRAM_SOURCE,
                    as_of=AS_OF,
                    required=True,
                ),
                Rule(
                    field_name="fonts_embedded",
                    kind="boolean",
                    summary=(
                        "All fonts must be embedded in every PDF — interior and "
                        "cover, colour and black-and-white."
                    ),
                    source=INGRAM_SOURCE,
                    as_of=AS_OF,
                    required=True,
                ),
                Rule(
                    field_name="trim_width_in",
                    kind="limit",
                    min_value=1,
                    units="in",
                    summary="Interior trim width, subject to Ingram's print tolerance.",
                    source=INGRAM_SOURCE,
                    as_of=AS_OF,
                    required=True,
                    tolerance_in=0.0625,
                ),
                Rule(
                    field_name="trim_height_in",
                    kind="limit",
                    min_value=1,
                    units="in",
                    summary="Interior trim height, subject to Ingram's print tolerance.",
                    source=INGRAM_SOURCE,
                    as_of=AS_OF,
                    required=True,
                    tolerance_in=0.0625,
                ),
            ),
        ),
        Aspect(
            name="content_hygiene",
            description="Content that must be removed before submission.",
            rules=(
                Rule(
                    field_name="contains_logo_or_certification",
                    kind="boolean",
                    summary=(
                        "A logo, initial, or any claim of certification must be "
                        "removed from the bookblock and cover. Ingram will remove "
                        "it at the publisher's expense if left in."
                    ),
                    source=INGRAM_SOURCE,
                    as_of=AS_OF,
                    prohibition=True,
                ),
            ),
        ),
        Aspect(
            name="editorial",
            description="What Ingram will not do for you.",
            rules=(
                Rule(
                    field_name="expects_editorially_finished",
                    kind="boolean",
                    summary=(
                        "Ingram performs no editorial work: no proofreading, "
                        "editing, typesetting or font alteration."
                    ),
                    source=INGRAM_SOURCE,
                    as_of=AS_OF,
                ),
            ),
        ),
    ),
)

PLATFORMS: dict[str, Platform] = {p.code: p for p in (KDP, APPLE_BOOKS, INGRAMSPARK)}

# Aliases so an agent that says "amazon" or "apple" resolves rather than
# getting an unsupported_platform error for a platform we do cover.
ALIASES: dict[str, str] = {
    "amazon": "kdp",
    "kindle": "kdp",
    "kdp": "kdp",
    "apple": "apple_books",
    "applebooks": "apple_books",
    "apple_books": "apple_books",
    "itunes": "apple_books",
    "itunes_connect": "apple_books",
    "ingram": "ingramspark",
    "ingram_spark": "ingramspark",
    "ingramspark": "ingramspark",
    "draft2digital": "draft2digital",
}


def platform_codes() -> list[str]:
    """The platform codes this server has authoritative data for."""
    return list(PLATFORMS)


def resolve_platform(raw: str) -> Platform | None:
    """Map a caller-supplied platform string to a platform we actually cover.

    Returns None for anything unsupported, which callers must surface as an
    explicit error. Silently returning "no requirements" for a platform we do
    not cover is the worst possible answer: a caller would read it as "this
    package is fine".
    """
    key = (raw or "").strip().lower().replace(" ", "_").replace("-", "_")
    code = ALIASES.get(key)
    return PLATFORMS.get(code) if code else None
