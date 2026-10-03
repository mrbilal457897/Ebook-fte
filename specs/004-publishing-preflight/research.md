# Slice 004 — Publishing pre-flight: research

**Date:** 2026-10-01
**Question this slice had to answer first:** can the agent submit a book to a
publishing platform itself, as AGENTS.md §2 originally promised?

## The answer is no, and that changes the slice

AGENTS.md §2 previously read:

> Publishing | Fully auto-publish using the *end-customer's own* platform
> credentials (KDP, Apple Books, IngramSpark) — agent submits, but the "go
> live" step requires explicit human approval

That was ratified on a premise that turns out to be false. **None of the three
named platforms has a public self-publisher submission API.** There are no
"platform credentials" to publish *through*, because there is no endpoint to
publish to.

### KDP

- Upload and publishing happen through the Bookshelf web UI. Amazon's KDP help
  pages describe a manual flow: open the book, choose "Edit eBook content",
  "Upload eBook manuscript", pick the file, wait for conversion.
- The KDP Forum answered the "is there a distribution Developer's API?"
  question directly and permanently: **"No."** That thread is ten years old and
  still the accurate answer.
- The only Amazon-side API in this space is the Product Advertising / Content
  API, and it is **read-only** — it returns sales and ranking data. It cannot
  accept a manuscript.
- Every third-party "KDP automation" project is **browser automation**, not API
  integration:
  - `auto-kdp` — "uses puppeteer to click through the KDP pages like a human
    would… just a monkey clicking for you."
  - `Amazon-KDP-Automater` — Puppeteer, PDF-only, no EPUB.
  - `no-hands-kdp` — Chrome DevTools Protocol; fills every field and saves a
    draft, and states plainly: **"Amazon's Publish button requires a human.
    Everything else is automated."** It also reports the category-cascade modal
    as "fragile".

  That last point matters beyond Amazon: these tools describe themselves as
  brittle against a UI that changes without notice. Browser automation here is
  not "an API we discovered late", it is a permanently breakable integration
  with a real ToS question attached.

### Apple Books

- Publishing is via the **Apple Books for Authors** web portal: "click Submit a
  New Book", provide the EPUB, cover, and sample, then complete pricing and
  clearances "in iTunes Connect".
- The portal requires an **iTunes Connect account**. Apple exposes Connect API
  surfaces for pricing/rights metadata, but the *book asset upload* is the
  portal form. There is no headless upload-and-publish endpoint for a
  self-published title.
- Apple's own guidance names the machine-readable check that matters:
  **every submission must pass the latest EPUBCheck.**

### IngramSpark

- A web portal. The public **File Creation Guide** is a PDF specification
  document, not an integration surface.
- Notably, Ingram does distribute to Apple, Amazon, Kobo and B&N itself — so
  for a customer who only wants ebook distribution, Ingram is a *distributor*,
  not a submission target. That is a different product question.

### What this means for the design

`submit_for_publishing` cannot be built against these three platforms. A tool
with that name would either be browser automation under a misleading name, or
it would be a tool that cannot do the thing it says — the exact failure the
previous commit removed from the three placeholder agents.

## What *is* buildable, and genuinely useful

The valuable, non-deferred part of publishing is everything **before** the
upload: knowing the platform's rules exactly, and checking the package against
them so the customer's single submission passes. Today the four skills that
depend on this (`trim-size-calculator`, `platform-metadata-mapper`,
`isbn-guidance`, `epub-mobi-pdf-export`) have no authoritative source at all —
they are prompt text. That is the gap worth closing, and it has no API
dependency.

Specific rules now sourced from primary documentation:

| Platform | Rule | Source |
|---|---|---|
| KDP | Manuscript upload is a web form; max file size 650 MB | KDP "Upload and Preview Book Content", "Save Your Manuscript File" |
| KDP | No crop/trim marks, bookmarks, comments, annotations or placeholder text; fonts and images embedded; files must not be locked or encrypted | KDP "Save Your Manuscript File" |
| KDP | Files are manually reviewed after submission | KDP "Save Your Manuscript File" |
| Apple Books | Submission must pass the latest EPUBCheck | Apple "Publish your book from the web" |
| Apple Books | EPUB + cover + sample via portal; pricing/clearances set in iTunes Connect; title can take up to 24h to appear in iTunes Connect | Apple "Publish your book from the web" |
| Apple Books | Interest Age is required for children/teenagers | Apple "Publish your book from the web" |
| IngramSpark | Print PDFs must be PDF/X-1a:2001 or PDF/X-3:2002 compliant | IngramSpark File Creation Guide |
| IngramSpark | All fonts must be embedded in interior **and** cover PDFs | IngramSpark File Creation Guide |
| IngramSpark | Ebook covers: JPG, RGB, ≤100 MB, min 1873 px longest side / 1600 px shortest side (350 dpi) | IngramSpark File Creation Guide |
| IngramSpark | Ebook interior: EPUB 3.0 required | IngramSpark File Creation Guide |
| IngramSpark | A 1/16" (0.0625 in / 2 mm) print variance is allowed on all books | IngramSpark File Creation Guide |
| IngramSpark | Logos/certification claims must be removed from bookblock and cover before submission | IngramSpark File Creation Guide |

The 1/16" print tolerance is worth calling out: it means a "correct" trim size
can still land outside tolerance through rounding, so a validator that only
checks nominal dimensions will pass files that get rejected.

## Explicitly out of scope for this slice

- **Byte-level file validation.** Running EPUBCheck or measuring a real PDF
  needs the actual artifact bytes, and the system of record has no artifact
  store — `cover_assets.image_ref` is a string reference and `formatting_jobs`
  records intent only. Validating *declared* package facts is possible now;
  validating *files* is a separate slice that starts with artifact storage.
- **Browser automation.** Different architecture, ToS exposure, brittle. Not
  built, not stubbed, not pretended.
- **Anything claiming to submit.**