# Slice 005 — Visual identity + scroll-book hero: research

**Date:** 2026-10-03
**Question this slice had to answer first:** what does the product actually
look like today, and which parts of the UI are load-bearing enough that a
visual redesign must be a token swap rather than a rewrite?

Findings below were verified against the working tree on 2026-10-03, not
recalled. Where a number is quoted it was measured, not estimated.

## The current identity is placeholders, and the fonts never loaded

`frontend/app/globals.css:16-17` declares:

```css
--font-display: "General Sans", ui-sans-serif, system-ui, -apple-system, sans-serif;
--font-body:    "Inter",        ui-sans-serif, system-ui, -apple-system, sans-serif;
```

`frontend/app/layout.tsx:2-13` loads **Geist** and **Geist_Mono** as
`--font-geist-sans` / `--font-geist-mono`. A search of every `.tsx` and
`globals.css` for `geist` or `mono` returns nothing.

So neither declared family is loaded, and the loaded pair is never referenced.
**Every screen in the product has been rendering in `system-ui`.** This is a
live bug, not a taste question, and it is why the redesign must load real
fonts through `next/font` rather than only editing token values.

The `Skill` that governs this (`ebook-fte-design-system`) still says *"confirm
the actual palette/fonts with the project owner rather than shipping these
placeholders as final."* That instruction is now answered and should be
replaced by the confirmed palette, or the next session will re-ask.

## GSAP ScrollTrigger is already available, and it is free-tier

`frontend/package.json:17` pins `"gsap": "3.15.0"`. `ScrollTrigger` has never
been a Club plugin; only `SplitText`, `MorphSVGPlugin`, `ScrollSmoother` and
friends are, and those are present in this install too.

Resolution is explicit in `node_modules/gsap/package.json`:

```json
"./*": { "import": "./*.js", "require": "./dist/*.js", "types": "./types/*.d.ts" }
```

That wildcard is why `gsap/ScrollTrigger` resolves even though there is no
literal `"./ScrollTrigger"` key. The `types` target is subtly wrong —
it resolves to `types/ScrollTrigger.d.ts`, but the file on disk is
`types/scroll-trigger.d.ts` (kebab-case). This does **not** break the import:
`types/scroll-trigger.d.ts` declares an ambient module:

```ts
declare module "gsap/ScrollTrigger" { ... }
```

and `types/index.d.ts:33` pulls it in with
`/// <reference path="scroll-trigger.d.ts"/>`. Loading `gsap` loads the
reference, which satisfies the subpath import under `strict`. Verified by
reading the shipped `.d.ts`, not assumed.

**Consequence:** the signature hero needs no new dependency. AGENTS.md §5
requires exact pinning for UI-critical packages; adding nothing is the
strongest possible compliance.

## `overflow-x: hidden` on a root element will fight ScrollTrigger

`globals.css:47-50`:

```css
html, body { max-width: 100vw; overflow-x: hidden; }
```

`overflow: hidden` on `html` or `body` promotes that element into a scroll
container, which changes how ScrollTrigger measures and pins. The safe
equivalent is `overflow-x: clip`, which clips the overflowing axis without
creating a scroll container. This must change before any pin is added, or the
pin will be measured against the wrong scroller and jump.

`max-width: 100vw` is kept — it is what actually prevents horizontal scroll on
mobile once `clip` is in place.

## The token architecture is more theme-ready than it looks

Every colour in the product is referenced through a custom property; there is
not one raw hex value in any `.tsx`. That makes the redesign a token swap.

The one pattern worth checking was the "sunken" background. Several panels sit
on a surface and paint a darker background to read as inset:

- `.stream-panel { background: var(--color-bg) }` inside `.app-panel { background: var(--color-surface) }`
- `.field-input` / `.textarea-input { background: var(--color-bg) }` inside `.auth-card { background: var(--color-surface) }`

This was expected to break under a light theme (paper-on-paper). It does not,
because the proposed light theme keeps the same relationship — light `--color-bg`
(`#EAE2D2`) is darker than light `--color-surface` (`#F5EFE3`), exactly as dark
`#121821` is darker than dark `#1A212C`. **No change is required here.** Worth
recording so a future reader does not "fix" a pattern that is already correct.

## `@media (prefers-color-scheme: light)` is a no-op trap

`globals.css:213-217`:

```css
@media (prefers-color-scheme: light) { :root { color-scheme: light; } }
```

This sets native form-control and scrollbar rendering to light but changes **no
tokens**. On a light-OS machine the browser therefore paints light form
controls and a light scrollbar onto a dark page. It looks like a theme switch
and is not one.

Decision: remove it. Dark is the default and light is opted into deliberately
via `[data-theme="light"]`, so the brand never changes because of an OS setting
the customer did not choose. `color-scheme` follows the active theme instead.

## `prefers-reduced-motion` is only half-implemented

`globals.css:646-650` handles reduced motion as:

```css
@media (prefers-reduced-motion: reduce) { * { transition-duration: 0.01ms !important; } }
```

That neutralises CSS transitions but says nothing about JS animation. The
existing GSAP entrances each re-check the query themselves
(`landing.tsx:33`, `generate-shell.tsx:17`, `auth-shell.tsx:17`,
`settings/page.tsx:67`) — so entrance motion is currently covered by four
separate hand-written guards, not by the stylesheet.

That scattered approach does not scale to a pinned, scrubbed timeline, and it is
the wrong place to enforce an accessibility guarantee. `gsap.matchMedia()` gives
one declarative branch per condition and guarantees the still variant is a real
variant rather than an absence.

## Accent choice: gold, and the collision it creates

Constraint from the project owner: exactly one accent from classic book-cover
territory, not a second one. Muted gold `#C2A15A` was chosen over burgundy and
forest green.

**The cost, stated plainly:** `--color-warning` is `#fbbf24` — amber. Gold and
amber are adjacent hues at similar lightness. The current palette does not have
this problem because the accent was purple. So gold may not be allowed to
encode status.

Two consequences, both structural rather than cosmetic:

1. `--color-primary` today means both "brand emphasis" and "working state"
   (`.status-dot.is-working`, `.allowance-pill.is-working .dot`). In-progress
   must move to `--color-warning`, which is what the design-system Skill
   already demands: *"colored by meaning not decoration."*
2. The Skill must state the rule so gold-as-status is never reintroduced.

## Contrast, measured

WCAG 2.1 relative luminance, computed rather than eyeballed.

**Dark** (default) — ink navy base, cream text, gold accent:

| Pair | Ratio | Verdict |
|---|---|---|
| `#EFE7D6` text on `#121821` bg | 14.49 | pass AAA |
| `#A8A79E` muted on `#121821` | 7.37 | pass AAA |
| `#A8A79E` muted on `#1A212C` surface | 6.69 | pass AA |
| `#C2A15A` accent on `#121821` | 7.25 | pass AAA |
| `#12181F` accent-ink on `#C2A15A` fill | 7.26 | pass AAA |
| `#12181F` ink on `#F3EBDC` paper | 15.07 | pass AAA |
| `#7A5F17` accent-deep on `#F3EBDC` paper | 5.10 | pass AA |
| `#455163` border on `#1A212C` | 2.01 | decorative only |
| `#5D6A7D` border-strong on `#121821` | 3.24 | pass WCAG 1.4.11 |
| `#34d399` / `#fbbf24` / `#f87171` on bg | 9.27 / 10.68 / 6.44 | pass |

**Light** (`[data-theme="light"]`) — warm paper base:

| Pair | Ratio | Verdict |
|---|---|---|
| `#1B222B` text on `#EAE2D2` bg | 12.45 | pass AAA |
| `#5C5648` muted on `#EAE2D2` | 5.66 | pass AA |
| `#6B5314` accent on `#EAE2D2` | 5.68 | pass AA |
| `#FBF7EF` accent-ink on `#6B5314` fill | 6.84 | pass AA |
| `#8C7C5C` border-strong on `#EAE2D2` | 3.16 | pass WCAG 1.4.11 |

### The one unavoidable deviation

Instructed to keep `--color-success/warning/danger` unchanged. Measured on the
light theme's own background:

| Token | On light bg | On light surface |
|---|---|---|
| `#34d399` success | **1.58** | 1.77 |
| `#fbbf24` warning | **1.37** | 1.53 |
| `#f87171` danger | **2.27** | 2.54 |

These were chosen for a near-black canvas. On cream they are not merely weak,
they are close to invisible — a mint-green "Live" badge at 1.58:1. Shipping a
light theme with them untouched is not possible.

Resolution: **the dark-theme values stay byte-identical.** The light theme
declares its own steps of the same three hues, all above 4.5:1:

| Light-theme token | Value | On bg | On surface |
|---|---|---|---|
| `--color-success` | `#157347` | 4.56 | 5.13 |
| `--color-warning` | `#8A5A08` | 4.60 | 5.17 |
| `--color-danger` | `#B3261E` | 5.08 | 5.71 |

Same meaning, same hue family, legible on its own background. Semantic meaning
never changes with theme; only its step does.

## Accent needs four tokens, not two, and only because of the fill

`.btn-primary` is `background: var(--color-primary); color: var(--color-text)`.
A gold fill under cream body text is **not** legible — it is 1.4:1. So the text
colour on an accent fill has to be its own token that flips per theme:

| Token | Dark | Light | Role |
|---|---|---|---|
| `--color-accent` | `#C2A15A` | `#6B5314` | the accent itself |
| `--color-accent-hover` | `#C9A961` | `#7A5F17` | hover fill |
| `--color-accent-ink` | `#12181F` | `#FBF7EF` | text/icon **on** an accent fill |
| `--color-accent-deep` | `#7A5F17` | `#7A5F17` | accent on `--color-paper` |

`--color-accent-deep` is the one token that does not flip: `--color-paper` is a
physical constant in both themes, so the accent step for it is fixed.

Convenient property, and the reason this stays four tokens rather than six:
`--color-accent` is simultaneously text-safe **and** fill-safe in both themes
(7.25 / 5.68 as text, 7.26 / 6.84 as a fill with its `accent-ink`). Only the ink
flips.

## Typography

- **Literata** — the serif Google ships for long-form reading in Play Books. It
  was chosen over Fraunces because the display face is not only the hero:
  `.app-title` uses it at `--text-xl` (25px) and `.landing-step-title` at
  `--text-lg` (20px). Fraunces is stronger at hero scale but turns busy below
  ~32px, and the product needs this face on working screens.
- **Inter** — high x-height and unambiguous glyphs at 12–16px, so forms, the
  dashboard and the streaming panel stay neutral. The serif is the only literary
  voice in the product, which is what makes it read as deliberate rather than
  twee. Per the Skill's rule it is never used for dense UI text.

Both self-hosted through `next/font/google`, so there is no layout shift and no
render-blocking request to a third party.

**Build caveat, measured:** `next/font/google` fetches from
`fonts.googleapis.com` at build time. On this machine it answers HTTP 200 and
`frontend/.next` already holds cached Geist woff2 files, so builds work. An
offline or firewalled CI runner would fail the build. Fallback if that becomes
real: self-host the woff2 files under `frontend/public/fonts/` with `@font-face`.

## Why the hero is marketing-only, and how that gets enforced

The product's daily surfaces are the generate screen, settings and sign-in — the
book list does not exist yet. A pinned scrubbed hero in those places would cost
scroll performance on every visit to buy an effect nobody asked for twice.

So the rule is scoped in the Skill, and the hero is built as a component that
only the landing page imports. Isolation is the enforcement: there is no way to
accidentally put a ScrollTrigger in the dashboard without a deliberate import.

## What the landing page can afford

`components/landing/landing.tsx` currently runs three `gsap.from()` entrance
tweens on load (hero, steps, features) and is the only page with any structural
motion. Replacing its static hero block with the pinned sequence is a
localised change; the rest of that file stays.

The existing pattern to follow is `gsap.context(fn, root)` with `ctx.revert()`
on unmount, used in four components already. React 19 StrictMode double-mounts
in development, so a ScrollTrigger must be created **inside** the context
function — otherwise a duplicate trigger survives cleanup and the animation runs
twice per scroll.

## Test impact: none

`frontend/tests/` holds 9 files, 59 tests. Every one imports from `app/api/…/route`
or `lib/…`. **No test imports a component and none asserts on a hex value, a
font name, or a CSS class.** The redesign therefore cannot regress the suite;
`npm run lint` / `npm run test` / `npm run format:check` are still run as a gate,
but a red result cannot be blamed on styling.

`.claude/skills/` was checked for coupling to the design tokens: only
`ebook-fte-design-system` references them. No other Skill reads a hex value,
font name, or class name, and `skills-lock.json` pins only the vendored
`skill-creator`, so editing the design-system Skill breaks no integrity hash.