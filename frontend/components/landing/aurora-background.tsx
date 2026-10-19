/**
 * The ambient background: an aurora field behind the whole page.
 *
 * WHY THIS EXISTS: the page was a single flat ink colour from masthead to
 * footer, which is why it read as "boring" regardless of how good the type was.
 * Depth and colour interest have to come from somewhere, and doing it with
 * `background-image` on the body rather than images keeps it one paint and zero
 * requests.
 *
 * HOW IT IS BUILT, and why this exact technique:
 *
 * - **Blurred radial gradients, not a bitmap.** Three large radial gradients in
 *   accent-derived hues, blurred and scaled, drift slowly. A blurred gradient is
 *   rasterised once by the compositor and then only its transform changes, so the
 *   whole effect is transform+opacity work — which is what keeps it compatible
 *   with the "animate only transform and opacity" rule and cheap on a mid-range
 *   laptop.
 * - **Two wrapper layers, not one.** The outer layer drifts on a 26s cycle, the
 *   inner on a 19s one. Two out-of-phase periods beat any single period, because
 *   one loop that returns to its exact start every N seconds is visible as a
 *   "loop" the moment a visitor watches for more than a few seconds. Coprime-ish
 *   durations mean the combined state only repeats after ~8 minutes.
 * - **`will-change` is NOT used.** It would be the usual advice, but on a fixed
 *   full-viewport layer that is painted for the entire page session it pins a
 *   compositor layer and VRAM for no gain — the transform already promotes it
 *   for the duration of the animation.
 *
 * COLOUR: derived from `--color-accent` plus two companions, so the aurora
 * follows the brand token instead of hard-coding hex here. Three hues, not one,
 * is what stops it looking like a single tinted overlay.
 *
 * ACCESSIBILITY — this is decoration and is treated as such:
 * - `aria-hidden`, because it has no content.
 * - `pointer-events: none`, because an overlay that swallows a click on the CTA
 *   is a far worse bug than a missing background.
 * - `position: fixed`, so scrolling does not move it and it costs one paint
 *   rather than one per section.
 * - Fully suppressed under `prefers-reduced-motion: reduce` in CSS — the drift is
 *   exactly the kind of continuous unrequested movement that preference exists
 *   to stop. A still gradient is left behind, which keeps the colour benefit with
 *   none of the movement.
 *
 * It sits BEHIND everything (`z-index: -1`) and the page content is not given a
 * stacking context of its own, so nothing here can ever cover a control.
 *
 * SPEC: specs/005-visual-identity-scroll-hero/spec.md §25.
 */
export default function AuroraBackground() {
  return (
    <div className="aurora" aria-hidden="true">
      <div className="aurora-layer aurora-layer-a">
        <div className="aurora-field" />
      </div>
      <div className="aurora-layer aurora-layer-b">
        <div className="aurora-field" />
      </div>
      <div className="aurora-layer aurora-layer-c">
        <div className="aurora-field" />
      </div>
    </div>
  )
}
