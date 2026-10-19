/**
 * One place that answers "may this page move things?", and one query string
 * that every GSAP `matchMedia` branch is built from.
 *
 * This module exists because the answer was previously spelled out six times
 * across five components, in two different idioms — four branches opted IN with
 * `(prefers-reduced-motion: no-preference)` and two opted OUT with
 * `(prefers-reduced-motion: reduce)`. Those two forms disagree on a browser that
 * reports neither (some older engines, and any environment where the media query
 * is unsupported): the opt-in form silently disables motion, the opt-out form
 * silently enables it. A visitor's motion preference is an accessibility
 * contract, so the contract lives here, is asserted in
 * `tests/motion-preference.test.ts`, and is referenced rather than retyped.
 *
 * THE INVARIANT: `prefersReducedMotion()` must return `true` whenever the user
 * has NOT explicitly asked for motion. An unknown, missing, or throwing
 * environment fails toward less movement. That is the whole reason this is a
 * function with a default rather than a media query string read inline — an
 * unrecognised environment gets `reduce`, not `no-preference`.
 *
 * No GSAP import: this must stay usable, and testable, without a DOM.
 */

/**
 * The only reduced-motion query string in the codebase. Use it when building a
 * GSAP `matchMedia` condition:
 *
 *     mm.add(`${MOTION_ALLOWED_MQ} and (min-width: 768px)`, () => { ... })
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
 */
export const REDUCED_MOTION_MQ = "(prefers-reduced-motion: reduce)"

/**
 * Condition for code that should run ONLY when motion is welcome. Handing it to
 * `gsap.matchMedia().add()` is what makes the animation teardown automatic —
 * GSAP reverses the tween and removes the ScrollTrigger itself when the
 * preference flips mid-session, which no amount of manual listener cleanup
 * achieves.
 */
export const MOTION_ALLOWED_MQ = `(prefers-reduced-motion: no-preference)`

/**
 * Whether this visitor has asked for reduced motion.
 *
 * Returns `true` when motion must not be assumed — including when
 * `matchMedia` is missing or throws. Callers that need the inverse should use
 * `MOTION_ALLOWED_MQ` with `gsap.matchMedia()` rather than negating this, so
 * that a preference change is picked up live instead of only at mount.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    // SSR, or an environment without the API. No preference was expressed, and
    // the safe reading of "we do not know" is "do not move things".
    return true
  }

  try {
    return window.matchMedia(REDUCED_MOTION_MQ).matches
  } catch {
    return true
  }
}
