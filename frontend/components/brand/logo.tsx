/**
 * The brand mark.
 *
 * A WORDMARK ALONE WAS THE PROBLEM THIS SOLVES: the masthead previously carried
 * plain text reading "E-book FTE", which is indistinguishable from a browser tab
 * or a system message at a glance, and a brand with no mark has nothing to put
 * in the favicon, on an app tile, or on a social card.
 *
 * WHAT IT DEPICTS: an open book whose spine is the gold foil rule, with three
 * leaves fanned either side. It is the same object the hero's scroll animation
 * opens, so the mark and the hero's centrepiece are visibly the same idea rather
 * than two unrelated pieces of branding.
 *
 * WHY INLINE SVG AND NOT AN IMAGE FILE: it inherits `currentColor` for the ink
 * strokes, so it re-colours correctly in both themes and on the transparent
 * over-hero masthead with no second asset, no `onerror` fallback, and no extra
 * request. It also stays sharp at any size, which matters because this renders
 * at 28px in the masthead and 64px+ in the footer.
 *
 * `aria-hidden`: the adjacent link already has the accessible name "E-book FTE",
 * so announcing the mark too would make screen readers say the name twice.
 *
 * SPEC: specs/005-visual-identity-scroll-hero/spec.md §25.
 */

export default function Logo({
  size = 28,
  className = "",
}: {
  /** Rendered width AND height in px. The viewBox keeps it square. */
  size?: number
  className?: string
}) {
  return (
    <svg
      className={`brand-mark ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      {/*
        The page block. `fill` (not `stroke`) so it is a solid shape that reads
        at 28px — a hairline outline vanishes at favicon sizes, which is exactly
        where a logo has to survive.
      */}
      <path
        d="M16 8.5C13.2 6.4 9.8 5.6 6 6v16.4c3.8-.4 7.2.4 10 2.5V8.5Z"
        fill="currentColor"
        opacity="0.92"
      />
      <path
        d="M16 8.5c2.8-2.1 6.2-2.9 10-2.5v16.4c-3.8-.4-7.2.4-10 2.5V8.5Z"
        fill="currentColor"
        opacity="0.62"
      />

      {/*
        The gold foil spine. This is the whole accent budget of the mark: one
        rule down the centre, which is also what the SplitText reveal masks
        against on the headline. Two-tone rather than one flat silhouette is what
        makes it read as a bound book instead of an open document.
      */}
      <rect x="15.25" y="7.6" width="1.5" height="18" rx="0.75" fill="var(--color-accent)" />

      {/* Two leaf edges, fanned, so the silhouette is not a plain rectangle. */}
      <path d="M16 11.2 9.4 9.6" stroke="var(--color-accent)" strokeWidth="1" opacity="0.5" />
      <path d="M16 14.6 8.2 13.4" stroke="var(--color-accent)" strokeWidth="1" opacity="0.32" />
    </svg>
  )
}
