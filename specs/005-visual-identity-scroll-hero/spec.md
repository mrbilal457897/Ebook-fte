# Slice 005 - Visual identity + scroll-book hero (spec)

**Date:** 2026-10-03 (Part II — landing structure — added same day, after
Checkpoint 2; see §6 onward)
**Supersedes:** nothing. **Constrains:** AGENTS.md §2 (Next.js 15 App Router),
constitution Article VI (GSAP-driven motion) and Article II (spec before code).
**Governing Skill:** `.claude/skills/ebook-fte-design-system/SKILL.md` — this
slice updates that Skill's token block rather than creating a parallel set of
tokens.

Part I (§1–§5) covers tokens, typography, theming and the hero. Part II (§6–§15)
covers the marketing landing page structure that consumes them.

## 1. Goal

Give the product an "official e-book" identity instead of generic-SaaS
placeholders, and add one signature scroll-driven moment on the marketing page
that a stranger cannot mistake for a template.

Concretely:

1. Replace the placeholder brand palette with paper-and-ink tokens — deep ink
   base, warm cream, exactly one gold accent — plus a light theme.
2. Load a real serif/sans pair through `next/font`, replacing the current
   situation where the declared families are never loaded and everything
   renders in `system-ui`.
3. Build a pinned, scrubbed hero where a book turns pages in response to scroll
   position and settles open.
4. Update the governing Skill so the next session inherits these decisions
   instead of re-asking them.

## 2. Non-goals

- **No motion in the product's daily surfaces.** The generate screen, settings
  and sign-in keep entrance/stagger only. A heavy animated hero in a dashboard a
  customer opens daily gets old fast and costs scroll performance.
- **No new runtime dependency.** ScrollTrigger ships inside the already-pinned
  `gsap@3.15.0`.
- **No Tailwind, no CSS-in-JS, no CSS Modules.** The product styles itself with
  global classes in `globals.css`; this slice follows that convention.
- **No image assets and no bitmap book art.** The book is CSS/SVG so the
  interaction stays original and diff-able.
- **No layout rebuild.** Spacing scale, font-size scale and motion tokens are
  unchanged. Only colour and font-family tokens change.
- **No `prefers-color-scheme` auto-switching.** Dark is the default; light is a
  deliberate choice.
- **No rebuilding the semantic palette.** Dark-theme success/warning/danger keep
  their exact values (see §3.3 for the one necessary light-theme deviation).

## 3. Shape

### 3.1 Tokens

One file: `frontend/app/globals.css`. Dark in `:root`, light in
`:root[data-theme="light"]`. Spacing, type scale, leading and motion tokens are
byte-identical to what they are now.

**Dark (default)** — ink navy base, warm cream, one gold accent:

```css
:root {
  --color-ink: #121821;            /* canonical "ink" primitive */
  --color-bg: var(--color-ink);
  --color-surface: #1A212C;
  --color-surface-raised: #222B38;
  --color-border: #455163;         /* decorative hairlines only */
  --color-border-strong: #5D6A7D;  /* 3.2:1 - control boundaries */
  --color-paper: #F3EBDC;          /* cream; theme-independent */
  --color-paper-edge: #E4D8C3;
  --color-text: #EFE7D6;
  --color-text-muted: #A8A79E;
  --color-accent: #C2A15A;         /* the one accent */
  --color-accent-hover: #C9A961;
  --color-accent-ink: #12181F;     /* text ON an accent fill */
  --color-accent-deep: #7A5F17;    /* accent on paper */
  --color-success: #34d399;        /* unchanged */
  --color-warning: #fbbf24;        /* unchanged */
  --color-danger: #f87171;         /* unchanged */
}
```

**Light** — warm paper base: `--color-bg: #EAE2D2`, `--color-surface: #F5EFE3`,
`--color-surface-raised: #FBF7EF`, `--color-text: #1B222B`,
`--color-text-muted: #5C5648`, `--color-border: #D8CDB7`,
`--color-border-strong: #8C7C5C`, `--color-accent: #6B5314`,
`--color-accent-hover: #7A5F17`, `--color-accent-ink: #FBF7EF`.

`--color-ink`, `--color-paper`, `--color-paper-edge` and `--color-accent-deep`
are **not** overridden: they describe a physical object (a book), not a surface,
so they must not invert when the UI does.

Note `--color-bg` is darker than `--color-surface` in **both** themes, which is
what keeps the existing inset pattern (`.stream-panel`, `.field-input`) correct
without modification.

### 3.2 Accent-role discipline

Four tokens because the accent does two jobs. The rule that matters:

- `--color-accent` — the accent, used as text, border, fill, focus ring. Safe as
  text *and* as a fill in both themes.
- `--color-accent-ink` — **must** be used for any text or icon on an accent
  fill. Gold-on-gold is 1.4:1; this is the token that prevents it.
- `--color-accent-deep` — accent on `--color-paper` only.
- **Gold never encodes status.** Status uses the semantic tokens, full stop.

### 3.3 The one deviation, and why it is not optional

Dark-theme semantic values are unchanged. The light theme declares its own
steps of the same hues, because the dark values measure 1.37–2.27:1 on a cream
background — a "Live" badge at 1.58:1 is invisible. Light steps:
`--color-success: #157347`, `--color-warning: #8A5A08`,
`--color-danger: #B3261E`, all above 4.5:1 on both light surfaces.

Semantic *meaning* never changes with theme. Only the step does.

### 3.4 In-progress status moves off the accent

`.status-dot.is-working` and `.allowance-pill.is-working .dot` currently use
`--color-primary`, which under the new palette means gold. They move to
`--color-warning`. This is the Skill's existing "colored by meaning not
decoration" rule finally being applied to the one place that violated it.

### 3.5 Typography

```tsx
const literata = Literata({ subsets: ["latin"], display: "swap", variable: "--font-literata" })
const inter    = Inter({    subsets: ["latin"], display: "swap", variable: "--font-inter" })
```

```css
--font-display: var(--font-literata), Georgia, "Times New Roman", serif;
--font-body:    var(--font-inter), ui-sans-serif, system-ui, sans-serif;
```

The unused Geist pair is dropped from `layout.tsx` — it shipped weight the
bundle did not use.

### 3.6 Theme switching

`components/theme/theme-toggle.tsx`, rendered once in `app/layout.tsx` as a
fixed corner control so it is reachable from every page including the writing
screen. 40px hit target, visible focus ring, `aria-pressed`.

No flash: a small inline script in `<head>` reads `localStorage` and sets
`document.documentElement.dataset.theme` before first paint. The toggle then
only updates that attribute. `prefers-color-scheme` is **not** consulted — see
§2.

### 3.7 The hero

> **Superseded 2026-10-08 by Part IV (§25).** The pinned scroll-book described
> below is retired; the hero's visual is now a tilt/float book with no pin and
> no scrub. This section is kept as the record of what Part I built.

`components/landing/scroll-book-hero.tsx`. Only `landing.tsx` imports it. One
GSAP timeline, `pin: true`, `scrub: 0.8`, `end: "+=500%"`.

Narrative beats, each roughly a fixed scroll distance so pacing is intentional:

| Beat | Scroll | Motion |
|---|---|---|
| 0 — closed book | ~1 viewport | cover tilts `-8deg → -22deg`, page-block edge appears |
| 1 — cover reveal | ~1 viewport | cover swings `-180deg` about the spine; shadow sweeps the block |
| 2 — pages turning | ~1.5 viewports | 3 leaves flip `-180deg`, slightly overlapped so it reads as one shuffle |
| 3 — settles open | ~1.5 viewports | leaves fan to `±6deg`, block shadow softens, headline + CTA fade up |

Easing is `power2.inOut` per beat and `power1.out` on copy. **Never `none` or
linear** — that is the difference between premium and cheap.

Performance rules, all load-bearing:

- Animate only `transform`, `opacity`, and a CSS-variable shadow gradient.
  Never `width/height/top/left`, never animated `box-shadow` or `filter` on the
  pinned element.
- `will-change: transform` applied on pin-enter, removed on unpin.
- `ScrollTrigger.refresh()` on `document.fonts.ready`, because pin start depends
  on final text layout.
- `ScrollTrigger.config({ ignoreMobileResize: true })` so mobile browser-chrome
  show/hide does not thrash refreshes.
- **No `ScrollTrigger.normalizeScroll()`** — it hijacks touch scrolling and
  breaks mobile.
- Cleanup via `gsap.context()` + `ctx.revert()`, with `registerPlugin` **inside**
  the context so React 19 StrictMode's double-mount cannot leak a duplicate
  trigger.

`globals.css` changes `html, body { overflow-x: hidden }` to `overflow-x: clip`
— `hidden` on a root element creates a scroll container and breaks pin
measurement. `max-width: 100vw` is kept.

### 3.8 Responsive and reduced motion

`gsap.matchMedia()` gives one declarative branch per condition:

- `(min-width: 768px)` — the full four-beat sequence above.
- `(max-width: 767px)` — **three** beats: cover tilts → opens → one leaf turns →
  copy in. `end: "+=180%"`, stage `scale: 0.7`, no multi-leaf shuffle. Mobile
  keeps the interaction but not the choreography.
- `(prefers-reduced-motion: reduce)` — **no ScrollTrigger and no pin at all.**
  `data-motion="still"` on the stage switches the book to an already-open state
  in pure CSS, and copy gets a plain opacity fade.

The still variant is a designed variant, not an absence: the book is open, the
headline and CTA are visible immediately, and the page is full height. A
reduced-motion visitor must never be left staring at an unpinned closed book.

### 3.9 The Skill is updated, not paralleled

`.claude/skills/ebook-fte-design-system/SKILL.md` gets: the confirmed dark and
light token tables with measured contrast; the accent-role glossary; a
*heavy scroll-driven motion belongs on the marketing page only* section; the
gold-may-not-encode-status rule; the in-progress-uses-warning rule; and extended
review-checklist lines. The placeholder caveat ("confirm the palette with the
project owner") is **removed**, since it has now been answered. Spacing, type
scale and motion sections stay as they are.

## 4. Acceptance criteria

**Tokens and type**

1. Every colour in every `.tsx` resolves through a custom property; zero raw hex
   values remain outside `globals.css`.
2. `--font-display` and `--font-body` are backed by a `next/font` family. No
   family is declared that is not actually loaded — the bug this slice fixes.
3. No reference to `--font-geist-*` remains in the codebase.
4. Every contrast pair in §3.1's tables is reproduced by measurement, not
   assumed; body text and muted text clear 4.5:1 and control boundaries clear
   3:1 in **both** themes.

**Theme**

5. Toggling the theme re-themes every page including the streaming panel, with no
   flash of the wrong theme on load.
6. The streaming panel and all form inputs still read as inset surfaces in the
   light theme (they must not become paper-on-paper).
7. `--color-success/warning/danger` on the dark theme are byte-identical to their
   current values.
8. No accent fill uses anything other than `--color-accent-ink` for its text.
   Specifically: a gold primary button has ink text, never cream.

**Hero — behaviour**

> **Superseded 2026-10-08 by Part IV (§25, §29).** AC 9–15 described the pinned
> scroll-book hero, which Part IV retires; they are kept as the record of what
> Part I shipped. The live criteria for the hero are in Part IV §29. Tokens,
> theme, scope-containment and gate ACs above and below this block still hold
> (AC 16 now reads "no ScrollTrigger on product screens"; the landing page
> itself keeps only non-pinned, non-scrubbed triggers).

9. The hero animation is driven by scroll position, not a timer or a hand-rolled
   scroll listener. Verified by scrubbing to a position, stopping, and confirming
   the book holds still.
10. The hero pins for the length of the sequence and then releases into normal
    page flow; scrolling past it does not leave a pinned spacer or a jump.
11. Each beat is distinguishable and reaches its end state at a fixed scroll
    distance — roughly 1 / 1 / 1.5 / 1.5 viewports.
12. No easing is `none` or linear.
13. At a fast flick and at a slow crawl the animation completes without stutter,
    snapping mid-sequence, or leaving a leaf stranded part-turned.
14. Under `max-width: 767px` a shortened 3-beat version plays; the multi-leaf
    shuffle does not.
15. Under `prefers-reduced-motion: reduce` there is no pin, the book renders
    already open, and the headline and CTA are visible without scrolling.

**Scope containment**

16. `generate`, `settings`, `signin` and `signup` contain no ScrollTrigger and no
    pinned section. Only `landing.tsx` imports the hero.
17. The design-system Skill contains no second, conflicting token set — it
    carries these tokens and nothing else.

**Gates**

18. `npm run lint`, `npm run test` (59 tests) and `npm run format:check` all pass.

## 5. What the customer still does

Nothing changes for them. The product still does what it did; this slice changes
how it looks and adds one animated moment on the page they first land on.

The book on the landing page is decorative and represents no real book — it is
a promise about the product, not a feature. It reveals no customer data, reads
no tenant state, and starts nothing. The sign-up and sign-in paths are
untouched.

A signed-in visitor still sees this page with the primary action pointed at
their workspace, so the hero *is* shown to them. It remains decorative.

---

# Part II — Marketing landing page structure

**Added:** 2026-10-03, after Checkpoint 2. **Governs:** `frontend/app/page.tsx`,
`components/landing/*`, and the landing CSS in `globals.css`.

## 6. Goal

Restructure `/` into a paced marketing page whose section order follows a proven
e-book-tool landing pattern (section order and pacing only), rewritten entirely
in this product's own voice. The product is an AI worker, not a template editor;
the reference structure is borrowed, its content is not.

## 7. Section order

*(Rewritten 2026-10-08 by Part IV, §25–§29. The pre-Part-IV order — hero,
social proof, see-it-in-action, feature rows, how-it-works, FAQ, final CTA — is
superseded.)*

| # | Section | Purpose |
|---|---|---|
| 1 | Hero | split headline + one-line subhead + **one primary CTA and at most one secondary in-page anchor** + a trust row, with the tilt/float book as the visual centrepiece. No paragraph competing with the visual. |
| 2 | Social proof strip | three **real, non-usage product facts** (free books, platforms, export formats) that count up on scroll. Any *usage* figure stays a **placeholder until a real number exists** (§8.2). |
| 3 | Capabilities bento | six cards, staggered entrance: writing, covers, formats, publishing package, marketing, audiobook narration. Publishing's wording is constrained by §8.1. |
| 4 | How it works (tour) | TOC-style steps mirroring the real flow, with a scroll-linked sticky preview; step 3's preview is the real "watch it write" streaming panel, looping (§9's reconstruction rules now apply to this step). |
| 5 | Who it's for | honest two-column fit / not-fit. No invented personas (§26). |
| 6 | Founder note | why the product exists, first-person, unattributed until a real person exists (§26). |
| 7 | Pricing card | the free tier's real facts only. No invented prices (§26). |
| 8 | FAQ | collapsed accordion, the questions a non-technical first-time author actually has (§12 unchanged). |
| 9 | Final CTA | one line + button, visually distinct background, no new information. |
| 10 | Footer | brand, the two real destinations, tenant threading (unchanged). |

Plus a **mobile sticky CTA bar** (below 768px only) that appears once the hero
is behind the visitor and hides while the final CTA is on screen (§28).

**Copy-density ceiling.** The hero sets the maximum. No section may run longer
than the hero's density. If a card or step needs a paragraph to explain itself,
it needs a simpler description — not more words. Each bento card: one short
headline, 1–3 sentences maximum, one visual. Each tour step: one short headline,
2–3 sentences maximum.

## 8. Copy honesty constraints

These are acceptance criteria, not style preferences. Each one prevents a
specific false claim reaching a customer.

### 8.1 Publishing is described as prepare-and-validate, never as submission

AGENTS.md §2 and `specs/004-publishing-preflight/research.md` established that
KDP, Apple Books and IngramSpark expose **no public self-publisher submission
API**. KDP's only API is read-only sales data; all three are web portals.

Therefore:

- Permitted: we prepare the package, validate it against each platform's rules,
  and hand the author a precise per-platform checklist.
- Permitted: ISBN and category guidance; metadata mapping; trim/spine/margin
  calculation.
- **Forbidden:** "submit to KDP/Apple Books/IngramSpark directly", "publish with
  one click", "we send it to the stores", or any wording implying we press the
  Publish control.

This is load-bearing: `submit_for_publishing` cannot be built against these
platforms without becoming undisclosed browser automation. A tool with that
name would be a tool that cannot do the thing it says.

**This slice also fixes a live false claim.** `components/landing/landing.tsx`
currently reads *"submit to the stores using your own accounts"* in the
step-3 copy. That is inaccurate under the corrected decision and is corrected
here.

### 8.2 No fabricated numbers

The social-proof strip must not invent a statistic. Until a real figure exists
it renders an obviously-unfinished placeholder — visibly a blank to be filled,
not a plausible-looking number. A believable fake ("12,000+ books created") is
worse than an obvious gap, because it can ship unnoticed.

The same rule bars invented review quotes, customer counts, ratings, and
"trusted by" logo walls.

### 8.3 No testimonial section at all, yet

The section is **omitted entirely** rather than filled with placeholders. It
returns when real, attributed quotes exist.

### 8.4 No stock photography and no reference-site assets

Visuals are CSS/SVG built from the Skill's tokens. No stock photos, no borrowed
imagery, no mega-navigation with dozens of product links — this is one product.

## 9. The "see it in action" section is a reconstruction, not a recording

*(Part IV: the standalone section is merged into the how-it-works tour as step
3's sticky preview — §7 row 4, §27. Everything below still applies to that
preview; it is the same component and the same scripted loop.)*

No real screen capture of the product exists yet. Rather than fabricate a
product screenshot or ship a broken `<video>`, this section drives the **real
`components/stream/stream-panel.tsx`** with real token styling and loops a
scripted text sequence through it.

This is honest — it is the actual UI component, not a picture of a UI — but it
is not a recording of a real session. The component is written so a genuine
capture can replace it later, and the reconstruction is flagged in a code
comment so nobody mistakes it for a recording. If a real capture is produced,
prefer it.

## 10. Tenant threading (FR-010) survives the restructure

`app/page.tsx` reads `?tenant=<slug>` from the arrival URL. A visitor who came
through a subscribing company's branded link must stay bound to that tenant.

- **Every** marketing link that leads toward auth carries `?tenant=<slug>`:
  hero CTA, final CTA, nav sign-in, and any FAQ or feature CTA that links out.
- A missing or blank `tenant` param must not produce `?tenant=` or
  `?tenant=undefined`; the existing `trim() || "example-press"` fallback stands.
- Signed-in state swaps the CTA target to `/generate` and must not drop the
  slug.
- The FAQ and the feature rows are marketing copy, not tenant-scoped routes; they
  link to `#anchors` on the same page and therefore never carry a tenant param.

This is the highest-risk regression in the restructure, because it is invisible
until a real tenant link is followed end to end.

## 11. Navigation

*(Amended 2026-10-08, Part IV.)*

`Features`, `How it works`, `Pricing`, `FAQ` — all four are **in-page anchors**
(`#features`, `#how-it-works`, `#pricing`, `#faq`), plus `Sign in` and the
primary CTA. The theme toggle is fixed top-right by `layout.tsx`, so the header
reserves that corner and must not collide with it.

`Pricing` was dropped when this section list was written because there was no
pricing section to point at and no `/pricing` route (a route link would 404).
Part IV adds the pricing *section* (§7 row 7), so the anchor now resolves
on-page. Still **no `/pricing` route link**: the only routes remain `/`,
`/signin`, `/signup`, `/generate`, `/settings`, and real paid pricing still
depends on Lago plan decisions that have not been made (§15, §26).

## 12. FAQ behaviour

- Collapsed by default.
- **One open at a time** — opening a question closes the previous one.
- Implemented as a real accordion: each trigger is a `<button>` with
  `aria-expanded` and `aria-controls`; the panel is labelled by its trigger.
- Keyboard operable, and the FAQ answers "remove fear" per the product's
  first-time-author requirement.
- Required questions: writing experience needed; what if I dislike the output;
  do I own the rights; what publishing actually costs; can I bring my own
  OpenAI/Anthropic key (BYOK); what happens after 3 free generations.

## 13. Feature rows alternate

> **Superseded 2026-10-08 by Part IV (§7 row 3).** The five alternating feature
> rows are retired and replaced by the six-card capabilities bento; the rule
> below survives as the bento's rule — nothing reorders content for screen
> readers or keyboard users, and mobile is a single column in DOM order.

Text/image sides alternate so a long page stays rhythmic. On mobile both stack
in a single column, text first, in DOM order — the alternation is a desktop
layout effect and must not reorder content for screen readers or keyboard users.

## 14. Acceptance criteria

**Structure**

19. `/` renders the ten sections in the order in §7, plus the mobile sticky CTA
    bar (§28) on viewports below 768px.
20. No section exceeds the hero's copy density; each bento card is at most 3
    sentences and each tour step at most 2–3.
21. The hero shows exactly one primary action; the only other hero action is a
    secondary **in-page anchor** (never a route link).
22. The capabilities bento is a single column in DOM order on mobile, and no
    layout reorders content for screen readers or keyboard users.
23. The FAQ is collapsed by default and keeps at most one panel open.
24. The FAQ triggers are real buttons with `aria-expanded`/`aria-controls`.
25. No link points at a non-existent route; `#pricing` resolves to the on-page
    pricing section.

**Honesty**

26. No string anywhere in the landing page implies the product submits to a
    publishing platform (§8.1). The pre-existing "submit to the stores" claim is
    gone.
27. The social-proof strip contains no invented statistic: the shipped figures
    are real product facts (free-books cap, platform count, format count), and
    any *usage* figure remains visibly a placeholder until a real one exists
    (§8.2).
28. No testimonial/review/rating/logo-wall content is present.
29. No stock-photography or borrowed-asset references.

**Tenant**

30. Following `/?tenant=acme` through the hero CTA, the final CTA, and nav
    sign-in lands on `/signup?tenant=acme` (or `/generate` when signed in).
31. No link renders `?tenant=undefined`, `?tenant=null`, or a bare `?tenant=`.

**Motion and theme**

32. *(Amended 2026-10-08, Part IV.)* **No GSAP-pinned element exists on the
    page at all** — the scroll-book pin is retired (§25), and no product screen
    has ever had one (AC 16 still holds). The how-it-works tour's sticky preview
    is CSS `position: sticky` with scroll-linked step activation only: no pin,
    no scrub, no scroll takeover.
33. Under `prefers-reduced-motion: reduce` the whole page is readable with no
    pinning and no hidden content — including the writing demo in the
    how-it-works tour, which shows its final state rather than animating
    indefinitely. The tour's preview swap is instant (transitions are zeroed by
    the global reset) and every step's text is visible regardless of which
    preview is active.
34. Both themes are legible: no surface becomes paper-on-paper, no accent fill
    loses its `--color-accent-ink` label.

**Gates**

35. `npm run lint`, `npm run test` and a production build pass.
36. Every new class is defined in `globals.css` and resolves through a token; no
    new one-off colour or font is introduced for this page.

## 15. Pre-launch blockers (not resolvable by this slice)

These are recorded so they are not mistaken for done:

- Any *usage* figure for the social-proof strip still needs a real number.
  (Part IV changed the strip to ship real **product facts** instead — the open
  item is usage stats, not the strip itself.)
- The "see it in action" section should become a real capture. (Part IV merged
  the reconstruction into the how-it-works tour as step 3's preview; the
  reconstruction-not-recording rule in §9 still applies to it.)
- Testimonials need real, attributed quotes.
- Paid pricing copy needs the Lago plan decisions; the pricing section ships
  the free tier only, with paid prices marked as announced-before-launch (§26).
- Nothing here has been viewed in a browser; both themes are verified by static
  analysis only (see the note in commit `cbf047c`).

---

# Part III — Landing page polish: preloader, nav, reveal, texture

**Added:** 2026-10-05. **Governs:** `frontend/components/landing/*`,
`frontend/lib/gsap-setup.ts`, the landing CSS in `globals.css`, and the GSAP
section of `.claude/skills/ebook-fte-design-system/SKILL.md`.

Part III implements Part II (which was specified but only §7's first section had
been built) and adds the page-chrome and micro-interaction rules from the
2026-10-05 landing brief. Where Part III is silent, Part I and Part II stand
unchanged.

## 16. GSAP plugin licensing — resolved, premise corrected

The brief instructed: *confirm licensing before using SplitText or
ScrollSmoother, and fall back if unlicensed.* Verified, 2026-10-05:

- The project pins `gsap@3.15.0`. Since **3.13**, Webflow's acquisition made every
  plugin free, including the former Club-GreenSock-only ones.
- `frontend/node_modules/gsap/dist/SplitText.js` and `.../ScrollSmoother.js` both
  exist in that package, under the standard licence
  (`https://gsap.com/standard-license`, "Subject to the terms at", i.e. no
  separate Club entitlement).
- The npm README states it: *"GSAP is now 100% FREE including ALL of the bonus
  plugins like SplitText, MorphSVG."*

**Therefore:** no licence gate, no Club membership to buy, and no free-alternative
fallback path is needed.

**Decision:** use `SplitText`. **Skip `ScrollSmoother`** — licence is irrelevant
to the reason. ScrollSmoother replaces the browser's scroll container with a
transform-driven one, which requires a fixed wrapper, breaks in-page anchor
scrolling, interferes with keyboard focus scrolling, and adds per-frame work on
top of `scrub`. Native scrolling plus the Skill's numeric `scrub` already gets the
inertia the brief wanted. Adding it would trade §8's performance budget for a
feel difference almost no visitor would notice.

**Registration is centralised** in `frontend/lib/gsap-setup.ts`. No component may
call `gsap.registerPlugin` for a shared plugin; `scroll-book-hero.tsx`'s existing
call is replaced by importing the setup module, which registers on import. (The
Part I rationale for registering *inside* `gsap.context` still holds for trigger
*creation* — only registration moves.)

## 17. Preloader

First load of a session only. A branded wordmark/book-icon fade, **≤1.2s**, hidden
entirely for the rest of the session.

- Session marker in `sessionStorage` inside `try/catch` — a browser with storage
  disabled must not throw and must not strand the preloader on screen.
- **Hard cap 1.5s regardless of asset state.** The preloader fades out on
  whichever comes first: fonts ready, or the cap. A preloader that waits for
  assets on a slow connection is a worse failure than no preloader.
- **Fail open.** Any error in the ready path resolves the same way the cap does.
  JavaScript off, or a hydration failure, means the preloader was never painted
  — it must never be the thing standing between a visitor and the page.
- It is marketing chrome on `/` only. No product screen gets one.

## 18. Navigation behaviour

The masthead becomes **fixed** (it currently sits in normal flow) so it can
overlay the hero and then transition:

1. **Transparent over the hero**, becoming solid `--color-surface` with a subtle
   shadow once scrolled past it. Driven by a `ScrollTrigger`, never a raw scroll
   listener (Part I: hand-rolled listeners repaint the page every frame).
2. **Hide on scroll-down, show on scroll-up**, desktop/tablet only
   (`min-width: 768px`). Below that it stays fixed and solid, permanently — the
   hide/show pattern is fiddly on touch and buys little on a phone.
3. **Threshold: 120px**, and the direction test requires ≥8px of travel. Small
   scroll jitter (trackpad noise, momentum residue, an over-sensitive
   `wheel`) must not toggle the bar.

A fixed bar over the hero needs the hero to reserve its height, which the hero's
padding-top does. *(Part IV note: the pinned hero this paragraph was written
against is retired — §25 — so there is no longer a pin to fight, but the
reservation stays: the bar still overlays and fades, and a transparent bar over
hero artwork still needs the reservation.)* It cannot sit in normal flow now
that it must overlay and fade.

Nav contents are the four in-page anchors of §11 as amended by Part IV —
`Features`, `How it works`, `Pricing`, `FAQ` — plus sign-in and the primary CTA.
`Pricing` is an on-page anchor to the pricing section, not a route link; there
is still no `/pricing` route and one must not be invented.

## 19. Headline reveal

Hero `<h1>` animates in on load with `SplitText`, word-level, `yPercent` +
`opacity`, `--ease-standard`.

- **Total ≤600ms** including stagger. A repeat visitor re-running a slow hero is
  the failure mode; per-word stagger is ~40ms across a 9-word headline.
- Runs once on load, **not** scrubbed. *(Part IV: it is the leading beat of the
  hero's single load timeline — eyebrow, headline, sub/CTA/trust row, book
  entrance — which finishes within ~1.4s of load. There is no longer a separate
  scroll-driven book timeline for it to stay independent of; nothing in the
  hero is scrubbed.)*
- The split is reverted after it completes, so the `<h1>` returns to plain text in
  the DOM (split wrappers otherwise break Ctrl-F, text selection, and translation).
- **Reduced motion:** no split at all, headline visible from first paint.
- **Accessibility:** the headline is real text and stays in the accessibility
  tree throughout — the reveal animates `opacity`/`transform` on word wrappers
  that are never `aria-hidden`, and because the default (pre-JS, pre-split) state
  is fully visible, a screen reader never meets an invisible headline. `opacity: 0`
  is never the *only* thing hiding content a visitor is entitled to read.

## 20. Micro-interactions

- **Magnetic buttons.** Desktop, fine-pointer only: the button eases toward the
  cursor on hover via `gsap.quickTo`, max 6px offset. Gated on
  `(hover: hover) and (pointer: fine)` so it is never simulated on touch, and
  `(prefers-reduced-motion: reduce)` disables it. Transform only.
- **Card/link hover lift.** `translateY(-2px)` + shadow, `--duration-fast`,
  `--ease-standard`, on the existing tokens. Applied once as a shared class, not
  re-declared per card type.
- **No custom cursor.** Excluded deliberately: it degrades pointer precision and
  conflicts with native text cursors.

## 21. Paper grain

A tileable SVG-noise overlay at **2–4% opacity on light-theme surfaces only**
(`[data-theme="light"]`). Purely decorative → `aria-hidden="true"`, and
`pointer-events: none` so it can never intercept a click.

Light-only is deliberate: over the dark ink canvas a noise overlay reads as
compression artefact, not paper. Shipped at 3%, awaiting the owner's visual
sign-off (§23).

## 22. Performance and accessibility budgets (non-negotiable)

- Animate `transform` and `opacity` only. Never `width/height/top/left/margin`,
  never animated `box-shadow` or `filter` (Part I, restated as a gate).
- **No layout shift from images.** Every visual on the page is CSS/SVG, so no
  `<img>` needs an aspect box; where `next/image` is used it must be
  `sized`. Nothing above the fold waits on a full-resolution bitmap.
- **No GSAP pin remains to trap focus.** *(Part IV: the pinned hero is retired —
  §25 — and nothing replaced it with another pin. The how-it-works tour's
  sticky preview is CSS `position: sticky`; it contains no focusable element,
  every step's text is ordinary document content in DOM order, and the preview
  swap is visual only.)*
- Decorative animated elements (book, grain, foil) are `aria-hidden="true"`.
- Reduced motion is a designed static variant **for the whole page**, not just
  the hero: the writing demo in the how-it-works tour shows its finished state
  instead of looping, reveals are skipped, no pin exists, nothing is left
  mid-animation, and the tour's preview swaps instantly rather than fading.

## 23. Acceptance criteria (Part III)

37. `lib/gsap-setup.ts` is the only place `gsap.registerPlugin` is called.
38. Preloader appears only on a session's first load of `/`, resolves within
    1.2s, is hard-capped at 1.5s, and cannot block the page if storage or
    JavaScript fails.
39. Masthead is transparent over the hero and solid after it, via ScrollTrigger;
    hide/show-on-scroll is desktop-only and does not fire on jitter.
40. Headline reveal is word-level, ≤600ms, and the DOM contains plain text
    afterwards (no residual split wrappers).
41. Magnetic hover appears only on fine-pointer, non-reduced-motion devices.
42. Grain overlay is ≤4%, light-theme only, `aria-hidden`, non-interactive.
43. No animated property outside `transform`/`opacity`; no CLS on load.
44. Under `prefers-reduced-motion`, the entire page — every section — is static
    and fully readable, with nothing hidden or mid-animation.
45. Part II AC 19–36 all hold.
46. `npm run lint`, `npm run test` and `npm run build` pass.

## 24. Verification status and what is still open

**Verified in a browser** (dev server, `/`):

- All seven sections render in order; full content present in the accessibility
  tree.
- No client-side errors. GSAP, ScrollTrigger and SplitText all initialise
  cleanly — a registration or import failure would have left the page inert.
- **The looping demo was found to be shifting the page**, and the fix is in: the
  panel has a constant height and the text scrolls inside it. Measured before —
  the FAQ block moved 579px between two observations and the scroll position
  snapped 393 → 0, because changing the document height under the pinned hero
  made ScrollTrigger re-measure the pin. Measured after — identical positions
  across three consecutive observations while the loop ran.
- The demo now only types while on screen (`IntersectionObserver`, 0.25
  threshold). It previously looped regardless of visibility, burning frames
  through the whole hero and making the rest of the page un-observable.
- All six FAQ triggers are real `<button>` elements, collapsed by default, with
  the correct accessible names.
- The fixed masthead survives an `#faq` anchor jump and stays in place.

**Verified by test, not by browser:**

- **`prefers-reduced-motion`.** Doing this honestly meant testing the *decision*,
  not the animation, because the decision is where the risk is. The decision was
  previously spelled out six times across five components in two incompatible
  idioms — four branches opted in with `(prefers-reduced-motion: no-preference)`,
  two opted out with `(prefers-reduced-motion: reduce)`. On a browser that
  reports neither, those forms disagree: the first disables motion, the second
  enables it. That inconsistency is now one module, `lib/motion-preference.ts`,
  with an explicit invariant — motion is only ever assumed on an *explicit*
  no-preference, and an absent, unsupported, or throwing `matchMedia` means
  *assume less movement*. `tests/motion-preference.test.ts` (8 cases) asserts
  that invariant directly, including the SSR case where `window` does not exist.
  The landing page's own reduced-motion branches still have not been *exercised
  in a browser*, because this environment reports `no-preference`; what is now
  proven is that each branch asks one tested question rather than its own copy of
  it.

  This also fixed a latent crash: the two pre-existing shells
  (`components/auth/auth-shell.tsx`, `components/generate/generate-shell.tsx`)
  called `window.matchMedia(...)` unguarded, which throws where the API is
  absent. Both now go through the same helper.

**NOT verified — do not read this slice as signed off on these:**

- **The FAQ accordion's one-open-at-a-time rule.** Browser tooling timed out
  twice before a click could dispatch. The state is a single `openIndex`, so
  this is low-risk, but it is untested. This project has no component-test
  renderer (`vitest` runs in the `node` environment and matches `*.test.ts`), and
  adding jsdom + Testing Library to prove a three-line `useState` toggle would be
  a larger change than the risk warrants — so it stays honestly open rather than
  getting a ceremonial test.
- **Measured 60fps scroll performance and CLS.** §8 of the brief demands
  measurement, not code inspection. This environment cannot profile a mid-range
  laptop. Needs a browser performance profile.
- **Desktop layout.** The verification viewport was 310×545 — good for the
  narrow case, useless for the two-column hero, the alternating feature rows, or
  the masthead's hide/show, all of which are desktop-only behaviour.
- **Light theme.** The grain overlay only renders under
  `[data-theme="light"]` and was never seen.

**Gates:** `tsc --noEmit` clean, `npm run lint` clean, `npm run test` 85/85
(13 files — the 8 new ones are `tests/motion-preference.test.ts`), `npm run build`
clean. `npm run format:check` was already failing on 19 files before this slice;
the files touched here are now formatted, reducing it to 16 pre-existing
offenders that belong to a separate change.

**Pre-existing build flake, unrelated to this slice:** `npm run build`
intermittently fails with `PageNotFoundError: Cannot find module for page:
/_not-found` / "Failed to collect page data for /_not-found", while the same
command succeeds minutes later on identical source. It reproduces on a clean
stash of this work (`git stash` of all `frontend/` changes, `.next` removed), so
it is not caused by anything here. `/_not-found` is a Next.js internal route that
no file in this project references, and the failure follows `✓ Compiled
successfully`, which is why it is worth flagging rather than silently re-running
until green. Clearing `.next` makes it pass; that is a workaround, not a
diagnosis.

**Owner decisions outstanding:**

- **Grain opacity sign-off** — shipped at 3%, one token (`--grain-opacity`).
- Social-proof statistic, real screen capture for the demo, testimonials, and
  pricing copy — unchanged from §15.

---

# Part IV — Homepage restructure: sections, hero, CTA

**Added:** 2026-10-08. **Governs:** `frontend/components/landing/*`, the
landing CSS in `globals.css`, `frontend/lib/motion/*` (the Step 3 module this
part consumes), and the landing page's use of
`.claude/skills/ebook-fte-design-system/SKILL.md`.

The owner's Step-4 brief (2026-10-08) replaces the Part II/III page with a full
SaaS homepage. Two decisions were confirmed before any code was written:
**"SaaS homepage, adapted sections"** — the reference section list's order and
mechanics are kept, its content is rewritten in this product's voice; and
**"rework in place"** — components that map to the new list are rebuilt where
they stand, the rest are replaced, and nothing is deleted from disk while the
tree is uncommitted. §7, §11, §13, §14, §15, §18, §19 and §22 were amended in
place above; this part records what changed and why, and adds the new criteria.

## 25. The hero book (amends §3.7–3.8, AC 9–15)

The pinned, scrubbed four-beat scroll-book is retired. In its place:

- **A closed, foil-stamped book** (new component `hero-book.tsx`, new
  `hero-book-*` CSS) rendered in the same two-column hero layout.
- **Idle float** in pure CSS keyframes (`translateY` + a baked-in base rotate,
  ~6s loop) and **pointer tilt** via `gsap.quickTo` (`rotateX`/`rotateY`,
  clamped), gated on `(hover: hover) and (pointer: fine)` and
  `MOTION_ALLOWED_MQ`. Reduced motion: no float, no tilt — a static book,
  correct from first paint because the float is a CSS animation the global
  reduced-motion reset zeroes.
- **One hero load timeline** (inside `gsap.matchMedia(MOTION_ALLOWED_MQ)`):
  eyebrow → masked SplitText headline (§19 rules unchanged: ≤600ms word reveal,
  reverted on complete) → subhead/CTA/trust row → book entrance (opacity +
  rise). Everything is visible by default in the DOM; the timeline only ever
  hides what it will show within ~1.4s.
- **Secondary CTA** is an in-page anchor ("Watch it write" →
  `#how-it-works`), never a route (§14 AC 21).
- **Trust row**: real product facts only — "No card required", "3 free books",
  "EPUB, MOBI & PDF", "You press Publish, always". The note line keeps only the
  sign-in link, so nothing repeats.

Why: five viewport-heights of pinned scroll was the page's largest cost and its
largest risk (pin measurement, mobile browser-chrome thrash, direction
complaints). The tour section (§27) now carries the scroll-linked storytelling;
the hero's job is the first screen, and it does it without a takeover.

`scroll-book-hero.tsx` and its CSS are left on disk, unimported (the tree is
uncommitted; nothing is deleted until a clean rollback point exists). AC 9–15
are superseded by §29.

## 26. Honest-content additions (bento, fit, founder, pricing)

- **Capabilities bento** replaces the five feature rows (§13 superseded). Six
  cards — writing, covers, formats, publishing package, marketing, audiobook
  narration — each one headline + ≤3 sentences, reusing the existing CSS row
  visual art where it fits and one new CSS visual for narration. Staggered
  entrance via the Step 3 module's `staggerReveal` (cards do **not** carry
  `data-reveal`, so the page-wide reveal never double-animates them). Cards
  never reorder content for screen readers (§13's surviving rule).
- **Who it's for** is two honest columns (fit / not-fit) derived from real
  product boundaries — including the ones that sound like disqualifiers
  (publishing is prepare-and-validate; the final click is the author's; no
  guaranteed outcomes). No invented personas.
- **Founder note** is first-person plural ("Why we built it"), signed "The
  E-book FTE team", with an owner-action comment: it becomes a named founder
  quote with portrait only when a real person exists. **No invented person** —
  the §8.2 honesty rule, applied to identity instead of numbers.
- **Pricing card** ships the free tier's real facts only ($0, 3 books, formats,
  publishing checklists, no card) and states that paid pricing is announced
  before launch. **No invented dollar amounts** — §8.2 extends to prices.
  Owner-action comment points at the Lago plan decisions (§15).

## 27. The how-it-works tour (merges §9 + the old how-it-works section)

Section id stays `#how-it-works` (nav and footer anchors unchanged). Structure:
TOC-style ordered steps (the real flow: sign up → say what you want → watch it
write → review cover & format → publish when ready) on the left; a **CSS-sticky
preview panel** on the right that swaps to the active step's mockup.

- **Scroll-linking is activation, not animation.** One `IntersectionObserver`
  with a centred band tracks which step crosses the viewport middle and sets
  the active index. No scroll listener, no ScrollTrigger pin, no scrub (AC 32).
  Previews are decorative (`aria-hidden`); every step's text is real content,
  always visible, in DOM order.
- **Step 3's preview is the real `StreamPanel`** with the scripted loop §9
  governs, visibility-gated so it only types while its preview is the active
  one.
- **Reduced motion:** the swap is instant (the global reset zeroes the preview
  crossfade transition), the demo shows its finished state (existing
  behaviour), and no step text is ever hidden.

## 28. Mobile sticky CTA bar

Below 768px only (CSS media query). A fixed bottom bar with the primary CTA
and a "3 free books · no card" note. It appears once the hero is no longer
intersecting and hides while the final CTA is on screen (two
`IntersectionObserver`s; default-visible in CSS so a no-JS phone still gets it,
with the page reserving bottom padding so it never covers content). It threads
`?tenant=` like every other auth-bound link (§10, AC 30–31, 52).

## 29. Acceptance criteria (Part IV)

47. §7's ten sections render in order; the mobile CTA bar is present below
    768px and absent above it.
48. No GSAP pin, no scrub, and no scroll takeover exists anywhere on `/`; the
    only scroll-linked behaviour is trigger-based reveals, the tour's
    activation observer, and the masthead's ScrollTrigger class toggles.
49. The hero load timeline completes within ~1.5s of load; with JS off or
    motion reduced, every hero element (eyebrow, headline, sub, both CTAs,
    trust row, book) is visible in the served HTML.
50. The social-proof figures are the three real product facts, count up only
    when motion is allowed and only when scrolled into view, and render their
    final values in the served HTML.
51. No invented person, price, usage statistic, testimonial, or
    platform-submission claim appears anywhere in the new sections (§8, §26).
52. Following `/?tenant=acme` through the mobile CTA bar and the pricing card's
    CTA lands on `/signup?tenant=acme` (or `/generate` when signed in).
53. Under `prefers-reduced-motion: reduce`: no float, no tilt, no split, no
    reveals, no demo loop, and the tour's preview swap is instant with all step
    text visible.
54. Both themes render every new section legibly; every new class resolves
    through tokens; no raw hex outside `globals.css`.
55. `tsc --noEmit`, `npm run lint`, `npm run test`, `npm run format:check` (for
    touched files) and a production build pass.

## 30. Verification (Part IV)

Built 2026-10-19. Reviewed at 360 / 768 / 1024 / 1440 / 1920 px, both themes,
against a production build served on port 3100.

**Gates (all pass):**

- `npx tsc --noEmit` — clean.
- `npm run lint` (ESLint) — clean.
- `npm run test` (Vitest) — 102 passed / 102, 14 files.
- `prettier --check` on every touched file — clean.
- `npm run build` — succeeds; `/` is a dynamic route (~39.5 kB, 183 kB first
  load).

**Browser review method.** `playwright-core@1.64.1` (exact-pinned devDependency)
driving system Edge (`channel: "msedge"`) — the built-in browser flow had been
declined earlier in the session, so this is the recorded substitute. Full-page
screenshots at all ten theme×breakpoint combinations, plus a geometry probe and
a behaviour probe. **No console errors and no page errors at any breakpoint, in
either theme.**

**What the review confirmed (mapped to ACs 47–55):**

- **AC 47** — ten sections render in §7 order (proof → capabilities → tour →
  fit → founder → pricing → FAQ → closing CTA → footer; hero is first). The
  mobile CTA is `display: flex` at 360 px and `display: none` at 768 px and up.
- **AC 48** — no GSAP pin, scrub, or scroll takeover on `/`. The only
  scroll-linked behaviour is trigger-based reveals, the tour's activation
  `IntersectionObserver`, the two mobile-CTA `IntersectionObserver`s, and the
  masthead's `is-solid` `ScrollTrigger` class toggle.
- **AC 49** — hero load timeline completes well inside 1.5 s; with reduced
  motion (played through the browser with `reducedMotion: "reduce"`) every hero
  element — eyebrow, headline, sub, both CTAs, four-item trust row, book — is
  visible, the book at `opacity: 1` in its settled static pose.
- **AC 50** — the three social-proof figures are the real product facts (3 / 4 /
  3) and are present as final values in the served HTML; the count-up only runs
  motion-allowed and only on scroll into view.
- **AC 51** — no invented person (founder note signed "The E-book FTE team"),
  price (Free tier `$0` only; paid pricing stated as "announced before launch"),
  usage statistic, or platform-submission claim. Publishing copy everywhere says
  prepare-and-validate with the final click belonging to the author.
- **AC 52** — the pricing card's CTA and the mobile CTA both resolve to
  `/signup?tenant=example-press` on the tenant-scoped page (FR-010 intact).
- **AC 53** — under reduced motion: no float (the book's CSS float stops on its
  designed resting frame), no tilt (fine-pointer gate), no split, no reveals,
  the tour preview swap is instant, and tour step 3 renders the finished passage
  rather than typing it. All step text is in the DOM.
- **AC 54** — both themes legible at every breakpoint; every new class resolves
  through tokens; no raw hex outside `globals.css`. The only element wider than
  the viewport is the decorative `aurora-layer`/`aurora-field` (intentionally
  oversized, `pointer-events: none`) — no content overflow, no horizontal
  scroll at any size.
- **AC 55** — gates above.

**What was found and fixed during the build:**

- A missing `scroll-margin-top` on the four in-page anchor targets: without it,
  a nav jump landed with the section title tucked behind the fixed masthead.
  Added for `#features`, `#how-it-works`, `#pricing`, `#faq`.
- The retired feature-row and "see it in action" blocks left orphan CSS
  (`.landing-row*`, `.landing-action-*`, `.landing-step*`). Removed, keeping the
  shared `.landing-visual-*` primitives the bento reuses.
- `landing-visual-wave-bar` was added as the one new CSS art primitive
  (audiobook card), matching the existing token-only, no-borrowed-imagery rule.

**Confirmed healthy (measured, not assumed):** bento cards share a uniform
height within each grid row (e.g. 1440 px: 352/352, then 404/404/404, then the
230 px full-width strip) — grid stretch, no per-card height hacks needed. The
bento collapses 3 → 2 → 1 columns and the tour/fit grids 2 → 1 at their
breakpoints, all in DOM order with no content reordering.

**Superseded this session (files remain on disk, unimported):**
`feature-rows.tsx`, `how-it-works.tsx` (steps), `see-it-in-action.tsx`,
`scroll-book-hero.tsx`. Their `globals.css` blocks were removed; their component
files are kept as the rollback point for Step 4.


