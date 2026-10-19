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
_consistency_; the brand decision has already been made.

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
  --color-ink: #121821; /* the canonical "ink" primitive */
  --color-bg: var(--color-ink);
  --color-surface: #1a212c;
  --color-surface-raised: #222b38;
  --color-border: #455163; /* decorative hairlines ONLY */
  --color-border-strong: #5d6a7d; /* 3.2:1 — control boundaries */
  --color-paper: #f3ebdc; /* cream; theme-independent */
  --color-paper-edge: #e4d8c3;
  --color-text: #efe7d6;
  --color-text-muted: #a8a79e;

  --color-accent: #c2a15a; /* THE one accent */
  --color-accent-hover: #c9a961;
  --color-accent-ink: #12181f; /* text ON an accent fill */
  --color-accent-deep: #7a5f17; /* accent on --color-paper */

  --color-success: #34d399;
  --color-warning: #fbbf24;
  --color-danger: #f87171;
}
```

Light theme is `[data-theme="light"]`, reached only by deliberate choice —
**never** via `prefers-color-scheme`. Warm paper base:

```css
:root[data-theme="light"] {
  --color-bg: #eae2d2;
  --color-surface: #f5efe3;
  --color-surface-raised: #fbf7ef;
  --color-border: #d8cdb7;
  --color-border-strong: #8c7c5c;
  --color-text: #1b222b;
  --color-text-muted: #5c5648;
  --color-accent: #6b5314;
  --color-accent-hover: #7a5f17;
  --color-accent-ink: #fbf7ef;
  --color-success: #157347; /* see "semantic colours are per-theme" */
  --color-warning: #8a5a08;
  --color-danger: #b3261e;
  /* --color-ink / --color-paper / --color-paper-edge /
     --color-accent-deep are NOT overridden — see below */
}
```

`--color-ink`, `--color-paper`, `--color-paper-edge` and
`--color-accent-deep` describe a **physical object** (a book: its board, its
paper, its foil), not a UI surface. They must not invert when the UI theme
does — a gold-foiled book does not turn lavender in light mode.

`--color-bg` is darker than `--color-surface` in _both_ themes. That is
deliberate: several panels paint `--color-bg` on top of `--color-surface` to
read as inset (the streaming panel, form inputs). Keep that relationship in
whatever theme you add, or those panels become paper-on-paper.

### Accent roles — which token for which job

| Token                  | Use it for                                             | Never use it for         |
| ---------------------- | ------------------------------------------------------ | ------------------------ |
| `--color-accent`       | accent text, accent borders, accent fills, focus rings | text on an accent fill   |
| `--color-accent-hover` | hover state of an accent fill                          | anything else            |
| `--color-accent-ink`   | **all** text/icons sitting on an accent fill           | text on a normal surface |
| `--color-accent-deep`  | accent text on `--color-paper`                         | anything else            |

`--color-accent-ink` exists because gold text on gold fill measures 1.4:1. Any
filled accent control **must** set its colour to `--color-accent-ink`. A gold
primary button has ink text, never cream.

Convenient property worth knowing: `--color-accent` is simultaneously
text-safe _and_ fill-safe in both themes (7.25 / 5.68 as text, 7.26 / 6.84 as a
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

A status never changes _meaning_ with the theme — only its step. If you add a
third theme you must add a third step and re-measure; do not reuse the dark
values on a light surface.

### Measured contrast, both themes

Verified with WCAG 2.1 relative luminance. Re-measure if any value changes.

| Pair                                          | Dark  | Light |
| --------------------------------------------- | ----- | ----- |
| `--color-text` on `--color-bg`                | 14.49 | 12.45 |
| `--color-text-muted` on `--color-bg`          | 7.37  | 5.66  |
| `--color-text-muted` on `--color-surface`     | 6.69  | 6.37  |
| `--color-accent` as text on `--color-bg`      | 7.25  | 5.68  |
| `--color-accent-ink` on `--color-accent` fill | 7.26  | 6.84  |
| `--color-ink` on `--color-paper`              | 15.07 | 15.07 |
| `--color-accent-deep` on `--color-paper`      | 5.10  | 5.10  |
| `--color-border-strong` on `--color-bg`       | 3.24  | 3.16  |

`--color-border` is below 3:1 on purpose — it is for decorative hairlines
between cards. Anything that is a **control boundary** (an input's edge, a
checkbox) uses `--color-border-strong` to clear WCAG 1.4.11.

### Typography

A serif display face for anything that should feel like a book, and a neutral
sans for actual interface chrome. The sans keeps forms, dashboards and buttons
usable; the serif is the _only_ literary voice, which is what makes it read as
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

Note: `next/font/google` fetches at _build_ time. An offline CI runner will
fail the build. The fallback is self-hosting woff2 under
`frontend/public/fonts/` with `@font-face`.

### Font-size scale (1.25 ratio, 16px base) — fixed steps unchanged, fluid display steps added

Use these, never a one-off px value inside a component:

```css
:root {
  --text-xs: 12px; /* helper text, timestamps, field hints */
  --text-sm: 14px; /* secondary body text, captions */
  --text-base: 16px; /* default body text */
  --text-lg: 20px; /* emphasized body, section labels */
  --text-xl: 25px; /* card/section headings */
  --text-2xl: 31px; /* page headings */
  --text-3xl: 39px; /* hero/landing headline only */
  --leading-tight: 1.2; /* headings */
  --leading-normal: 1.5; /* body text */

  /* Fluid display steps — MARKETING headings only (section titles, row
     titles, big proof numbers). `clamp` so they grow with the viewport
     instead of sitting small inside the 1200px container. Product UI
     (auth titles, app panel titles) keeps the fixed --text-* steps: a
     login card's heading must not reflow with the window width. */
  --display-lg: clamp(1.9375rem, 1.7rem + 1vw, 2.5rem); /* 31 → 40px */
  --display-md: clamp(1.5625rem, 1.42rem + 0.7vw, 2.125rem); /* 25 → 34px */

  /* Hero headline: 44px phone → 92px wide desktop */
  --hero-size: clamp(2.75rem, 1.2rem + 6.4vw, 5.75rem);
}
```

### Spacing scale (4px base) — unchanged

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
  --space-16: 64px;
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

### Radii and elevation

Four radii, three shadows — the whole vocabulary. Never invent a fifth
value in a component; if a real case appears, add it to `globals.css`
first and mirror it here.

```css
:root {
  --radius-xs: 4px; /* decorative tiles, focus-ring offsets */
  --radius-sm: 8px; /* controls: inputs, buttons, banners */
  --radius-md: 12px; /* cards and panels */
  --radius-pill: 999px;

  --shadow-nav: 0 8px 24px rgb(0 0 0 / 0.28); /* fixed masthead */
  --shadow-card: 0 12px 28px rgb(0 0 0 / 0.3); /* floating art/tiles */
  --shadow-hover: 0 10px 28px rgb(0 0 0 / 0.32); /* .hover-lift swap target */
}
```

Shadows are swapped, never animated (`transition` on `box-shadow`
repaints every frame). Book artwork — the scroll-book's own depth, the
cover tiles — may keep literal shadows: that is illustration, not UI
elevation.

## Component library (`frontend/components/ui/`)

Reusable primitives built on the tokens above — import them from
`@/components/ui` rather than re-building a button or a card per screen.
Their CSS lives in `frontend/app/components.css` (imported by
`app/layout.tsx`) and every class is namespaced `ui-`, so it cannot
collide with the legacy landing/auth/app classes.

**The button and field components EXTEND the existing `.btn-*` /
`.field-*` classes** (sizes `btn-sm`/`btn-md`/`btn-lg`, plus `.btn-ghost`
and `.btn-destructive`). Never introduce a second button system with a
different look.

Available: `Button` / `ButtonLink` (primary · secondary · ghost ·
destructive × sm · md · lg, with loading and solid-confirm states),
`Card` (default / selected / raised), `Container` / `Section`, `Navbar`
(sticky, mobile disclosure), `Footer`, `Input` / `Textarea` / `Select`
with inline validation, `Accordion`, `Badge` (status tones only where
meaning applies), `Modal` (focus trap, Escape, focus lands on the dialog —
never on a destructive button), `ToastProvider` + `useToast`
(auto-dismiss for info/success only), `Skeleton` / `SkeletonText`,
`Avatar`, `Rating`, `PricingCard`.

Preview every component and every state at **`/design-system`** —
internal, `noindex`, not linked from any product screen. Open it after
changing this library and review in both themes.

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

| Variant | Height | Padding (h/v)             | Font size     | Use for                                               |
| ------- | ------ | ------------------------- | ------------- | ----------------------------------------------------- |
| `sm`    | 32px   | `--space-3` / `--space-2` | `--text-sm`   | inline/table actions, secondary controls in a toolbar |
| `md`    | 40px   | `--space-4` / `--space-3` | `--text-base` | default — most buttons on most screens                |
| `lg`    | 48px   | `--space-6` / `--space-4` | `--text-lg`   | the one primary action on a landing/onboarding screen |

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

- Background `--color-surface`, `--space-4` internal padding, corner
  radius `--radius-md` for every card type in the product — don't let
  cards drift to different roundness per screen.
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

## Landing page chrome (marketing pages only)

Preloader, masthead behaviour, headline reveal and texture are **Tier 2** — they
exist on the public landing page and nowhere else. None of them are worth a
pinned hero's cost on a screen a customer opens daily.

### Preloader

- First load of a **session** only; `sessionStorage` marker so it never appears
  twice in one session, always inside `try/catch` — storage can be disabled and
  must not throw or strand the overlay.
- **≤1.2s typical, hard-capped at 1.5s.** Whichever comes first: assets ready, or
  the cap. A preloader that waits for assets on a slow connection is a worse
  failure than no preloader.
- **Fail open.** Any error resolves it exactly like the cap does. If JS never
  runs, the preloader was never painted — it must never be the only thing between
  the visitor and the page.

### Masthead over a pinned hero

- Transparent over the hero → solid `--color-surface` + subtle shadow past it,
  via `ScrollTrigger`. Never a raw scroll listener.
- Hide on scroll-down / show on scroll-up is **desktop + tablet only**
  (`min-width: 768px`). On mobile the bar stays fixed and solid: hide/show is
  fiddly on touch and not worth the complexity.
- Threshold **120px**, and require **≥8px of travel** before the direction test
  flips — otherwise trackpad jitter flickers the bar.
- A fixed bar over a pinned section fights the pin. Either the bar sits in flow
  (then it can't overlay or fade) or the pinned section reserves the bar's
  height. Don't try to do both.

### Headline reveal

`SplitText`, word-level, `--ease-standard`, **total ≤600ms including stagger**. A
repeat visitor re-running a slow hero is the failure mode.

**Revert the split when it finishes.** Left in place, `SplitText` wraps every word
in a `<div>`, which breaks Ctrl-F, text selection, and translation. The `<h1>`
must be plain text in the DOM once the animation is over.

Reduced motion: no split at all — the headline is visible from first paint.

### Micro-interactions

- **Magnetic buttons:** fine-pointer desktop only, `gsap.quickTo`, ≤6px offset,
  transform only. Gate on `(hover: hover) and (pointer: fine)` — never simulate
  it on touch — and disable under reduced motion.
- **Hover lift** (`translateY(-2px)` + shadow, `--duration-fast`,
  `--ease-standard`): define it **once** as a shared class. Re-declaring it per
  card type is how a "consistent" lift silently drifts apart across five screens.
- **No custom cursor.** Deliberately excluded: it degrades pointer precision and
  fights the native text cursor.

### Paper grain

Low-opacity tileable SVG noise (2–4%) on **light-theme surfaces only**
(`[data-theme="light"]`), reinforcing the paper feel. Over the dark ink canvas a
noise overlay reads as compression artefact, not paper.

Decorative → `aria-hidden="true"` and `pointer-events: none`, so it can never
intercept a click or be announced.

### Performance and accessibility budgets (non-negotiable)

- Animate `transform` and `opacity` **only**. Never `width/height/top/left/
margin`, never animated `box-shadow` or `filter` on a pinned or scrolled
  element — those force layout or repaint every frame and undo the whole point.
- **No layout shift.** CSS/SVG visuals need no aspect box; any `next/image` must
  be `sized`. Nothing above the fold blocks on a full-resolution bitmap.
- **Pinning must not trap focus or break tab order.** A pinned section's
  focusable elements are reachable before, during and after the pin, and unpinning
  restores normal flow without moving focus. Verify this; it does not follow from
  the pin working.
- Decorative animated elements are `aria-hidden="true"`.
- **Reduced motion is a variant for the whole page, not just the hero.** Every
  looping or revealing section shows its finished state. A section left
  mid-animation or hidden at `opacity: 0` is a bug.
- **`opacity: 0` is never the only thing hiding content.** The default, pre-JS
  state must be readable — so a screen reader never meets an invisible headline,
  and a failed script never leaves a CTA permanently hidden.

## GSAP motion conventions

### Plugins: what we have, and where they get registered

**GSAP is 100% free, including the former Club-GreenSock plugins.** Webflow's
acquisition made every plugin free at **3.13**; the project pins `gsap@3.15.0`,
so `SplitText` and `ScrollSmoother` ship in the package under the standard
licence. There is no Club membership to buy and no licence gate to check before
using them.

**`ScrollSmoother` is still excluded, on performance grounds, not licensing.** It
replaces the browser's scroll container with a transform-driven one: it needs a
fixed wrapper, breaks in-page anchor scrolling, interferes with keyboard focus
scrolling, and costs frames on top of `scrub`. Use native scrolling with a
numeric `scrub` — that already produces the inertia a smoother would.

**Register plugins once, in `frontend/lib/gsap-setup.ts`.** Importing that module
registers them. No component calls `gsap.registerPlugin` for a shared plugin —
registering per-component is how you end up with the same plugin registered
twice and no idea which registration took effect.

The "register inside `gsap.context`" rule below is about trigger _creation_, not
plugin registration: `gsap.context(fn, root)` + `ctx.revert()` is what tears down
triggers, and a trigger created outside a context is never cleaned up.

### The motion module — `frontend/lib/motion/`

All reusable animation lives here. Pages import presets from `@/lib/motion`;
they do not hand-build a tween for a common job.

- **Tokens (`MOTION`):** durations `fast 0.3 / base 0.6 / slow 1.0` seconds;
  easings `power3.out` (house default — the GSAP twin of CSS
  `--ease-standard`) and `expo.out` (draws, counters). GSAP durations do NOT
  map onto the CSS `--duration-*` steps: CSS `fast` (150ms) is hover-only,
  entrances start at 300ms — one full step slower by design, in
  `tokens.ts`.
- **Presets:** `fadeUp`, `staggerReveal`, `splitHeading`, `countUp`,
  `magneticHover`, `cardLift`, `parallax`, `pinnedSection`,
  `accordionHeight`, `pageTransition`, `navbarHideOnScroll`, `svgCheckDraw`.
  The contract each follows is documented at the top of `presets.ts`:
  SSR-safe no-op; gated by `gsap.matchMedia(MOTION_ALLOWED_MQ)` (never an
  inline `matches` read, so a mid-session preference flip reverts cleanly);
  returns a `MotionCleanup`; transform/opacity only, with two paint-only
  documented exceptions (`strokeDashoffset` on SVG draws, textContent
  counters — neither touches layout); content stays visible whenever JS is
  absent or motion is reduced.
- **React wrapper:** `useMotion(scope, (q, root) => {…}, deps)` — one
  `gsap.context` per call. Unmount (route change) or a `deps` change reverts
  every tween and ScrollTrigger together, so duplicate triggers cannot
  survive a navigation. Return a cleanup from the setup for raw event
  listeners. `q()` scopes selectors inside the root. The `deps` array is the
  update contract (`[runId]` to replay, `[]` to set up once); the setup
  function itself is deliberately not a dependency.
- **Presets called from event handlers** (outside the effect) must keep the
  returned cleanup and run it before re-creating — see the exit button in
  `/motion-demo`. `contextSafe` does not exist without `gsap/react`, which
  this package does not ship.
- **Demo:** every preset, one card each, at **`/motion-demo`** (internal,
  `noindex`, not linked from product screens). Open it after changing the
  module and check the reduced-motion badge flips with the OS setting.

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
  `gsap.registerPlugin` _inside_ the context. React 19 StrictMode double-mounts
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
- [ ] Reduced motion covers **every** section, not just the hero — nothing left mid-animation or hidden
- [ ] Animations touch only `transform`/`opacity`; no layout-animating property, no animated `box-shadow`/`filter`
- [ ] Plugins registered in `lib/gsap-setup.ts`, not per component
- [ ] Reusable motion comes from `lib/motion` presets + `useMotion` — no
      hand-rolled tween, ScrollTrigger or scroll listener per screen
- [ ] Any `SplitText` use is reverted after it plays — the heading is plain text in the DOM
- [ ] Pinned section doesn't trap focus or break tab order (verified, not assumed)
- [ ] Decorative/animated decoration is `aria-hidden`; texture overlays are `pointer-events: none`
- [ ] No page-level overlay can block content if JS or storage fails (fail open)
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
