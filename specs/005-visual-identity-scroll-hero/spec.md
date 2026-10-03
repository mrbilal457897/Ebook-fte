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

| # | Section | Purpose |
|---|---|---|
| 1 | Hero | headline + one-line subhead + single primary CTA, with the scroll-book hero as the visual centrepiece. No paragraph competing with the visual. |
| 2 | Social proof strip | one usage-stat line. **Placeholder until a real number exists** (§8.2). |
| 3 | See it in action | the real "watch it write" streaming panel, looping. Replaces a template gallery, which we do not have. |
| 4 | Feature rows | five capabilities, alternating image-left/text-right then text-left/image-right. |
| 5 | How it works | 4–5 numbered steps mirroring the real flow. |
| 6 | FAQ | collapsed accordion, the questions a non-technical first-time author actually has. |
| 7 | Final CTA | one line + button, visually distinct background, no new information. |

**Copy-density ceiling.** The hero sets the maximum. No feature row may run
longer than the hero's density. If a feature needs a paragraph to explain
itself, the feature needs a simpler description — not more words. Each feature
row: one short headline, 2–3 sentences maximum, one visual, at most one
secondary CTA.

The five feature rows are content generation, cover design, formatting and
export, publishing, and marketing. Publishing's wording is constrained by §8.1.

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

Minimal: `Features` and `How it works` anchor links, `Sign in`, and the primary
CTA. The theme toggle is fixed top-right by `layout.tsx`, so the header reserves
that corner and must not collide with it.

**No `Pricing` link.** There is no `/pricing` route; the only routes are `/`,
`/signin`, `/signup`, `/generate`, `/settings`. A Pricing link would 404. Real
pricing depends on Lago plan decisions that are not yet made, and the free-tier
cap of 3 generations is the only confirmed commercial fact.

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

Text/image sides alternate so a long page stays rhythmic. On mobile both stack
in a single column, text first, in DOM order — the alternation is a desktop
layout effect and must not reorder content for screen readers or keyboard users.

## 14. Acceptance criteria

**Structure**

19. `/` renders the seven sections in the order in §7.
20. No section exceeds the hero's copy density; each feature row is at most 2–3
    sentences.
21. The hero shows exactly one primary action.
22. Feature rows alternate sides on desktop and stack text-first on mobile.
23. The FAQ is collapsed by default and keeps at most one panel open.
24. The FAQ triggers are real buttons with `aria-expanded`/`aria-controls`.
25. No `Pricing` link or any other link to a non-existent route exists.

**Honesty**

26. No string anywhere in the landing page implies the product submits to a
    publishing platform (§8.1). The pre-existing "submit to the stores" claim is
    gone.
27. The social-proof strip contains no invented statistic, and its placeholder is
    visibly a placeholder.
28. No testimonial/review/rating/logo-wall content is present.
29. No stock-photography or borrowed-asset references.

**Tenant**

30. Following `/?tenant=acme` through the hero CTA, the final CTA, and nav
    sign-in lands on `/signup?tenant=acme` (or `/generate` when signed in).
31. No link renders `?tenant=undefined`, `?tenant=null`, or a bare `?tenant=`.

**Motion and theme**

32. The scroll-book hero is the only pinned/scroll-driven element on the page,
    and no product screen gained one (§3.7, AC 16 still holds).
33. Under `prefers-reduced-motion: reduce` the whole page is readable with no
    pinning and no hidden content — including the "see it in action" loop, which
    shows its final state rather than animating indefinitely.
34. Both themes are legible: no surface becomes paper-on-paper, no accent fill
    loses its `--color-accent-ink` label.

**Gates**

35. `npm run lint`, `npm run test` and a production build pass.
36. Every new class is defined in `globals.css` and resolves through a token; no
    new one-off colour or font is introduced for this page.

## 15. Pre-launch blockers (not resolvable by this slice)

These are recorded so they are not mistaken for done:

- The social-proof statistic needs a real number.
- The "see it in action" section should become a real capture.
- Testimonials need real, attributed quotes.
- Pricing copy needs the Lago plan decisions.
- Nothing here has been viewed in a browser; both themes are verified by static
  analysis only (see the note in commit `cbf047c`).
