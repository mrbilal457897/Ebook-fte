import { afterEach, describe, expect, it, vi } from "vitest"
import {
  MOTION_ALLOWED_MQ,
  REDUCED_MOTION_MQ,
  prefersReducedMotion,
} from "../lib/motion-preference"

/**
 * The accessibility contract this file protects, from
 * `lib/motion-preference.ts`:
 *
 *   motion is only ever assumed when the visitor has EXPLICITLY not asked for
 *   reduced motion. Anything unknown, missing, or throwing means do not move.
 *
 * These are assertions about a decision, not about pixels, which is why they
 * belong in the project's existing node-environment Vitest setup rather than in
 * a browser or a component test. A DOM test would prove the same function works
 * only when a DOM happens to exist, which is precisely the case where the
 * function is not making the risky decision.
 */

type WindowStub = {
  matchMedia?: (query: string) => { matches: boolean }
}

const originalWindow = (globalThis as { window?: unknown }).window

function stubWindow(stub: WindowStub | undefined) {
  if (stub === undefined) {
    Reflect.deleteProperty(globalThis, "window")
    return
  }
  ;(globalThis as { window?: unknown }).window = stub
}

afterEach(() => {
  stubWindow(originalWindow as WindowStub | undefined)
  vi.restoreAllMocks()
})

describe("prefersReducedMotion", () => {
  it("reports reduce when the visitor asked for reduced motion", () => {
    stubWindow({ matchMedia: () => ({ matches: true }) })
    expect(prefersReducedMotion()).toBe(true)
  })

  it("reports no-reduce when the visitor did not ask for reduced motion", () => {
    stubWindow({ matchMedia: () => ({ matches: false }) })
    expect(prefersReducedMotion()).toBe(false)
  })

  it("assumes no matchMedia means reduced motion, not full motion", () => {
    // A browser that does not implement the query has expressed no preference.
    // Reading that as "full motion" is how a reduced-motion visitor ends up with
    // a page that animates anyway.
    stubWindow({})
    expect(prefersReducedMotion()).toBe(true)
  })

  it("assumes reduced motion when matchMedia throws", () => {
    stubWindow({
      matchMedia: () => {
        throw new Error("blocked by privacy settings")
      },
    })
    expect(prefersReducedMotion()).toBe(true)
  })

  it("assumes reduced motion during server rendering, where window is absent", () => {
    stubWindow(undefined)
    expect(typeof window).toBe("undefined")
    expect(prefersReducedMotion()).toBe(true)
  })

  it("actually queries the reduced-motion condition", () => {
    // Guards against the query string drifting away from what the browser
    // understands. A typo here returns false for everyone and silently disables
    // the whole accessibility path.
    const matchMedia = vi.fn(() => ({ matches: true }))
    stubWindow({ matchMedia })

    prefersReducedMotion()

    expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)")
  })
})

describe("GSAP matchMedia query strings", () => {
  it("opts motion in only on an explicit no-preference", () => {
    // The asymmetry with REDUCED_MOTION_MQ is deliberate and is the whole
    // reason both constants live in one module. GSAP branches on the opt-in
    // string so the branch is re-evaluated when the preference changes mid
    // session; the opt-out string cannot express "we do not know".
    expect(MOTION_ALLOWED_MQ).toBe("(prefers-reduced-motion: no-preference)")
    expect(REDUCED_MOTION_MQ).toBe("(prefers-reduced-motion: reduce)")
  })

  it("composes into a valid multi-condition GSAP query", () => {
    // The masthead's real condition. If the constant ever gains trailing text
    // or a stray space this stops being a parseable query and the masthead
    // silently stops hiding on scroll.
    expect(`${MOTION_ALLOWED_MQ} and (min-width: 768px)`).toBe(
      "(prefers-reduced-motion: no-preference) and (min-width: 768px)",
    )
  })
})
