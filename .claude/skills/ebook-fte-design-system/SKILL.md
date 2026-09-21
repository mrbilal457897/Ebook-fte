---
name: ebook-fte-design-system
description: Applies and enforces this project's UI/UX design system — color theme, typography, spacing, button styles, page layout patterns, and GSAP motion conventions — when building or modifying any page, component, or screen in the frontend/ Next.js app. Use when the task involves creating a new page or component, redesigning an existing one, choosing colors/fonts/spacing, adding animation or transitions, or reviewing UI work for consistency with the rest of the product. Do NOT use for backend logic, agent instructions, database work, or any task that doesn't touch what the customer visually sees.
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
- Any review pass on a just-built page or component before calling it done

## When this does NOT fire
- Backend agent instructions, MCP servers, database schema, billing logic
- Anything in `agents/` — that's ADK instruction work, not UI

## Design tokens (edit here, not per-component)

Keep these as CSS custom properties in one file
(`frontend/app/globals.css` or equivalent), never hard-coded inline in a
component:

```css
:root {
  /* Color — confirm/replace with the project's actual chosen palette
     before first use; these are placeholders, not a final decision */
  --color-bg: #0b0d12;
  --color-surface: #14171e;
  --color-primary: #6d5efc;
  --color-primary-hover: #8274ff;
  --color-text: #eef0f4;
  --color-text-muted: #9aa0ac;
  --color-success: #34d399;
  --color-warning: #fbbf24;
  --color-danger: #f87171;

  /* Typography */
  --font-display: "General Sans", ui-sans-serif, system-ui, sans-serif;
  --font-body: "Inter", ui-sans-serif, system-ui, sans-serif;

  /* Font-size scale (1.25 ratio, 16px base) — use these, never a
     one-off px value inside a component */
  --text-xs: 12px;    /* helper text, timestamps, field hints */
  --text-sm: 14px;    /* secondary body text, captions */
  --text-base: 16px;  /* default body text */
  --text-lg: 20px;    /* emphasized body, section labels */
  --text-xl: 25px;    /* card/section headings */
  --text-2xl: 31px;   /* page headings */
  --text-3xl: 39px;   /* hero/landing headline only */
  --leading-tight: 1.2;   /* headings */
  --leading-normal: 1.5;  /* body text */

  /* Spacing scale (4px base) */
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-6: 24px; --space-8: 32px; --space-12: 48px; --space-16: 64px;

  /* Motion */
  --ease-standard: cubic-bezier(0.22, 1, 0.36, 1);
  --duration-fast: 150ms;
  --duration-base: 300ms;
  --duration-slow: 600ms;
}
```

**Before first real use:** confirm the actual palette/fonts with the
project owner rather than shipping these placeholders as final — this
Skill enforces *consistency*, it doesn't make the one-time brand decision
for you.

## Layout rules
- Max content width 1200px, centered, with responsive padding
  (`--space-4` mobile, `--space-8`+ desktop).
- One primary action per screen, visually dominant (`--color-primary`
  button); secondary actions stay text-style or outlined, never competing
  for attention.
- The live "watch it write" streaming panel always gets its own visually
  distinct surface (`--color-surface`) so it reads as "this is happening
  now," separate from static page chrome.

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
- **Primary:** filled `--color-primary`, `--color-primary-hover` on
  hover, `--duration-fast` transition. One per screen, per the layout
  rule above.
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
  ad-copy variant) gets a clear selected-state border in `--color-primary`
  — never rely on a checkmark icon alone, since it's easy to miss.

**Status badges/pills** (book status: draft/formatting/publishing/live;
approval status: pending/approved/rejected):
- Small, `--text-xs`, colored by meaning not decoration:
  `--color-text-muted` bg for draft/neutral, `--color-warning` for
  pending/in-progress, `--color-success` for live/approved,
  `--color-danger` for rejected/failed.
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
- Page-level entrance: fade + 12px upward translate, `--duration-base`,
  `--ease-standard`. Stagger children by 40-60ms, don't exceed 6 staggered
  items or it reads as slow rather than polished.
- The streaming text panel: no bounce/elastic easing — text appearing is
  itself the motion; don't animate on top of animation.
- Respect `prefers-reduced-motion`: every GSAP timeline checks it and
  either skips or drastically shortens duration. This is not optional.
- Loading/generation states get a purposeful, branded animation (not a
  generic spinner) — this is the product's signature moment (Requirement
  5: customer watches their book being written), so it should feel
  intentional, not like a placeholder.

## Review checklist (apply before calling any UI task done)
- [ ] Uses design tokens, no hard-coded hex/px/font-size values in the component
- [ ] Buttons use exactly one of the three size variants (sm/md/lg), consistent across peer buttons in the same row
- [ ] Works at 375px width (mobile) without horizontal scroll
- [ ] One clear primary action, visually dominant
- [ ] Status colors (badges, states) match their established meaning, not reinvented per screen
- [ ] Motion respects `prefers-reduced-motion`
- [ ] Focus states visible on every interactive element, minimum 40px touch target
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