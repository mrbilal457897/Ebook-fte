---
name: ebook-fte-design-system
description: Applies and enforces this project's UI/UX design system — the confirmed ink-and-gold palette, its dark and light themes, the Literata/Inter type pairing, spacing, button styles, page layout patterns, and GSAP motion conventions (including the scroll-driven hero, which is marketing-pages-only) — when building or modifying any page, component, or screen in the frontend/ Next.js app. Use when the task involves creating a new page or component, redesigning an existing one, choosing colors/fonts/spacing, adding or changing a theme, adding animation or scroll effects, or reviewing UI work for consistency with the rest of the product. Do NOT use for backend logic, agent instructions, database work, or any task that doesn't touch what the customer visually sees.
---

# E-book FTE Design System

This Skill is the single source of truth for how the product looks and
moves. Load it before writing or changing any frontend/ file that renders
UI. It exists so every page — sign-up, dashboard, the live "watch it
write" panel, the cover picker, the publish-confirmation screen — feels
like one product, not eight screens built on eight different days.

## When this fires
- "Build the sign-up page" / "add a dashboard for the customer's books" /
  "make the cover picker screen"
- "This page looks off" / "make this feel more premium" / "add some
  motion here"
- Any token, theme, palette or font decision in `frontend/app/globals.css`
- Building or reviewing the marketing scroll hero
- Any review pass on a just-built page or component before calling it done

## When this does NOT fire
- Backend agent instructions, MCP servers, database schema, billing logic
- Anything in `agents/` — that's ADK instruction work, not UI

## Design tokens (edit here, not per-component)

These are the project's **confirmed** palette and type pairing, decided
2026-10-03 (slice 005). They are not placeholders and must not be
re-litigated without asking the project owner first. This Skill enforces
*consistency*; the brand decision has already been made.

Keep them as CSS custom properties in `frontend/app/globals.css`, never
hard-coded inline in a component.

### Colour — ink base, cream, one gold accent

The direction is paper-and-ink, not tech-purple: a deep ink navy canvas, a
warm cream (never pure white) for text and for any light surface, and
**exactly one** accent pulled from classic book-cover territory — muted old
gold. The gold is the gilding convention of fine bookbinding, so it reads
"publisher" rather than "SaaS". Do not add a second accent hue.

```css
:root {
  --color-ink: #121821;            /* the canonical "ink" primitive */
  --color-bg: var(--color-ink);
  --color-surface: #1A212C;
  --color-surface-raised: #222B38;
  --color-border: #455163;         /* decorative hairlines ONLY */
  --color-border-strong: #5D6A7D;  /* 3.2:1 — control boundaries */
  --color-paper: #F3EBDC;          /* cream; theme-independent */
  --color-paper-edge: #E4D8C3;
  --color-text: #EFE7D6;
  --color-text-muted: #A8A79E;

  --color-accent: #C2A15A;         /* THE one accent */
  --color-accent-hover: #C9A961;
  --color-accent-ink: #12181F;     /* text ON an accent fill */
  --color-accent-deep: #7A5F17;    /* accent on --color-paper */

  --color-success: #34d399;
  --color-warning: #fbbf24;
  --color-danger: #f87171;
}
```

Light theme is `[data-theme="light"]`, reached only by deliberate choice —
**never** via `prefers-color-scheme`. Warm paper base:

```css
:root[data-theme="light"] {
  --color-bg: #EAE2D2;
  --color-surface: #F5EFE3;
  --color-surface-raised: #FBF7EF;
  --color-border: #D8CDB7;
  --color-border-strong: #8C7C5C;
  --color-text: #1B222B;
  --color-text-muted: #5C5648;
  --color-accent: #6B5314;
  --color-accent-hover: #7A5F17;
  --color-accent-ink: #FBF7EF;
  --color-success: #157347;   /* see "semantic colours are per-theme" */
  --color-warning: #8A5A08;
  --color-danger: #B3261E;
  /* --color-ink / --color-paper / --color-paper-edge /
     --color-accent-deep are NOT overridden — see below */
}
```

`--color-ink`, `--color-paper`, `--color-paper-edge` and
`--color-accent-deep` describe a **physical object** (a book: its board, its
paper, its foil), not a UI surface. They must not invert when the UI theme
does — a gold-foiled book does not turn lavender in light mode.

`--color-bg` is darker than `--color-surface` in *both* themes. That is
deliberate: several panels paint `--color-bg` on top of `--color-surface` to
read as inset (the streaming panel, form inputs). Keep that relationship in
whatever theme you add, or those panels become paper-on-paper.

### Accent roles — which token for which job

| Token | Use it for | Never use it for |
|---|---|---|
| `--color-accent` | accent text, accent borders, accent fills, focus rings | text on an accent fill |
| `--color-accent-hover` | hover state of an accent fill | anything else |
| `--color-accent-ink` | **all** text/icons sitting on an accent fill | text on a normal surface |
| `--color-accent-deep` | accent text on `--color-paper` | anything else |

`--color-accent-ink` exists because gold text on gold fill measures 1.4:1. Any
filled accent control **must** set its colour to `--color-accent-ink`. A gold
primary button has ink text, never cream.

Convenient property worth knowing: `--color-accent` is simultaneously
text-safe *and* fill-safe in both themes (7.25 / 5.68 as text, 7.26 / 6.84 as a
fill with its ink). Only the ink flips.

### The gold/amber rule — read this before touching status colours

Gold (`#C2A15A`) and `--color-warning` (`#fbbf24`) are **adjacent hues at
similar lightness**. A gold "pending" badge and an amber "pending" badge are
indistinguishable at a glance. Therefore:

- **Gold never encodes status.** Status is `--color-success` / `--color-warning`
  / `--color-danger` and nothing else. No exceptions, no "just this once".
- **In-progress uses `--color-warning`**, not the accent. This is the
  "colour by meaning, not decoration" rule below finally being applied to the
  one place that violated it.

### Semantic colours are per-theme, meaning is not

The dark-theme semantic values are fixed and must not change. The light theme
declares its own steps of the same three hues, because the dark values measure
**1.37–2.27:1** on a cream background — a mint-green "Live" badge at 1.58:1 is
effectively invisible. Light steps: `#157347` / `#8A5A08` / `#B3261E`, all
above 4.5:1 on both light surfaces.

A status never changes *meaning* with the theme — only its step. If you add a
third theme you must add a third step and re-measure; do not reuse the dark
values on a light surface.

### Measured contrast, both themes

Verified with WCAG 2.1 relative luminance. Re-measure if any value changes.

| Pair | Dark | Light |
|---|---|---|
| `--color-text` on `--color-bg` | 14.49 | 12.45 |
| `--color-text-muted` on `--color-bg` | 7.37 | 5.66 |
| `--color-text-muted` on `--color-surface` | 6.69 | 6.37 |
| `--color-accent` as text on `--color-bg` | 7.25 | 5.68 |
| `--color-accent-ink` on `--color-accent` fill | 7.26 | 6.84 |
| `--color-ink` on `--color-paper` | 15.07 | 15.07 |
| `--color-accent-deep` on `--color-paper` | 5.10 | 5.10 |
| `--color-border-strong` on `--color-bg` | 3.24 | 3.16 |

`--color-border` is below 3:1 on purpose — it is for decorative hairlines
between cards. Anything that is a **control boundary** (an input's edge, a
checkbox) uses `--color-border-strong` to clear WCAG 1.4.11.

### Typography

A serif display face for anything that should feel like a book, and a neutral
sans for actual interface chrome. The sans keeps forms, dashboards and buttons
usable; the serif is the *only* literary voice, which is what makes it read as
deliberate instead of twee. **Never set the serif on dense UI text.**

```css
:root {
  --font-display: var(--font-literata), Georgia, "Times New Roman", serif;
  --font-body: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
}
```

**Literata** for `--font-display` — the serif Google ships for long-form
reading in Play Books, so it reads "book" even at the 20–25px sizes `.app-title`
and section headings use. Fraunces is prettier at hero scale but goes busy
below ~32px, and this face appears on working screens, not only the landing page.

**Inter** for `--font-body` — high x-height, unambiguous glyphs at 12–16px.

Both are loaded through `next/font/google` in `app/layout.tsx` as
`--font-literata` / `--font-inter`, so they are self-hosted with no layout
shift. **A font-family token may only name a family that is actually loaded.**
The project shipped for months naming "General Sans"/"Inter" while loading
Geist and referencing neither, so the whole product rendered in `system-ui`.
Check the loader before trusting a token.

Note: `next/font/google` fetches at *build* time. An offline CI runner will
fail the build. The fallback is self-hosting woff2 under
`frontend/public/fonts/` with `@font-face`.

### Font-size scale (1.25 ratio, 16px base) — unchanged

Use these, never a one-off px value inside a component:

```css
:root {
  --text-xs: 12px;    /* helper text, timestamps, field hints */
  --text-sm: 14px;    /* secondary body text, captions */
  --text-base: 16px;  /* default body text */
  --text-lg: 20px;    /* emphasized body, section labels */
  --text-xl: 25px;    /* card/section headings */
  --text-2xl: 31px;   /* page headings */
  --text-3xl: 39px;   /* hero/landing headline only */
  --leading-tight: 1.2;   /* headings */
  --leading-normal: 1.5;  /* body text */
}
```

### Spacing scale (4px base) — unchanged

```css
:root {
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-6: 24px; --space-8: 32px; --space-12: 48px; --space-16: 64px;
}
```

### Motion tokens — unchanged

```css
:root {
  --ease-standard: cubic-bezier(0.22, 1, 0.36, 1);
  --duration-fast: 150ms;
  --duration-base: 300ms;
  --duration-slow: 600ms;
}
```

## Layout rules
- Max content width 1200px, centered, with responsive padding
  (`--space-4` mobile, `--space-8`+ desktop).
- One primary action per screen, visually dominant (`--color-accent`
  button, text in `--color-accent-ink`); secondary actions stay text-style
  or outlined, never competing for attention.
- The live "watch it write" streaming panel always gets its own visually
  distinct surface (`--color-surface`, with `--color-bg` inside it to read
  as inset) so it reads as "this is happening now," separate from static
  page chrome.
- A theme toggle is a small fixed control, 40px hit target, visible focus
  ring, `aria-pressed`. It lives in `app/layout.tsx` so it is reachable
  from every screen including the writing one.

## Button conventions

**Size variants — pick one of exactly three, never a custom in-between:**

| Variant | Height | Padding (h/v) | Font size | Use for |
|---|---|---|---|---|
| `sm` | 32px | `--space-3` / `--space-2` | `--text-sm` | inline/table actions, secondary controls in a toolbar |
| `md` | 40px | `--space-4` / `--space-3` | `--text-base` | default — most buttons on most screens |
| `lg` | 48px | `--space-6` / `--space-4` | `--text-lg` | the one primary action on a landing/onboarding screen |

Never mix two size variants for buttons that are peers in the same row
(e.g. "Cancel" and "Confirm" side by side must be the same variant).

**Style variants:**
- **Primary:** filled `--color-accent`, `--color-accent-hover` on
  hover, text in `--color-accent-ink`. `--duration-fast` transition.
  One per screen, per the layout rule above.
- **Secondary:** outlined or text-style, `--color-text` — for actions
  that matter but shouldn't compete with the primary action.
- **Destructive** (e.g. "reject and cancel publish"): `--color-danger`
  outline, filled only on explicit confirm step — never filled-red as the
  first click target, to avoid accidental destructive taps.
- **Disabled:** `--color-text-muted` on `--color-surface`, no hover
  state, `cursor: not-allowed` — always pair with a visible reason
  nearby (e.g. "Finish the outline first"), never a silently-disabled
  button with no explanation.

**Accessibility (non-negotiable, all variants, all sizes):**
- Every button has a visible focus ring — this product is used by
  first-time, possibly non-technical customers; do not sacrifice
  accessibility for aesthetics.
- Minimum touch target 40px (the `md`/`lg` variants clear this
  automatically; if `sm` is used anywhere touch-primary, pad its hit
  area to 40px even if the visible button stays smaller).

## Component-level rules

**Text inputs / forms** (sign-up, book prompt entry, ad budget entry):
- Height matches button `md` (40px) so inputs and buttons align in a row.
- Label above the field, `--text-sm`, `--color-text-muted`; never
  placeholder-only labels (accessibility and usability both fail once
  the field has a value).
- Error state: `--color-danger` border + one-line message below in
  `--text-sm`, appears/disappears without layout shift (reserve the
  space, don't push content down when an error appears).

**Cards** (book list items, cover variant options, ad-copy variants):
- Background `--color-surface`, `--space-4` internal padding, consistent
  corner radius across every card type in the product (pick one radius
  token, e.g. 12px, and reuse it — don't let cards drift to different
  roundness per screen).
- A card representing a selectable option (cover variant, voice option,
  ad-copy variant) gets a clear selected-state border in `--color-accent`
  — never rely on a checkmark icon alone, since it's easy to miss.
- Selected-state text on such a card stays `--color-text`; the accent
  carries the border, it does not repaint the whole card.

**Status badges/pills** (book status: draft/formatting/publishing/live;
approval status: pending/approved/rejected):
- Small, `--text-xs`, colored by meaning not decoration:
  `--color-text-muted` bg for draft/neutral, `--color-warning` for
  pending/in-progress, `--color-success` for live/approved,
  `--color-danger` for rejected/failed.
- **In-progress is `--color-warning`, not the accent.** Never use
  `--color-accent` for a status — see "the gold/amber rule" above. A
  pulsing dot is the affordance for "working", hue is not.
- Same status always uses the same color across every screen it
  appears on — a customer should never have to relearn what a color
  means between the dashboard and a detail page.

**Modals/confirmation dialogs** (publish confirmation, ad-spend approval,
account deletion):
- Reserved for genuinely blocking decisions only — don't use a modal for
  something that could be inline.
- Title `--text-lg`, body `--text-base`, action buttons `md` size,
  destructive/confirm action never pre-focused by default on an
  irreversible action (Constitution Article IV.6 — no accidental
  confirm via a stray Enter keypress).

**Toasts/inline notifications** (generation complete, save confirmed):
- Auto-dismiss only for non-critical confirmations; anything reporting a
  failure or requiring action stays until the customer dismisses it.

## GSAP motion conventions

### Tier 1 — everywhere (product screens included)
- Page-level entrance: fade + 12px upward translate, `--duration-base`,
  `--ease-standard`. Stagger children by 40-60ms, don't exceed 6 staggered
  items or it reads as slow rather than polished.
- The streaming text panel: no bounce/elastic easing — text appearing is
  itself the motion; don't animate on top of animation.
- Loading/generation states get a purposeful, branded animation (not a
  generic spinner) — this is the product's signature moment (Requirement
  5: customer watches their book being written), so it should feel
  intentional, not like a placeholder.

### Tier 2 — marketing pages only (NEVER the product)

**A heavy scroll-driven sequence belongs on the public landing page and
nowhere else.** The generate screen, settings and sign-in are places a
customer opens daily to do work. A pinned, scrubbed hero there costs scroll
performance on every single visit to buy an effect nobody wants twice. Tier 1
entrance/stagger only, on those screens.

The enforcement is structural, not a rule you have to remember: the scroll
hero lives in its own component that **only** `components/landing/landing.tsx`
imports. Putting a ScrollTrigger in the dashboard requires a deliberate import,
so it cannot happen by accident.

Rules for any Tier 2 scroll sequence:
- **Drive it with `gsap.matchMedia()` + one `ScrollTrigger` with `scrub`.**
  Never hand-roll a scroll listener — that causes full-page repaints and jank
  for the whole scroll duration. `scrub: <number>` (e.g. `0.8`) rather than
  `scrub: true`, so a fast flick glides instead of snapping.
- **Pin, then release.** `pin: true` for the sequence length, then normal page
  flow. A leftover pin-spacer or a jump after the last beat is a bug.
- **Never linear.** `power2.inOut` on transforms, `power1.out` on copy. `none` is
  the single biggest difference between premium and cheap.
- **Animate only `transform`, `opacity`, and CSS-variable gradients.** Never
  `width/height/top/left`, never animated `box-shadow` or `filter` on the pinned
  element. Add `will-change: transform` on pin-enter and remove it on unpin.
- **Beat structure:** each narrative beat gets a roughly fixed scroll distance
  so pacing is intentional. Map beats to explicit timeline positions rather than
  equal auto-spacing.
- `ScrollTrigger.refresh()` on `document.fonts.ready` — pin start depends on
  final text layout.
- `ScrollTrigger.config({ ignoreMobileResize: true })` so mobile browser-chrome
  show/hide doesn't thrash refreshes.
- **Never `ScrollTrigger.normalizeScroll()`** — it hijacks touch scrolling and
  breaks mobile.
- **Cleanup:** `gsap.context(fn, root)` + `ctx.revert()`, with
  `gsap.registerPlugin` *inside* the context. React 19 StrictMode double-mounts
  in dev; a trigger created outside the context survives cleanup and the
  animation runs twice per scroll.

### Reduced motion is a variant, not an absence

`prefers-reduced-motion: reduce` must produce a **designed static version**:
the same subject in its settled state (the book already open), the headline and
CTA visible immediately, the page at full height, and **no pin**.

Do not implement this as four separate hand-written
`window.matchMedia(...).matches` guards scattered across components — that is
what the project had before, and it does not scale to a timeline. One
`gsap.matchMedia()` branch per condition. A reduced-motion visitor must never
be left looking at an unpinned, half-animated subject they can't advance.

### Scroll and `overflow-x`

`html, body` must use `overflow-x: clip`, **not** `overflow-x: hidden`.
`overflow: hidden` on a root element promotes it to a scroll container and
breaks ScrollTrigger's pinning and measurement. `clip` clips without creating
one. Keep `max-width: 100vw` for the mobile horizontal-scroll guard.

## Review checklist (apply before calling any UI task done)
- [ ] Uses design tokens, no hard-coded hex/px/font-size values in the component
- [ ] Buttons use exactly one of the three size variants (sm/md/lg), consistent across peer buttons in the same row
- [ ] Works at 375px width (mobile) without horizontal scroll
- [ ] One clear primary action, visually dominant
- [ ] Status colors (badges, states) match their established meaning, not reinvented per screen
- [ ] Motion respects `prefers-reduced-motion`
- [ ] Focus states visible on every interactive element, minimum 40px touch target
- [ ] Any filled accent control sets its text/icon color to `--color-accent-ink`
- [ ] No `--color-accent` used to encode status (gold and amber are too close to tell apart)
- [ ] Any font-family token names a family that is actually loaded in `app/layout.tsx`
- [ ] Verified in **both** themes if it adds or changes a surface — not just dark
- [ ] A new theme re-measures every contrast pair rather than reusing another theme's steps
- [ ] No pinned/scroll-driven sequence outside the marketing pages
- [ ] Any `prefers-reduced-motion` path is a designed static variant, fully readable without scrolling
- [ ] Matches the tone from `AGENTS.md`/Support Chatbot instructions:
      approachable to a non-technical first-time author, not sterile-SaaS

## Known edge cases
- A destructive/irreversible action screen (e.g. the publish-confirmation
  step) intentionally breaks from "one dominant primary action" — here,
  cancel should be just as easy to find as confirm, since Constitution
  Article IV.6 requires this step to never feel like a rushed default.
- Dashboard states with zero books yet (new customer) need an explicit
  empty-state design, not just a blank page — this is the "convince the
  customer, remove fear" screen from the original requirements, so treat
  it as a first-class design surface, not an afterthought.