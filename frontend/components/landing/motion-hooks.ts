"use client"

import { useEffect, type RefObject } from "react"
import { gsap, ScrollTrigger } from "@/lib/gsap-setup"
import { MOTION_ALLOWED_MQ } from "@/lib/motion-preference"

/**
 * The landing page's section entrance, applied to every `[data-reveal]` element.
 *
 * ONE hook, one set of ScrollTriggers, for the whole page — not a per-section
 * effect. Every trigger created here lives inside a single `gsap.context`, so
 * `ctx.revert()` removes all of them together, which is what keeps React 19's
 * StrictMode double-mount in dev from leaving a duplicate trigger behind per
 * section.
 *
 * It reuses the Skill's established entrance values exactly — fade + 12px rise,
 * `--duration-base`, power2.out — so a section arriving on scroll is
 * indistinguishable from one arriving on load. There is no second entrance
 * convention in this product.
 *
 * `fromTo` rather than `from`, deliberately: `fromTo` sets the from-values
 * immediately, so anything below the fold is hidden from the first frame rather
 * than flashing visible and then jumping to opacity 0 when its trigger fires.
 * That matters for the accessibility rule as much as the aesthetics — the
 * hiding is done by a script that has successfully armed itself, so the default,
 * unstyled page is always fully readable.
 *
 * Reduced motion: no trigger is created at all and nothing is ever hidden.
 *
 * SPEC: specs/005-visual-identity-scroll-hero/spec.md §22.
 */
export function useSectionReveal(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia()

      mm.add(MOTION_ALLOWED_MQ, () => {
        const targets = gsap.utils.toArray<HTMLElement>("[data-reveal]", root)
        if (targets.length === 0) return

        for (const target of targets) {
          gsap.fromTo(
            target,
            { opacity: 0, y: 12 },
            {
              opacity: 1,
              y: 0,
              duration: 0.3,
              ease: "power2.out",
              // Transform and opacity only. Animating anything else here would
              // relayout on every one of the page's entrance frames.
              scrollTrigger: {
                trigger: target,
                start: "top 88%",
                once: true,
              },
            },
          )
        }

        // A section's height depends on its own content, not on fonts swapping
        // in later, but a late reflow anywhere above a trigger can leave a start
        // position measured against fallback metrics.
        document.fonts?.ready.then(() => ScrollTrigger.refresh()).catch(() => {})
      })
    }, root)

    return () => ctx.revert()
  }, [rootRef])
}

/**
 * Magnetic hover for `[data-magnetic]` buttons.
 *
 * DELEGATED, not a hook per button. One `pointermove` listener on the page root
 * plus a `Map` of `quickTo` pairs, created on first touch of each element. A hook
 * per button would mean a listener per button and a dozen tiny GSAP instances to
 * keep in step.
 *
 * GATED THREE WAYS, because each gate is a different failure:
 * - `(hover: hover) and (pointer: fine)` — never simulate magnetism on touch. A
 *   finger has no cursor to be magnetic towards, so on a phone this would move
 *   the button under the thumb at the moment of the tap.
 * - `MOTION_ALLOWED_MQ` — it is movement. (See `lib/motion-preference.ts` for why
 *   this is the opt-in form and not the opt-out one.)
 * - Nothing on touch means the class is also inert under reduced motion via the
 *   global `transition-duration` reset; the transform is the only thing it does.
 *
 * Reset on `pointerleave` so the button returns to rest; without it a button the
 * visitor swiped past stays nudged, which looks broken.
 *
 * SPEC: specs/005-visual-identity-scroll-hero/spec.md §20.
 */

/** Maximum pull, in px. Enough to read as magnetic, small enough not to lie about
 *  where the control's edges are. */
const MAGNET_PULL = 6

export function useMagneticButtons(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const mm = gsap.matchMedia()

    mm.add(`(hover: hover) and (pointer: fine) and ${MOTION_ALLOWED_MQ}`, () => {
      const movers = new Map<
        HTMLElement,
        { x: ReturnType<typeof gsap.quickTo>; y: ReturnType<typeof gsap.quickTo> }
      >()

      const onMove = (event: PointerEvent) => {
        const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-magnetic]")
        if (!target || !root.contains(target)) return

        let mover = movers.get(target)

        if (!mover) {
          mover = {
            // quickTo tweens are cached per element; a new tween per mousemove is
            // how this effect becomes the thing that costs frames.
            x: gsap.quickTo(target, "x", { duration: 0.4, ease: "power3.out" }),
            y: gsap.quickTo(target, "y", { duration: 0.4, ease: "power3.out" }),
          }
          movers.set(target, mover)
        }

        const bounds = target.getBoundingClientRect()
        const dx = event.clientX - (bounds.left + bounds.width / 2)
        const dy = event.clientY - (bounds.top + bounds.height / 2)

        // Clamp rather than scale: a pointer far outside the button should not
        // fling it 200px away, which is what an unclamped ratio does.
        mover.x(gsap.utils.clamp(-MAGNET_PULL, MAGNET_PULL, dx * 0.3))
        mover.y(gsap.utils.clamp(-MAGNET_PULL, MAGNET_PULL, dy * 0.4))
      }

      const onLeave = (event: PointerEvent) => {
        const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-magnetic]")
        const mover = target ? movers.get(target) : undefined
        if (!target || !mover) return
        mover.x(0)
        mover.y(0)
      }

      root.addEventListener("pointermove", onMove)
      root.addEventListener("pointerleave", onLeave)

      return () => {
        root.removeEventListener("pointermove", onMove)
        root.removeEventListener("pointerleave", onLeave)
      }
    })

    return () => mm.revert()
  }, [rootRef])
}
