---
name: trim-size-calculator
description: Determines the correct trim size, margins, bleed, and spine width for a book given its target platform (KDP, IngramSpark, Apple Books), page count, and paper type (for print) or device targets (for digital). Use when a formatting job is starting and these physical/layout parameters haven't been set yet, or when the customer changes page count/platform after formatting was already done once. Do NOT use for digital-only EPUB/MOBI jobs with no print component — those don't need trim/bleed/spine at all, only epub-mobi-pdf-export's reflowable-format rules apply.
---

## Steps
1. Confirm whether this job includes a print output at all — if it's
   EPUB/MOBI only, stop here and hand off to `epub-mobi-pdf-export`.
2. Look up the target platform's accepted trim sizes via
   `lookup_platform_requirements` (shared with Publishing Advisor Agent).
3. Calculate spine width from page count and paper type using the
   platform's published formula — do not estimate; if the formula isn't
   available for a platform, say so rather than guessing a number that
   will fail print QA.
4. Set bleed and margin values accordingly, erring toward the platform's
   safe-margin recommendation over the minimum allowed.
5. Pass the resolved parameters to the actual export step.

## Edge cases
- Extremely short or long page counts near a platform's binding limits:
  flag this explicitly to the customer rather than silently rounding
  page count to fit — a book that's technically bindable but at the
  edge often needs the customer to know before they commit to a size.