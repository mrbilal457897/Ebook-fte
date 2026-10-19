/**
 * The reusable motion presets. One file, one import surface:
 *
 *     import { fadeUp, pinnedSection } from "@/lib/motion"
 *
 * THE CONTRACT every preset here follows — if you add one, follow it too:
 *
 * 1. SSR-safe. The first line checks `typeof window`. A preset called during
 *    server rendering returns a no-op cleanup instead of throwing; the
 *    server-rendered DOM stays fully visible.
 * 2. Motion-gated by `gsap.matchMedia(MOTION_ALLOWED_MQ)`, never by an
 *    inline `matchMedia(...).matches` read. The matchMedia form means a
 *    mid-session preference flip reverts the animation (GSAP un-tweens back
 *    to the element's markup state) rather than leaving it half-finished.
 *    Under `prefers-reduced-motion: reduce` the callback never runs, so the
 *    element is never touched — content visible, zero movement.
 * 3. Returns a `MotionCleanup` that reverts everything it created. Callers
 *    collect these (or return them from a `useMotion` setup), so unmount
 *    kills tweens, ScrollTriggers, timers and raw listeners — no orphaned
 *    triggers after a route change.
 * 4. Animates `transform` and `opacity` only. Two documented exceptions,
 *    both paint-only and layout-free: `strokeDashoffset` in `svgCheckDraw`
 *    (a transform cannot express a line draw) and `countUp`, which writes
 *    text (never a layout property — keep `font-variant-numeric:
 *    tabular-nums` on the element so digits don't jitter).
 * 5. Content is visible when JS fails: presets only ever hide things from
 *    inside a successfully-running, motion-allowed callback (`fromTo`
 *    applies its from-state synchronously there). No CSS ships an initial
 *    `opacity: 0`.
 */

import { gsap, ScrollTrigger, SplitText } from "@/lib/gsap-setup"
import { MOTION_ALLOWED_MQ } from "@/lib/motion-preference"
import { MOTION, type MotionCleanup } from "./tokens"

type Target = gsap.TweenTarget

const NOOP: MotionCleanup = () => {}

function isBrowser(): boolean {
  return typeof window !== "undefined"
}

/**
 * The single gating helper: runs `setup` only when motion is allowed (plus
 * any extra media condition), and returns a cleanup that reverts the
 * matchMedia instance — killing the tween/trigger and restoring markup
 * state in one call. `setup` may return its own cleanup (listener removal
 * etc.), which runs when the condition stops matching or on revert.
 */
function gated(extraCondition: string, setup: () => void | MotionCleanup): MotionCleanup {
  if (!isBrowser()) return NOOP
  const query = extraCondition ? `${MOTION_ALLOWED_MQ} and ${extraCondition}` : MOTION_ALLOWED_MQ
  const mm = gsap.matchMedia()
  mm.add(query, () => setup())
  return () => mm.revert()
}

/**
 * ScrollTrigger's `trigger` is typed `DOMTarget` (element or selector), not
 * the wider `TweenTarget` our presets accept — narrow it at the boundary so
 * preset callers can still pass whatever gsap accepts as a tween target.
 */
function toTriggerTarget(target: Target): Element | string {
  return target as Element | string
}

/* ------------------------------------------------------------------ */
/* Entrances                                                           */
/* ------------------------------------------------------------------ */

export type FadeUpOptions = {
  duration?: number
  ease?: string
  /** Rise distance in px; the markup's own position is restored on revert. */
  y?: number
  delay?: number
  /**
   * `true` = reveal when the target scrolls into view (its own trigger,
   * `"top 88%"`, once). Or pass an object to override trigger/start/once.
   */
  scroll?: boolean | { trigger?: Target; start?: string; once?: boolean }
}

/** Fade from 0 and rise `y` px, on mount or on scroll. The base entrance. */
export function fadeUp(target: Target, options: FadeUpOptions = {}): MotionCleanup {
  if (!isBrowser()) return NOOP
  const {
    duration = MOTION.duration.base,
    ease = MOTION.ease.out,
    y = MOTION.rise,
    delay = 0,
    scroll,
  } = options

  return gated("", () => {
    const scrollTrigger =
      scroll === undefined
        ? undefined
        : {
            trigger: toTriggerTarget(
              typeof scroll === "object" && scroll.trigger ? scroll.trigger : target,
            ),
            start: (typeof scroll === "object" && scroll.start) || "top 88%",
            once: typeof scroll === "object" && scroll.once !== undefined ? scroll.once : true,
          }

    gsap.fromTo(
      target,
      { opacity: 0, y },
      { opacity: 1, y: 0, duration, ease, delay, ...(scrollTrigger ? { scrollTrigger } : {}) },
    )
  })
}

export type StaggerRevealOptions = FadeUpOptions & {
  /** Seconds between children. Default MOTION.stagger (50ms, skill band). */
  stagger?: number
  from?: "start" | "center" | "end" | "edges" | "random"
}

/** `fadeUp` for a set of siblings, staggered. Pass the children as target. */
export function staggerReveal(target: Target, options: StaggerRevealOptions = {}): MotionCleanup {
  if (!isBrowser()) return NOOP
  const {
    duration = MOTION.duration.base,
    ease = MOTION.ease.out,
    y = MOTION.rise,
    delay = 0,
    stagger = MOTION.stagger,
    from = "start",
    scroll,
  } = options

  return gated("", () => {
    const scrollTrigger =
      scroll === undefined
        ? undefined
        : {
            trigger: toTriggerTarget(
              typeof scroll === "object" && scroll.trigger ? scroll.trigger : target,
            ),
            start: (typeof scroll === "object" && scroll.start) || "top 88%",
            once: typeof scroll === "object" && scroll.once !== undefined ? scroll.once : true,
          }

    gsap.fromTo(
      target,
      { opacity: 0, y },
      {
        opacity: 1,
        y: 0,
        duration,
        ease,
        delay,
        stagger: { each: stagger, from },
        ...(scrollTrigger ? { scrollTrigger } : {}),
      },
    )
  })
}

export type SplitHeadingOptions = {
  /** Skill's headline reveal is word-level; chars is the tighter variant. */
  type?: "words" | "chars"
  duration?: number
  ease?: string
  /** Per-part stagger, seconds. Defaults keep the total reveal ≤ 600ms. */
  stagger?: number
  delay?: number
  yPercent?: number
}

/**
 * SplitText reveal: parts rise + fade, then the split is REVERTED on
 * completion so the heading ends as plain text in the DOM (Ctrl-F,
 * selection, translation all keep working — see the skill's headline rule).
 * Reduced motion: the callback never runs, so there is no split at all and
 * the headline is visible from first paint.
 */
export function splitHeading(
  el: Element | null | undefined,
  options: SplitHeadingOptions = {},
): MotionCleanup {
  if (!isBrowser() || !el) return NOOP
  const {
    type = "words",
    duration = MOTION.duration.fast,
    ease = MOTION.ease.out,
    stagger = 0.04,
    delay = 0,
    yPercent = 60,
  } = options

  return gated("", () => {
    const split = new SplitText(el, { type })
    const parts = type === "chars" ? split.chars : split.words
    // Guarded: onComplete and the cleanup can both fire (a replay tears down
    // a finished animation), and a second revert must not touch the DOM twice.
    let reverted = false
    const revert = () => {
      if (reverted) return
      reverted = true
      split.revert()
    }

    gsap.fromTo(
      parts,
      { yPercent, opacity: 0 },
      {
        yPercent: 0,
        opacity: 1,
        duration,
        ease,
        delay,
        stagger,
        onComplete: revert,
      },
    )

    // Cleanup path for mid-flight teardown (unmount, preference flip).
    return revert
  })
}

export type CountUpOptions = {
  from?: number
  to: number
  duration?: number
  ease?: string
  prefix?: string
  suffix?: string
  decimals?: number
  locale?: string
}

/**
 * Count from `from` to `to`, writing formatted text (not a layout property).
 * Put the FINAL value in the markup as well: with JS off the element shows
 * it, and the reduced-motion static variant is exactly that final value —
 * the cleanup renders `to` so a mid-count revert settles on the right
 * number instead of stopping at "4,812".
 */
export function countUp(el: Element | null | undefined, options: CountUpOptions): MotionCleanup {
  if (!isBrowser() || !el) return NOOP
  const {
    from = 0,
    to,
    duration = MOTION.duration.base,
    ease = MOTION.ease.out,
    prefix = "",
    suffix = "",
    decimals = 0,
    locale,
  } = options

  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  const render = (value: number) => {
    el.textContent = `${prefix}${formatter.format(value)}${suffix}`
  }

  return gated("", () => {
    render(from)
    const proxy = { value: from }
    gsap.to(proxy, {
      value: to,
      duration,
      ease,
      onUpdate: () => render(proxy.value),
    })
    return () => render(to)
  })
}

/* ------------------------------------------------------------------ */
/* Hover                                                               */
/* ------------------------------------------------------------------ */

export type MagneticHoverOptions = {
  /** Clamp in px. Default MOTION.magnetMax (6). */
  max?: number
  /** Pointer-to-element ratio. Default 0.3 (motion-hooks convention). */
  strength?: number
}

/**
 * Nudge the element towards the cursor (quickTo, cached per element — a new
 * tween per pointermove is how this becomes the thing that costs frames).
 * Fine-pointer devices only: never simulate magnetism on touch, where the
 * button would slide out from under the thumb at tap time.
 */
export function magneticHover(target: Target, options: MagneticHoverOptions = {}): MotionCleanup {
  if (!isBrowser()) return NOOP
  const { max = MOTION.magnetMax, strength = 0.3 } = options
  const elements = gsap.utils.toArray<HTMLElement>(target)
  if (elements.length === 0) return NOOP

  return gated("(hover: hover) and (pointer: fine)", () => {
    const removeListeners: MotionCleanup[] = []

    for (const el of elements) {
      const xTo = gsap.quickTo(el, "x", { duration: 0.4, ease: MOTION.ease.out })
      const yTo = gsap.quickTo(el, "y", { duration: 0.4, ease: MOTION.ease.out })

      const onMove = (event: PointerEvent) => {
        const bounds = el.getBoundingClientRect()
        const dx = event.clientX - (bounds.left + bounds.width / 2)
        const dy = event.clientY - (bounds.top + bounds.height / 2)
        // Clamp, don't scale: an unclamped ratio flings the element 200px
        // away when the pointer is far outside it.
        xTo(gsap.utils.clamp(-max, max, dx * strength))
        yTo(gsap.utils.clamp(-max, max, dy * strength * 1.3))
      }
      const onLeave = () => {
        xTo(0)
        yTo(0)
      }

      el.addEventListener("pointermove", onMove)
      el.addEventListener("pointerleave", onLeave)
      removeListeners.push(() => {
        el.removeEventListener("pointermove", onMove)
        el.removeEventListener("pointerleave", onLeave)
      })
    }

    return () => {
      for (const remove of removeListeners) remove()
    }
  })
}

export type CardLiftOptions = {
  y?: number
  duration?: number
  ease?: string
}

/**
 * Lift a card on hover and settle it back on leave. Transform only — the
 * drop shadow (if any) comes from a CSS class swap, never from an animated
 * box-shadow. Fine-pointer only; touch devices keep their CSS
 * `:active`/`:hover-lift` behaviour.
 */
export function cardLift(target: Target, options: CardLiftOptions = {}): MotionCleanup {
  if (!isBrowser()) return NOOP
  const { y = MOTION.liftY, duration = MOTION.duration.fast, ease = MOTION.ease.out } = options
  const elements = gsap.utils.toArray<HTMLElement>(target)
  if (elements.length === 0) return NOOP

  return gated("(hover: hover) and (pointer: fine)", () => {
    const removeListeners: MotionCleanup[] = []

    for (const el of elements) {
      const onEnter = () => {
        gsap.to(el, { y, duration, ease, overwrite: "auto" })
      }
      const onLeave = () => {
        gsap.to(el, { y: 0, duration, ease, overwrite: "auto" })
      }

      el.addEventListener("pointerenter", onEnter)
      el.addEventListener("pointerleave", onLeave)
      removeListeners.push(() => {
        el.removeEventListener("pointerenter", onEnter)
        el.removeEventListener("pointerleave", onLeave)
      })
    }

    return () => {
      for (const remove of removeListeners) remove()
    }
  })
}

/* ------------------------------------------------------------------ */
/* Scroll                                                              */
/* ------------------------------------------------------------------ */

export type ParallaxOptions = {
  /** Travel as a percentage of the target's own height. Negative = drifts up. */
  yPercent?: number
  /** Numeric scrub seconds (glides), never `true` (snaps). */
  scrub?: number | boolean
  start?: string
  end?: string
  trigger?: Target
  /** Scroll-driven motion is the marketing layer's territory (skill Tier 2). */
  desktopOnly?: boolean
}

/** Drift a decorative element as its container passes through the viewport. */
export function parallax(target: Target, options: ParallaxOptions = {}): MotionCleanup {
  if (!isBrowser()) return NOOP
  const {
    yPercent = -20,
    scrub = 0.8,
    start = "top bottom",
    end = "bottom top",
    trigger,
    desktopOnly = false,
  } = options

  return gated(desktopOnly ? "(min-width: 768px)" : "", () => {
    gsap.to(target, {
      yPercent,
      ease: "none",
      scrollTrigger: {
        trigger: toTriggerTarget(trigger ?? target),
        start,
        end,
        scrub: typeof scrub === "number" ? scrub : scrub ? 0.8 : false,
      },
    })
  })
}

export type PinnedSectionOptions = {
  start?: string
  end?: string
  scrub?: number | boolean
  pinSpacing?: boolean
  /**
   * Pinning is a scroll takeover — the skill keeps those on marketing pages
   * and off daily-use product screens. Default true: desktop only.
   */
  desktopOnly?: boolean
  /**
   * Animation to scrub while pinned. Pass a FACTORY, not an instance: it is
   * only called when motion is allowed, so a reduced-motion visitor never
   * gets a timeline that plays itself (or a pin that hides content).
   */
  animation?: gsap.core.Animation | (() => gsap.core.Animation)
}

/**
 * Pin a section for `end`'s scroll distance, optionally scrubbing an
 * animation through it, then release back to normal flow. Reduced motion:
 * no pin at all — the section sits in the page as plain content (the
 * skill's "designed static version, no pin").
 */
export function pinnedSection(target: Target, options: PinnedSectionOptions = {}): MotionCleanup {
  if (!isBrowser()) return NOOP
  const {
    start = "top top",
    end = "+=100%",
    scrub = 0.8,
    pinSpacing = true,
    desktopOnly = true,
    animation,
  } = options

  return gated(desktopOnly ? "(min-width: 768px)" : "", () => {
    const resolved = typeof animation === "function" ? animation() : animation

    const trigger = ScrollTrigger.create({
      trigger: toTriggerTarget(target),
      start,
      end,
      pin: true,
      pinSpacing,
      scrub: typeof scrub === "number" ? scrub : scrub ? 0.8 : false,
      ...(resolved ? { animation: resolved } : {}),
      // will-change only while the pin is actually active — carrying it for
      // a whole session promotes a layer nobody is looking at.
      onToggle: (self) => gsap.set(target, { willChange: self.isActive ? "transform" : "auto" }),
    })

    return () => {
      trigger.kill()
      gsap.set(target, { willChange: "auto" })
    }
  })
}

/* ------------------------------------------------------------------ */
/* Structural                                                          */
/* ------------------------------------------------------------------ */

export type AccordionHeightOptions = {
  /** Called after the height transition settles (reads the element's own
   *  transition duration — under reduced motion that is ~0, so it fires now). */
  onSettled?: () => void
}

/**
 * Open/close an accordion panel by toggling `.is-open`.
 *
 * The HEIGHT move is deliberately delegated to the element's own CSS
 * (the `.ui-accordion-panel` grid-rows `0fr → 1fr` transition): it is the
 * one layout animation in this system, it happens only on explicit user
 * intent, and the browser handles it natively without per-frame JS. GSAP
 * would have to tween `height`, which reflows every element below the
 * accordion on every frame — that is exactly what the "transform/opacity
 * only" rule exists to prevent, so the rule wins and the class does the
 * work. The global reduced-motion reset zeroes the transition, giving the
 * required static variant for free.
 *
 * Expects a panel with `is-open` grid-rows CSS (`.ui-accordion-panel`).
 * Keep `aria-expanded` on the trigger in sync with the `open` argument.
 */
export function accordionHeight(
  panel: HTMLElement | null | undefined,
  open: boolean,
  options: AccordionHeightOptions = {},
): MotionCleanup {
  if (!isBrowser() || !panel) return NOOP
  const { onSettled } = options

  panel.classList.toggle("is-open", open)

  if (!onSettled) return NOOP

  let ms = 300
  try {
    // The element's own duration, not a hardcoded constant: theme overrides
    // and the reduced-motion reset both change it.
    const raw = getComputedStyle(panel).transitionDuration
    const first = raw.split(",")[0].trim()
    if (first.endsWith("ms")) {
      ms = Number.parseFloat(first) || 0
    } else if (first.endsWith("s")) {
      ms = (Number.parseFloat(first) || 0) * 1000
    }
  } catch {
    ms = 300
  }

  if (ms <= 0) {
    onSettled()
    return NOOP
  }
  const timer = setTimeout(onSettled, ms)
  return () => clearTimeout(timer)
}

export type PageTransitionOptions = {
  /** Children to animate. Default `[data-page-item]`, else the direct children. */
  selector?: string
  duration?: number
  ease?: string
  stagger?: number
  y?: number
  /** mode "out" only: called when the exit animation finishes — wire
   *  navigation here. Under reduced motion it fires immediately (no exit
   *  animation, destination still reachable). */
  onExitComplete?: () => void
}

/**
 * Enter/exit choreography for in-page view swaps (an overlay, a tab panel,
 * a route-intent handoff) — not a navigation blocker. `mode: "in"` reveals
 * children (revert restores them plain); `mode: "out"` fades them and
 * reports completion. Reduced motion: "in" never hides anything, "out"
 * completes instantly.
 */
export function pageTransition(
  el: Element | null | undefined,
  options: PageTransitionOptions & { mode: "in" | "out" },
): MotionCleanup {
  if (!isBrowser() || !el) return NOOP
  const {
    mode,
    selector = "[data-page-item]",
    duration = MOTION.duration.fast,
    ease = MOTION.ease.out,
    stagger = 0.04,
    y = MOTION.rise,
    onExitComplete,
  } = options

  const items = (): Element[] => {
    const selected = Array.from(el.querySelectorAll<HTMLElement>(selector))
    return selected.length > 0 ? selected : Array.from(el.children)
  }

  const cleanup = gated("", () => {
    const els = items()

    if (mode === "in") {
      gsap.fromTo(els, { opacity: 0, y }, { opacity: 1, y: 0, duration, ease, stagger })
      return NOOP
    }

    gsap.to(els, {
      opacity: 0,
      y: y / 2,
      duration,
      ease,
      stagger,
      onComplete: () => onExitComplete?.(),
    })
    return NOOP
  })

  // Exit completion drives navigation: an exit whose animation is skipped
  // (reduced motion) must still complete, or the destination is unreachable.
  if (mode === "out" && !window.matchMedia(MOTION_ALLOWED_MQ).matches) {
    onExitComplete?.()
  }

  return cleanup
}

export type NavbarHideOptions = {
  /** Scrolling down hides only past this point, px. Default 120 (skill). */
  threshold?: number
  /** Scroll travel required before a flip, px. Flicker guard. Default 8. */
  minTravel?: number
  /** Skill: hide/show on desktop + tablet; mobile keeps its nav visible. */
  desktopOnly?: boolean
  hiddenClass?: string
}

/**
 * Hide the navbar on scroll-down, bring it back on scroll-up.
 *
 * State machine on one whole-page ScrollTrigger (no hand-rolled scroll
 * listener — those repaint the page for the whole scroll). Direction
 * changes reset the travel counter, so a 4px wobble never flips the bar,
 * and scrolling back above the threshold always shows it. Cleanup kills
 * the trigger and removes the class, so a route change can't leave a
 * detached navbar hidden.
 *
 * Needs CSS: `transition: transform …` on the navbar and
 * `.is-hidden { transform: translateY(-100%) }` (components.css ships both
 * on `.ui-navbar`).
 */
export function navbarHideOnScroll(
  navbar: HTMLElement | null | undefined,
  options: NavbarHideOptions = {},
): MotionCleanup {
  if (!isBrowser() || !navbar) return NOOP
  const {
    threshold = MOTION.navbarThreshold,
    minTravel = MOTION.navbarMinTravel,
    desktopOnly = true,
    hiddenClass = "is-hidden",
  } = options

  return gated(desktopOnly ? "(min-width: 768px)" : "", () => {
    let lastY = window.scrollY
    let direction = 0 // -1 = up, 1 = down
    let travel = 0

    const trigger = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate(self) {
        const y = self.scroll()
        const delta = y - lastY
        const next = delta >= 0 ? 1 : -1
        if (next !== direction) {
          direction = next
          travel = 0
        }
        travel += Math.abs(delta)
        lastY = y

        if (y <= threshold) {
          navbar.classList.remove(hiddenClass)
          travel = 0
          return
        }
        if (travel >= minTravel) {
          navbar.classList.toggle(hiddenClass, direction === 1)
          travel = 0
        }
      },
    })

    return () => {
      trigger.kill()
      navbar.classList.remove(hiddenClass)
    }
  })
}

/* ------------------------------------------------------------------ */
/* SVG                                                                 */
/* ------------------------------------------------------------------ */

export type SvgCheckDrawOptions = {
  duration?: number
  ease?: string
  /** Seconds between paths when several are drawn. */
  stagger?: number
}

function resolveSvgPaths(target: Target): SVGPathElement[] {
  const elements = gsap.utils.toArray<Element>(target)
  const paths: SVGPathElement[] = []
  for (const el of elements) {
    if (typeof (el as SVGPathElement).getTotalLength === "function") {
      paths.push(el as SVGPathElement)
    } else if ("querySelectorAll" in el) {
      paths.push(...Array.from(el.querySelectorAll<SVGPathElement>("path")))
    }
  }
  return paths
}

/**
 * Draw SVG lines on with a dash-offset tween — the classic check-mark
 * reveal. Accepts path elements or any container holding them.
 *
 * Deliberate exception to the transform/opacity rule: a line draw has no
 * transform equivalent. `strokeDashoffset` is paint-only — it never
 * reflows or relayouts anything — so it costs nothing per frame. With JS
 * off (or reduced motion) no dash props are ever set: the check is simply
 * drawn, already complete.
 */
export function svgCheckDraw(target: Target, options: SvgCheckDrawOptions = {}): MotionCleanup {
  if (!isBrowser()) return NOOP
  const { duration = MOTION.duration.base, ease = MOTION.ease.expo, stagger = 0.12 } = options
  const paths = resolveSvgPaths(target)
  if (paths.length === 0) return NOOP

  return gated("", () => {
    for (const path of paths) {
      let length = 0
      try {
        length = path.getTotalLength()
      } catch {
        continue // jsdom, hidden, or otherwise unmeasurable — leave drawn.
      }
      if (!length) continue

      gsap.set(path, { strokeDasharray: length, strokeDashoffset: length })
      gsap.to(path, { strokeDashoffset: 0, duration, ease, delay: paths.indexOf(path) * stagger })
    }

    // Static variant / teardown: fully drawn, no leftover inline dash styles.
    return () => {
      for (const path of paths) {
        path.style.strokeDasharray = ""
        path.style.strokeDashoffset = ""
      }
    }
  })
}
