"use client"

import { useRef } from "react"
import Link from "next/link"
import { ScrollTrigger } from "@/lib/gsap-setup"
import { useMotion } from "@/lib/motion"
import { navbarHideOnScroll } from "@/lib/motion/presets"
import Logo from "@/components/brand/logo"

/**
 * Fixed masthead for the landing page: transparent over the hero, solid once the
 * hero is behind the visitor, and hidden while scrolling down on desktop.
 *
 * WHY FIXED: the bar has to overlay the hero to fade in and out, and it has to
 * be fixed to do that. The hero reserves the bar's height in CSS instead of the
 * bar sitting in normal flow (Part I's earlier arrangement).
 *
 * TWO BEHAVIOURS, TWO MECHANISMS:
 *
 * - The **is-solid** toggle is a `ScrollTrigger.create` that is deliberately
 *   NOT motion-gated: it is a background-color and shadow change on a bar that
 *   is otherwise unreadable against the hero artwork — killing it under
 *   reduced motion would leave a transparent bar on an image, which is worse
 *   for that visitor, not better. (Part IV: the `refreshPriority: 1` this
 *   trigger used to carry against the hero's pin is gone with the pin — §25.)
 * - The **hide/show on scroll** is the motion module's `navbarHideOnScroll`
 *   preset (spec 005 Part IV): desktop-only, motion-gated, 120px threshold,
 *   8px travel guard, cleanup included. The hand-rolled direction test that
 *   used to live here is retired.
 *
 * Nav contents are the four in-page anchors of spec 005 §11 (as amended by
 * Part IV). `Pricing` points at the on-page pricing section — there is still
 * no `/pricing` route, and one must not be invented.
 *
 * SPEC: specs/005-visual-identity-scroll-hero/spec.md §11, §18.
 */
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

  useMotion(
    barRef,
    (_q, bar) => {
      // The hero section is this bar's "past the hero" landmark. The bar is a
      // sibling of it inside .landing, so query rather than pass it down.
      const hero = bar.parentElement?.querySelector<HTMLElement>(".landing-hero")

      if (hero) {
        ScrollTrigger.create({
          trigger: hero,
          start: "bottom top",
          onToggle: (self) => {
            bar.classList.toggle("is-solid", self.isActive)
          },
        })
      }

      // Hide on scroll-down, show on scroll-up. Gated inside the preset:
      // desktop/tablet only, and never for visitors who asked for less motion.
      return navbarHideOnScroll(bar)
    },
    [],
  )

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
          <a className="landing-nav-link" href="#pricing">
            Pricing
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
