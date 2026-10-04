"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import gsap from "gsap"
import ScrollBookHero from "@/components/landing/scroll-book-hero"

/**
 * Design-system landing page: the public entry point at `/`. Explains what
 * the product does, shows the three-step "how it works" walkthrough, and
 * carries exactly one primary action (per the design-system layout rule).
 *
 * The tenant slug from the arrival URL is threaded into the sign-up/sign-in
 * links so a customer who entered through a company's branded link is bound
 * to that tenant (FR-010) — the landing page never drops it.
 *
 * An already-authed visitor sees the same page with the primary action
 * pointed at their workspace instead of a redundant sign-up.
 */
export default function Landing({
  signedIn,
  tenantSlug,
}: {
  signedIn: boolean
  tenantSlug: string
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const tenantQuery = `?tenant=${encodeURIComponent(tenantSlug)}`
  const primaryHref = signedIn ? "/generate" : `/signup${tenantQuery}`

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const ctx = gsap.context(() => {
      // The hero owns its own choreography (ScrollBookHero) and must not be
      // touched here — two timelines setting opacity on the same nodes fight,
      // and the hero's copy reveal is scroll-scrubbed, not timed.
      gsap.from(".landing-section > *", {
        opacity: 0,
        y: 12,
        duration: 0.3,
        stagger: 0.05,
        ease: "power2.out",
      })
      gsap.from(".landing-step", {
        opacity: 0,
        y: 12,
        duration: 0.3,
        stagger: 0.05,
        delay: 0.2,
        ease: "power2.out",
      })
      gsap.from(".landing-feature", {
        opacity: 0,
        y: 12,
        duration: 0.3,
        stagger: 0.04,
        delay: 0.35,
        ease: "power2.out",
      })
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={rootRef} className="landing">
      {/*
        Header. Nav is deliberately four items: this is one product, not a
        suite. No "Pricing" — there is no /pricing route and a dead link on a
        marketing page is worse than an absent section. The fixed theme toggle
        owns the top-right corner (see layout.tsx), so padding-right here
        reserves that space rather than letting them overlap.
      */}
      <header className="landing-masthead">
        <div className="landing-masthead-inner">
          {/*
            Wordmark carries the tenant too. A bare "/" here would silently drop
            it for anyone who arrived on /?tenant=acme, and they would then sign
            up against the fallback tenant — the exact FR-010 failure this page
            exists to avoid. It looks like a no-op link, so the omission is
            invisible until a real tenant link is followed end to end.
          */}
          <Link className="landing-wordmark" href={`/${tenantQuery}`}>
            E-book&nbsp;FTE
          </Link>
          <nav className="landing-nav" aria-label="Primary">
            <a className="landing-nav-link" href="#features">
              Features
            </a>
            <a className="landing-nav-link" href="#how-it-works">
              How it works
            </a>
          </nav>
          <div className="landing-masthead-actions">
            {!signedIn && (
              <Link className="landing-signin" href={`/signin${tenantQuery}`}>
                Sign in
              </Link>
            )}
            <Link className="btn-primary" href={primaryHref}>
              {signedIn ? "Go to workspace" : "Start my book free"}
            </Link>
          </div>
        </div>
      </header>

      {/*
        Hero. Copy density here is the ceiling for every section below it: a
        headline, one subhead line, one primary action. No paragraph competes
        with the book.

        The eyebrow and headline are visible from first paint. The subhead and
        CTA carry `scroll-book-copy-late` and are revealed by the hero timeline
        as the book settles open — a deviation from the spec's "headline + CTA
        fade up", recorded in the commit body: the headline is the Largest
        Contentful Paint element and the thing that tells a stranger what this
        is, so hiding it behind a scroll gesture would trade the page's first
        job for a flourish. The masthead CTA covers the interim.
      */}
      <section className="landing-hero" aria-labelledby="landing-hero-title">
        <div className="landing-hero-copy">
          <span className="landing-eyebrow">Your AI publishing team</span>
          <h1 className="landing-title" id="landing-hero-title">
            Tell us the book. Watch it get written, cover and all.
          </h1>

          <div className="landing-hero-late scroll-book-copy-late">
            <p className="landing-subtitle">
              Describe an idea in a sentence and your AI worker takes it from a blank page to a
              formatted, cover-ready draft &mdash; streaming every sentence as it writes.
            </p>
            <div className="landing-actions">
              <Link className="btn-primary" href={primaryHref}>
                {signedIn ? "Go to workspace" : "Start my book free"}
              </Link>
              {!signedIn && (
                <Link className="landing-signin" href={`/signin${tenantQuery}`}>
                  Already have an account? Sign in
                </Link>
              )}
            </div>
            <p className="landing-note">Three free books. No card required.</p>
          </div>
        </div>

        <div className="landing-hero-visual">
          <ScrollBookHero />
        </div>
      </section>

      <section className="landing-section" id="how-it-works" aria-labelledby="landing-how-title">
        <h2 className="landing-section-title" id="landing-how-title">
          How it works
        </h2>
        <ol className="landing-steps">
          <li className="landing-step">
            <span className="landing-step-index">1</span>
            <h3 className="landing-step-title">Say what you want</h3>
            <p className="landing-step-body">
              One line is enough — a genre, a mood, a half-formed idea. You never have to sit down
              and plan an outline before you can start.
            </p>
          </li>
          <li className="landing-step">
            <span className="landing-step-index">2</span>
            <h3 className="landing-step-title">Watch it write</h3>
            <p className="landing-step-body">
              Your draft streams in word by word and is saved the instant it appears. Stop it, pick
              it back up later, refine the tone — nothing is lost while you think.
            </p>
          </li>
          <li className="landing-step">
            <span className="landing-step-index">3</span>
            <h3 className="landing-step-title">Cover, format, publish</h3>
            <p className="landing-step-body">
              Generate cover concepts, format for EPUB and print, and get a validated submission
              package for KDP, Apple Books and IngramSpark with an exact checklist of what to
              press. We prepare and check everything; the final Publish click stays yours.
            </p>
          </li>
        </ol>
      </section>

      <section className="landing-section" id="features" aria-labelledby="landing-features-title">
        <h2 className="landing-section-title" id="landing-features-title">
          Built for first-time authors
        </h2>
        <div className="landing-features">
          <div className="landing-feature">
            <h3 className="landing-feature-title">No blank-page panic</h3>
            <p className="landing-feature-body">
              The assistant walks you through your first book step by step, in plain language, and
              hands you to a human whenever you want one.
            </p>
          </div>
          <div className="landing-feature">
            <h3 className="landing-feature-title">Your keys, your money</h3>
            <p className="landing-feature-body">
              Connect your own model key and your own store and ad accounts. We never hold your
              publishing credentials or spend your budget without approval.
            </p>
          </div>
          <div className="landing-feature">
            <h3 className="landing-feature-title">Nothing disappears</h3>
            <p className="landing-feature-body">
              Every draft, cover and submission is versioned and recorded — close the tab
              mid-sentence and pick up exactly where you left off.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-cta">
        <h2 className="landing-section-title">Your first book is three prompts away.</h2>
        <Link className="btn-primary" href={primaryHref}>
          {signedIn ? "Go to workspace" : "Start writing free"}
        </Link>
      </section>

      <footer className="landing-footer">
        <p>Independent authors, published on their own terms.</p>
      </footer>
    </div>
  )
}
