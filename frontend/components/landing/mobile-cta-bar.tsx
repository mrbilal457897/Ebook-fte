"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"

/**
 * Mobile sticky CTA bar (spec 005 Part IV §28, AC 52–55).
 *
 * BEHAVIOUR:
 * - Shown only under 768px (CSS media query on the bar itself); hidden on
 *   tablet/desktop where the masthead CTA is always available.
 * - Enters once the hero has left the viewport (IO on `.landing-hero`), and
 *   hides while the final CTA (`.landing-cta`) is visible — two observers,
 *   zero scroll listeners, zero ScrollTrigger. State tracking, not animation
 *   (AC 48).
 * - `primaryHref` is threaded from the landing root like every other CTA, so
 *   `?tenant=` survives (§10, FR-010).
 * - Content reserves its height via `.landing` bottom padding under 768px,
 *   so the bar never covers content when it appears.
 * - No-JS: the bar never appears (it needs an IO to enter); the hero CTA and
 *   final CTA still work — this is a convenience layer, not a dependency.
 * - Reduced motion: the global reset zeroes the transform/opacity transition,
 *   so the bar simply is or is not there (AC 49).
 *
 * SPEC: specs/005-visual-identity-scroll-hero/spec.md §28.
 */

type MobileCtaBarProps = {
  primaryHref: string
  label: string
}

export default function MobileCtaBar({ primaryHref, label }: MobileCtaBarProps) {
  const barRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const bar = barRef.current
    const host = bar?.parentElement
    if (!bar || !host) return

    const hero = host.querySelector<HTMLElement>(".landing-hero")
    const finalCta = host.querySelector<HTMLElement>(".landing-cta")

    let heroPassed = false
    let ctaInView = false

    const update = () => setVisible(heroPassed && !ctaInView)

    const observers: IntersectionObserver[] = []

    if (hero) {
      const heroObserver = new IntersectionObserver(
        ([entry]) => {
          heroPassed = !entry.isIntersecting && entry.boundingClientRect.top < 0
          update()
        },
        { threshold: 0 },
      )
      heroObserver.observe(hero)
      observers.push(heroObserver)
    }

    if (finalCta) {
      const ctaObserver = new IntersectionObserver(
        ([entry]) => {
          ctaInView = entry.isIntersecting
          update()
        },
        { threshold: 0 },
      )
      ctaObserver.observe(finalCta)
      observers.push(ctaObserver)
    }

    return () => {
      for (const observer of observers) observer.disconnect()
    }
  }, [])

  return (
    <div className={`mobile-cta${visible ? " is-visible" : ""}`} ref={barRef}>
      <Link className="btn-primary mobile-cta-button" href={primaryHref}>
        {label}
      </Link>
      <span className="mobile-cta-note">3 free books &middot; no card</span>
    </div>
  )
}
