---
name: epub-mobi-pdf-export
description: Runs the actual file conversion from a book's approved content and cover into EPUB, MOBI, or print-ready PDF format, applying reflowable-text rules for digital formats and fixed-layout rules for print PDF. Use once content and cover are both finalized and (for print) trim-size-calculator has already set the physical parameters. Do NOT use before content_versions is marked complete, and do NOT use to fix a content or cover problem discovered during export — flag that back rather than silently exporting a known-broken file.
---

## Steps
1. Confirm content is marked complete and a cover asset is selected;
   if either is missing, stop and report what's missing rather than
   exporting a partial or coverless file.
2. For EPUB/MOBI: apply reflowable formatting — chapter breaks, a
   generated table of contents, consistent heading hierarchy.
3. For print PDF: use the trim/bleed/margin/spine values already set by
   `trim-size-calculator`; do not recalculate them here.
4. Run `run_formatting_job`, then poll `get_formatting_job_status` until
   it resolves — never report success before status confirms it.
5. On failure (e.g. cover resolution too low for print), report the
   specific cause plainly so the right upstream agent (Cover Design,
   Content) can fix it, rather than retrying blindly.

## Edge cases
- A very short book (e.g. under 24 pages) may fail a print platform's
  minimum page count: catch this before running the job, not after a
  failed submission downstream at Publishing Advisor.