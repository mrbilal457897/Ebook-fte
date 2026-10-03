# Slice 005 - Visual identity + scroll-book hero (spec)

**Date:** 2026-10-03
**Supersedes:** nothing. **Constrains:** AGENTS.md §2 (Next.js 15 App Router),
constitution Article VI (GSAP-driven motion) and Article II (spec before code).
**Governing Skill:** `.claude/skills/ebook-fte-design-system/SKILL.md` — this
slice updates that Skill's token block rather than creating a parallel set of
tokens.

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
untouched, and the hero is not shown to a signed-in customer on their way into
the workspace.