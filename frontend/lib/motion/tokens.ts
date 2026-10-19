/**
 * Motion tokens for the GSAP layer — the one place durations and easings are
 * spelled out. Components and pages import `MOTION`; they never type
 * `0.6` or `"power3.out"` inline.
 *
 * RELATIONSHIP TO THE CSS TOKENS (globals.css):
 *
 *   CSS  --duration-fast 150ms   --duration-base 300ms   --duration-slow 600ms
 *   GSAP MOTION.fast     0.3s    MOTION.base     0.6s    MOTION.slow     1.0s
 *
 * They deliberately do not map one-to-one. The CSS steps are for
 * micro-interactions (hover, focus, colour) where anything above ~150ms feels
 * sluggish. The GSAP steps are for entrances and choreography, where 150ms
 * reads as a flicker rather than a movement — the two systems share a name
 * space but not a scale, and neither borrows the other's values.
 *
 * Easings: two, on purpose. `power3.out` is the house default — it is the
 * GSAP equivalent of the CSS `--ease-standard` curve
 * (cubic-bezier(0.22, 1, 0.36, 1)), so a GSAP entrance and a CSS transition
 * decelerate identically. `expo.out` is for one-shot "settling" moments
 * (drawn checks, counters) where a longer, softer tail is wanted.
 */

/** Everything a preset needs to know about timing lives here. */
export const MOTION = {
  /** Shortest entrance. Hover-scale, exit fades, split-part reveals. */
  duration: {
    fast: 0.3,
    /** Default entrance and preset duration. */
    base: 0.6,
    /** Long, deliberate moments only — counters, hero beats. */
    slow: 1.0,
  },
  ease: {
    /** House default; identical curve to CSS `--ease-standard`. */
    out: "power3.out",
    /** Settling moments: draw-ons, counts arriving. */
    expo: "expo.out",
  },
  /** Entrance rise, px. Matches the skill's Tier-1 "fade + 12px upward". */
  rise: 12,
  /** Default child stagger, seconds. Skill band is 40–60ms. */
  stagger: 0.05,
  /** Magnetic hover clamp, px. Skill: max ±6px. */
  magnetMax: 6,
  /** Card lift distance, px (negative = up). */
  liftY: -6,
  /** Navbar: hide only after scrolling this far down, px. */
  navbarThreshold: 120,
  /** Navbar: minimum scroll travel before a hide/show flip, px. */
  navbarMinTravel: 8,
} as const

/**
 * Every preset returns this. Call it in a cleanup (or return it from a
 * `useMotion` setup function) to kill its tweens, ScrollTriggers and
 * listeners. Calling it twice is safe.
 */
export type MotionCleanup = () => void
