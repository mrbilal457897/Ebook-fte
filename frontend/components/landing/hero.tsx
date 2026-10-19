"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { gsap, SplitText } from "@/lib/gsap-setup"
import { MOTION_ALLOWED_MQ } from "@/lib/motion-preference"
import ScrollBookHero from "@/components/landing/scroll-book-hero"

/**
 * The hero: headline, one subhead line, one primary action, and the pinned
 * scroll-book as the centrepiece.
 *
 * COPY DENSITY HERE IS THE CEILING for every section below it. No section gets a
 * paragraph the hero does not have.
 *
 * TWO INDEPENDENT ANIMATIONS, DELIBERATELY NOT ONE TIMELINE:
 *
 * - The **book** is scrubbed against scroll, pinned, in `ScrollBookHero`.
 * - The **headline** reveals once on load.
 *
 * Merging them would mean a headline that only appears when the visitor has
 * already scrolled, which trades the page's first job (say what this is) for a
 * flourish. The headline is the Largest Contentful Paint element and the one
 * line that tells a stranger what the product is, so it is visible from first
 * paint and then animates. The masthead CTA covers the interval.
 *
 * THE SPLIT IS REVERTED WHEN THE ANIMATION ENDS. SplitText leaves every word
 * wrapped in its own element; left in place that breaks Ctrl-F, text selection,
 * and machine translation of the headline. A marketing headline that cannot be
 * searched for is a real regression, so `onComplete` puts the DOM back to plain
 * text.
 *
 * Reduced motion never splits at all — the headline is simply there from the
 * first frame.
 *
 * SPEC: specs/005-visual-identity-scroll-hero/spec.md §19.
 */

/**
 * Word stagger, capped so the whole reveal lands inside 600ms including the
 * stagger. A 40ms per-word step across this headline is ~320ms of stagger; the
 * 280ms tween plus that is the budget. The brief's real requirement is that a
 * repeat visitor does not re-watch a slow hero on every visit.
 */
const REVEAL_DURATION = 0.28
const REVEAL_STAGGER = 0.04

export default function Hero({
  signedIn,
  primaryHref,
  signInHref,
}: {
  signedIn: boolean
  primaryHref: string
  signInHref: string
}) {
  const rootRef = useRef<HTMLElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const title = titleRef.current
    if (!title) return

    const mm = gsap.matchMedia()

    mm.add(MOTION_ALLOWED_MQ, () => {
      /*
       * `mask: "words"` gives each word an overflow-hidden wrapper, so the words
       * rise from behind their own line box rather than fading in place. That is
       * the whole difference between a headline that looks typeset and one that
       * looks like a fade.
       */
      const split = SplitText.create(title, { type: "words", mask: "words" })

      const ctx = gsap.context(() => {
        gsap.from(split.words, {
          yPercent: 110,
          opacity: 0,
          duration: REVEAL_DURATION,
          stagger: REVEAL_STAGGER,
          ease: "power3.out",
          onComplete: () => split.revert(),
        })
      }, title)

      return () => {
        ctx.revert()
        // Idempotent, and needed for the case where the tween was killed before
        // completing — a half-split headline is worse than an unsplit one.
        if (split.isSplit) split.revert()
      }
    })

    return () => mm.revert()
  }, [])

  return (
    <section className="landing-hero" aria-labelledby="landing-hero-title" ref={rootRef}>
      <div className="landing-hero-copy">
        <span className="landing-eyebrow">Your AI publishing team</span>

        {/*
          Plain text in the DOM at all times. The split is applied by the effect
          above and reverted when it finishes; no JS, and no animation, means the
          visitor and the screen reader both get an ordinary heading.
        */}
        <h1 className="landing-title" id="landing-hero-title" ref={titleRef}>
          Tell us the book. Watch it get written, cover and all.
        </h1>

        {/*
          `scroll-book-copy-late` is owned by the hero timeline in
          ScrollBookHero: the subhead, CTA and note arrive as the book settles
          open. They are visible by default and only ever hidden from JS, so a
          failed script leaves the page's one primary action on screen.
        */}
        <div className="landing-hero-late scroll-book-copy-late">
          <p className="landing-subtitle">
            Describe an idea in a sentence and your AI worker takes it from a blank page to a
            formatted, cover-ready draft &mdash; streaming every sentence as it writes.
          </p>
          <div className="landing-actions">
            <Link className="btn-primary" href={primaryHref} data-magnetic>
              {signedIn ? "Go to workspace" : "Start my book free"}
            </Link>
          </div>
          <p className="landing-note">
            Three free books. No card required. {!signedIn && <>Already started? </>}
            {!signedIn && (
              <Link className="landing-signin-inline" href={signInHref}>
                Sign in
              </Link>
            )}
          </p>
        </div>
      </div>

      <div className="landing-hero-visual">
        <ScrollBookHero />
      </div>
    </section>
  )
}
