---
name: ebook-fte-design-system
description: Applies the sticker-poster visual system used throughout the E-book FTE frontend: cream paper, ink outlines, blue/coral/yellow/mint accents, Bricolage Grotesque and DM Mono typography, hard offset shadows, responsive layout, visible focus, and reduced-motion rules. Use for any visible page/component design or review in frontend/. Do not use for backend, agents, APIs, or data-layer work.
---

# E-book FTE design system

Use this skill whenever changing a visible frontend surface. The product uses
one light-only sticker-poster system across the marketing page, sign-in/up,
generation workspace, settings, and shared UI library.

## Source files

- Global tokens and product surfaces: `frontend/app/globals.css`.
- Reusable components: `frontend/app/components.css` and `frontend/components/ui/`.
- Landing-only sections: `frontend/app/landing-poster.css` and
  `frontend/components/landing/`.
- Token/component preview: `frontend/app/design-system/`.

Keep token values in CSS custom properties. Do not add Tailwind, CSS-in-JS,
CSS modules, or new styling dependencies without an explicit request.

## Palette

```css
:root {
  --paper: #fff6e6;
  --ink: #111111;
  --blue: #2b2bff;
  --coral: #ff5a36;
  --yellow: #ffd23f;
  --mint: #3ddc97;
  --white: #ffffff;
}
```

- Use ink text on paper, white, coral, yellow, and mint.
- Use white text on blue. Never use white text on coral, yellow, or mint.
- Muted text must remain at least 4.5:1 against its surface.
- Status colors communicate status; decorative accents do not replace status.
- The app is light-only. Do not add `data-theme`, dark-mode tokens, or a theme
  toggle without a new explicit design decision.

## Type

- **Bricolage Grotesque** is display and body, loaded through `next/font/google`
  in `app/layout.tsx`.
- **DM Mono** is for uppercase labels, pills, metadata, and compact captions.
- **Literata** is reserved for long-form generated manuscript prose.
- Display headlines use weight 800, tight leading, and negative tracking.
- Labels use DM Mono 500, uppercase, and approximately `.08em` letter spacing.
- Body copy is 17–21px on marketing surfaces with 1.5 line height.

Only name a font family in CSS if `layout.tsx` loads it.

## Shape, borders, and elevation

- Border: `2.5px solid var(--ink)` for cards, buttons, and controls.
- Radius: buttons 14px; cards/large blocks 26px; pills 999px; small tiles 6px.
- Shadows are solid hard offsets, never blurred: 4px small, 5px button, 7px
  card, 10px hero-level. Use the tokens in `globals.css`.
- Fills are flat and saturated. Do not use gradients, blur, or glassmorphism.
- Buttons are at least 44px in product UI and 52px for landing CTAs; pressed and
  hover states use small transforms and offset-shadow changes.

## Accessibility and motion

- Use semantic landmarks and one `h1` per page.
- Every control needs a visible `:focus-visible` ring (3px blue with offset;
  choose ink for controls on blue surfaces).
- Keep touch targets at least 44×44px.
- Maintain WCAG AA text contrast (4.5:1); do not rely on color alone for status.
- Respect `prefers-reduced-motion: reduce`: remove floats, caret blinking,
  entrance motion, and transitions. Content must remain visible without JS.
- Use only transform/opacity for optional motion. No parallax, scroll-jacking,
  or pinned/scrubbed landing sections.

## Responsive layout

- Verify 360, 768, 1024, and 1440px widths.
- Prevent horizontal scrolling; grids should collapse in DOM order.
- Menus/accordions must be keyboard-operable and expose their expanded state.
- Keep every existing route, anchor, and `?tenant=` parameter threaded through
  links that lead to home, sign-in, or sign-up.

## Shared UI and honesty

- Prefer the existing components in `components/ui/` over one-off variants.
- Use the pricing and product claims already present in the product spec; do not
  invent prices, testimonials, customer numbers, or guarantees.
- Publishing copy must say the system prepares/validates files and the author
  presses Publish. Do not imply that the product submits books automatically.
- Keep auth, billing, generation, and API behavior unchanged during visual work.

## Verification

Before finishing a visible UI change, run:

```text
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Then inspect responsive widths, keyboard focus, reduced motion, color contrast,
and route/tenant-link preservation.
