"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import gsap from "gsap"

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
      gsap.from(".landing-hero > *", {
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
      <section className="landing-hero">
        <span className="landing-eyebrow">Your AI publishing team</span>
        <h1 className="landing-title">Tell us the book. Watch it get written, cover and all.</h1>
        <p className="landing-subtitle">
          Describe an idea in a sentence and your AI worker takes it from a blank page to a
          formatted, cover-ready draft — streaming every sentence as it writes, so you are never
          staring at a spinner wondering if anything is happening.
        </p>
        <div className="landing-actions">
          <Link className="btn-primary" href={primaryHref}>
            {signedIn ? "Go to workspace" : "Start writing free"}
          </Link>
          {!signedIn && (
            <Link className="landing-signin" href={`/signin${tenantQuery}`}>
              Already have an account? Sign in
            </Link>
          )}
        </div>
        <p className="landing-note">Three free books. No card required.</p>
      </section>

      <section className="landing-section" aria-labelledby="landing-how-title">
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
              Generate cover concepts, format for EPUB and print, and submit to the stores using
              your own accounts. Nothing goes live or spends money without your explicit OK.
            </p>
          </li>
        </ol>
      </section>

      <section className="landing-section" aria-labelledby="landing-features-title">
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
