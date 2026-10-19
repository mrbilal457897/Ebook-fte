import gsap from "gsap"
import ScrollTrigger from "gsap/ScrollTrigger"
import SplitText from "gsap/SplitText"

/**
 * The single place GSAP plugins are registered.
 *
 * Import this module for its side effect — `import "@/lib/gsap-setup"` — or
 * import the named exports below, which registers on module evaluation.
 *
 * Two reasons this exists rather than a `registerPlugin` call in each component:
 *
 * 1. One registration is one source of truth. Registering the same plugin from
 *    three components means working out which registration won when something
 *    misbehaves.
 * 2. `ScrollTrigger.config()` is global. Mobile browser chrome showing and hiding
 *    changes the viewport height constantly; refreshing ScrollTrigger on every
 *    one of those is pure wasted work, and it has to be off for the whole page,
 *    not just wherever a component remembered to set it.
 *
 * WHY FREE PLUGINS ARE AVAILABLE: Webflow's acquisition made every GSAP plugin
 * free at 3.13, including the former Club-GreenSock-only ones. This project pins
 * gsap@3.15.0, so SplitText ships in the package under the standard licence
 * (https://gsap.com/standard-license). There is no Club membership to buy.
 *
 * `ScrollSmoother` is deliberately absent even though it is also free. It
 * replaces the browser's scroll container with a transform-driven one, which
 * needs a fixed wrapper, breaks in-page anchor scrolling, interferes with
 * keyboard focus scrolling, and costs frames on top of `scrub`. See
 * specs/005-visual-identity-scroll-hero/spec.md §16.
 *
 * The browser guard is load-bearing, not defensive: a client component is still
 * server-rendered, so this module is evaluated during SSR where `window` does
 * not exist and registering would throw.
 */
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText)
  ScrollTrigger.config({ ignoreMobileResize: true })
}

export { gsap, ScrollTrigger, SplitText }
