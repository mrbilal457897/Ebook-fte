import { describe, expect, it } from "vitest"
import { MOTION, type MotionCleanup } from "../lib/motion/tokens"
import {
  accordionHeight,
  cardLift,
  countUp,
  fadeUp,
  magneticHover,
  navbarHideOnScroll,
  pageTransition,
  parallax,
  pinnedSection,
  splitHeading,
  staggerReveal,
  svgCheckDraw,
} from "../lib/motion/presets"
import { useMotion } from "../lib/motion"

/**
 * What this file protects, from `lib/motion/presets.ts`:
 *
 * 1. The tokens are exactly the values the spec named — a silent drift to a
 *    new duration or easing is a cross-page visual change nobody reviewed.
 * 2. Every preset is SSR-safe: it must return a cleanup without throwing
 *    when there is no `window`. Vitest runs in the node environment, so
 *    THIS environment IS the SSR case — if a preset touches the DOM first,
 *    this test is what catches it.
 * 3. The preset surface stays complete: a renamed export is a breaking
 *    change to every consumer, and this makes it a test failure.
 */

const PRESETS = {
  fadeUp: () => fadeUp(null),
  staggerReveal: () => staggerReveal(null),
  splitHeading: () => splitHeading(null),
  countUp: () => countUp(null, { to: 1 }),
  magneticHover: () => magneticHover(null),
  cardLift: () => cardLift(null),
  parallax: () => parallax(null),
  pinnedSection: () => pinnedSection(null),
  accordionHeight: () => accordionHeight(null, true),
  pageTransition: () => pageTransition(null, { mode: "in" }),
  navbarHideOnScroll: () => navbarHideOnScroll(null),
  svgCheckDraw: () => svgCheckDraw(null),
} satisfies Record<string, () => MotionCleanup>

describe("MOTION tokens", () => {
  it("matches the specified durations", () => {
    expect(MOTION.duration.fast).toBe(0.3)
    expect(MOTION.duration.base).toBe(0.6)
    expect(MOTION.duration.slow).toBe(1.0)
  })

  it("matches the specified easings", () => {
    expect(MOTION.ease.out).toBe("power3.out")
    expect(MOTION.ease.expo).toBe("expo.out")
  })

  it("keeps defaults inside the skill's established bands", () => {
    // Entrance rise: the Tier-1 "fade + 12px upward".
    expect(MOTION.rise).toBe(12)
    // Stagger: skill band is 40–60ms.
    expect(MOTION.stagger).toBeGreaterThanOrEqual(0.04)
    expect(MOTION.stagger).toBeLessThanOrEqual(0.06)
    // Magnetic pull: skill caps it at 6px.
    expect(MOTION.magnetMax).toBe(6)
    // Navbar: threshold 120px, travel guard 8px.
    expect(MOTION.navbarThreshold).toBe(120)
    expect(MOTION.navbarMinTravel).toBe(8)
  })
})

describe("presets during server rendering (no window)", () => {
  it.each(Object.keys(PRESETS))("%s returns a cleanup without throwing", (name) => {
    const cleanup = PRESETS[name as keyof typeof PRESETS]()
    expect(typeof cleanup).toBe("function")
    // And the cleanup itself must be safe to call with nothing to revert.
    expect(() => cleanup()).not.toThrow()
  })
})

describe("module surface", () => {
  it("exports every documented preset", () => {
    for (const name of Object.keys(PRESETS)) {
      expect(PRESETS[name as keyof typeof PRESETS]).toBeTypeOf("function")
    }
  })

  it("exports the useMotion hook as a function", () => {
    expect(useMotion).toBeTypeOf("function")
  })
})
