"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { gsap, ScrollTrigger } from "@/lib/gsap-setup"
import { MOTION_ALLOWED_MQ } from "@/lib/motion-preference"
import Logo from "@/components/brand/logo"

/**
 * Fixed masthead for the landing page: transparent over the hero, solid once the
 * hero is behind the visitor, and hidden while scrolling down on desktop.
 *
 * WHY FIXED, AND WHAT THAT COSTS: the bar has to overlay the hero to be able to
 * fade in and out, and it has to be fixed to do that. A fixed bar over a pinned
 * hero fights the pin, so the hero reserves the bar's height in CSS instead.
 * (Part I solved the same collision the other way — bar in flow, hero wins —
 * which is why the bar used to sit in normal flow.)
 *
 * TWO SCROLLTRIGGERS, NOT A SCROLL LISTENER. A raw scroll handler repaints the
 * page on every frame of the whole scroll duration. ScrollTrigger's listener is
 * throttled to its own rAF and carries the scroll position we need anyway.
 *
 * The `refreshPriority` on the solid trigger is load-bearing: it makes that
 * trigger refresh AFTER the hero's pin (which has the default priority of 0), so
 * it measures the hero's final pinned height rather than its pre-pin height and
 * does not go solid 500% of the viewport too early.
 *
 * Hide/show is desktop and tablet only. Below 768px the bar stays fixed and solid
 * permanently — the hide/show pattern is fiddly on touch, buys little on a
 * phone, and a bar that vanishes while a thumb is mid-scroll is just in the way.
 *
 * Nav contents are deliberately four items. No Pricing: there is no /pricing
 * route, and a dead link on a marketing page is worse than an absent section.
 *
 * SPEC: specs/005-visual-identity-scroll-hero/spec.md §18.
 */

/**
 * Scrolled past this before the bar is allowed to hide at all. Below it the bar
 * is always visible, so the first flick of a scroll never removes the nav.
 */
const HIDE_AFTER = 120

/**
 * Minimum travel in one direction before the direction test is allowed to flip.
 * Without this, trackpad noise and momentum residue flicker the bar on and off
 * while the visitor is trying to read.
 */
const DIRECTION_DEADBAND = 8

export default function Masthead({
  signedIn,
  primaryHref,
  signInHref,
  homeHref,
}: {
  signedIn: boolean
  primaryHref: string
  signInHref: string
  homeHref: string
}) {
  const barRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const bar = barRef.current
    if (!bar) return

    const ctx = gsap.context(() => {
      // The hero section is this bar's "past the hero" landmark. The bar is a
      // sibling of it inside .landing, so query rather than pass it down.
      const hero = bar.parentElement?.querySelector<HTMLElement>(".landing-hero")

      // --- transparent over the hero, solid once past it ------------------
      // Deliberately NOT inside a matchMedia branch, including the
      // reduced-motion branch. This is a background-color and shadow change on
      // a bar that is otherwise unreadable against the hero artwork — killing it
      // under reduced motion would leave a transparent bar on an image, which is
      // worse for that visitor, not better.
      if (hero) {
        ScrollTrigger.create({
          trigger: hero,
          start: "bottom top",
          refreshPriority: 1,
          onToggle: (self) => {
            bar.classList.toggle("is-solid", self.isActive)
          },
        })
      }

      // --- hide on scroll-down, show on scroll-up ------------------------
      // Desktop/tablet, and not for visitors who asked for less motion.
      const mm = gsap.matchMedia()

      mm.add(`${MOTION_ALLOWED_MQ} and (min-width: 768px)`, () => {
        let lastY = window.scrollY

        ScrollTrigger.create({
          start: 0,
          end: "max",
          onUpdate: (self) => {
            const y = self.scroll()
            const delta = y - lastY
            lastY = y

            if (y < HIDE_AFTER) {
              bar.classList.remove("is-hidden")
              return
            }
            if (Math.abs(delta) < DIRECTION_DEADBAND) return

            bar.classList.toggle("is-hidden", delta > 0)
          },
        })
      })
    }, bar.parentElement ?? undefined)

    return () => ctx.revert()
  }, [])

  return (
    <header className="landing-masthead" ref={barRef}>
      <div className="landing-masthead-inner">
        {/*
          The wordmark carries the tenant. A bare "/" here would silently drop
          the slug for anyone who arrived on /?tenant=acme, and they would then
          sign up against the fallback tenant — the exact FR-010 failure this
          page exists to avoid. It looks like a no-op link, so the omission is
          invisible until a real tenant link is followed end to end.
        */}
        <Link className="landing-wordmark" href={homeHref}>
          <Logo />
          <span className="landing-wordmark-text">
            E-book&nbsp;<span className="landing-wordmark-accent">FTE</span>
          </span>
        </Link>

        <nav className="landing-nav" aria-label="Primary">
          <a className="landing-nav-link" href="#features">
            Features
          </a>
          <a className="landing-nav-link" href="#how-it-works">
            How it works
          </a>
          <a className="landing-nav-link" href="#faq">
            FAQ
          </a>
        </nav>

        <div className="landing-masthead-actions">
          {!signedIn && (
            <Link className="landing-signin" href={signInHref}>
              Sign in
            </Link>
          )}
          <Link className="btn-primary btn-primary-md" href={primaryHref} data-magnetic>
            {signedIn ? "Go to workspace" : "Start my book free"}
          </Link>
        </div>
      </div>
    </header>
  )
}
