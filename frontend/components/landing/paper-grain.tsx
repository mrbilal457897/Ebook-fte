/**
 * Paper grain: a fixed, non-interactive noise overlay that reinforces the
 * "paper" half of the paper-and-ink palette.
 *
 * LIGHT THEME ONLY, and that is not an oversight. Over the dark ink canvas a
 * noise overlay reads as a compression artefact; over cream it reads as paper
 * tooth. The CSS scopes it to `[data-theme="light"]` rather than this component
 * unmounting on theme change, so a theme toggle never costs a React render.
 *
 * `aria-hidden` because it is decoration with no content, and
 * `pointer-events: none` because an overlay that can swallow a click on the CTA
 * underneath it is a far worse bug than a missing texture.
 *
 * A tileable SVG `feTurbulence` data URI rather than a PNG: no binary asset to
 * ship or cache, and it scales to any DPR without a second file.
 *
 * Opacity is 3% (see `--grain-opacity` in globals.css). The brief asked for
 * roughly 2–4% and for the owner to see it before it is committed — it is
 * adjustable in one token, no code change.
 *
 * SPEC: specs/005-visual-identity-scroll-hero/spec.md §21.
 */
export default function PaperGrain() {
  return (
    <div className="paper-grain" aria-hidden="true">
      <svg className="paper-grain-svg" xmlns="http://www.w3.org/2000/svg">
        <filter id="paper-grain-noise">
          {/* fractalNoise at high frequency reads as fibre, not as static. */}
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#paper-grain-noise)" />
      </svg>
    </div>
  )
}
