"use client"

import { useEffect, useRef } from "react"
import { gsap } from "@/lib/gsap-setup"
import { MOTION_ALLOWED_MQ } from "@/lib/motion-preference"

/**
 * The hero's book: a closed, foil-stamped hardcover that idles on a slow
 * float and tilts toward a fine pointer. Decorative — `aria-hidden`, no
 * controls, no content the page depends on.
 *
 * IT REPLACES THE PINNED SCROLL-BOOK (spec 005 Part IV §25). The old hero
 * spent five viewport-heights of pinned, scrubbed scroll opening a book; this
 * component spends none. The scroll-linked storytelling now lives in the
 * how-it-works tour; the hero's job is the first screen.
 *
 * THREE OWNERS, THREE ELEMENTS — the transforms must not share a node:
 * - `.hero-book`        entrance (opacity + rise), owned by the hero's load
 *                       timeline in `hero.tsx`.
 * - `.hero-book-float`  idle float + base pose, pure CSS keyframes. The
 *                       global reduced-motion reset zeroes CSS animations, so
 *                       this disappears for reduced-motion visitors with no JS
 *                       branch at all — the static pose (no float) is the
 *                       designed variant.
 * - `.hero-book-object` pointer tilt, `gsap.quickTo` on rotateX/rotateY,
 *                       gated on motion-allowed AND a fine pointer, so touch
 *                       devices and reduced-motion visitors never see it.
 * GSAP parses the CSS-composed transform on the object before it writes, so
 * the keyframed base rotate on the parent stays intact.
 *
 * The book CSS (`hero-book-*`) duplicates the geometry of the retired
 * `scroll-book-*` block deliberately: that block's reduced-motion query
 * force-opens the cover, which is wrong for an object that is identical in
 * both motion modes. The two objects no longer share a stylesheet state.
 */
export default function HeroBook() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const object = root.querySelector<HTMLElement>(".hero-book-object")
    if (!object) return

    const mm = gsap.matchMedia()

    mm.add(`${MOTION_ALLOWED_MQ} and (hover: hover) and (pointer: fine)`, () => {
      const xTo = gsap.quickTo(object, "rotationX", { duration: 0.5, ease: "power3.out" })
      const yTo = gsap.quickTo(object, "rotationY", { duration: 0.5, ease: "power3.out" })

      // Degrees, not radians at the API level — gsap's rotationX/Y take degrees.
      // Clamped so the book never tips past reading as "an object being
      // inspected" into "an object falling over".
      const MAX_X = 8
      const MAX_Y = 10

      const onMove = (event: PointerEvent) => {
        const bounds = root.getBoundingClientRect()
        const px = (event.clientX - bounds.left) / bounds.width - 0.5 // -0.5 … 0.5
        const py = (event.clientY - bounds.top) / bounds.height - 0.5
        xTo(gsap.utils.clamp(-MAX_X, MAX_X, -py * MAX_X * 2))
        yTo(gsap.utils.clamp(-MAX_Y, MAX_Y, px * MAX_Y * 2))
      }
      const onLeave = () => {
        xTo(0)
        yTo(0)
      }

      root.addEventListener("pointermove", onMove)
      root.addEventListener("pointerleave", onLeave)

      return () => {
        root.removeEventListener("pointermove", onMove)
        root.removeEventListener("pointerleave", onLeave)
        // Back to the CSS pose, not a stale inline transform.
        gsap.set(object, { rotationX: 0, rotationY: 0 })
      }
    })

    return () => mm.revert()
  }, [])

  return (
    <div className="hero-book" ref={rootRef} aria-hidden="true">
      <div className="hero-book-float">
        <div className="hero-book-object">
          <div className="hero-book-block">
            <span className="hero-book-edge" />
          </div>
          <span className="hero-book-spine" />
          <div className="hero-book-cover">
            <span className="hero-book-foil" />
            <span className="hero-book-foil-rule" />
          </div>
        </div>
      </div>
    </div>
  )
}
