"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { gsap, SplitText } from "@/lib/gsap-setup"
import { MOTION_ALLOWED_MQ } from "@/lib/motion-preference"
import HeroBook from "@/components/landing/hero-book"

/**
 * The hero: split headline, one-line subhead, one primary action plus one
 * in-page secondary anchor, a trust row, and the tilt/float book.
 *
 * COPY DENSITY HERE IS THE CEILING for every section below it.
 *
 * ONE LOAD TIMELINE (spec 005 Part IV §25): eyebrow → masked headline →
 * sub/CTAs/trust → book entrance, done inside ~1s. Nothing here is scrubbed
 * or pinned; the scroll-linked storytelling lives in the how-it-works tour.
 *
 * THE SPLIT IS REVERTED WHEN THE ANIMATION ENDS. SplitText leaves every word
 * wrapped in its own element; left in place that breaks Ctrl-F, text selection,
 * and machine translation of the headline. `onComplete` puts the DOM back to
 * plain text, and the cleanup is idempotent for a mid-flight teardown.
 *
 * Every element is visible from first paint; the timeline only hides what it
 * will show again within ~1s. Reduced motion never splits and never hides —
 * the hero is simply there from the first frame, including the static book.
 *
 * SPEC: specs/005-visual-identity-scroll-hero/spec.md §19, §25.
 */

/**
 * Word stagger, capped so the whole reveal lands inside 600ms including the
 * stagger. A 40ms per-word step across this headline is ~360ms of stagger; the
 * 280ms tween plus that is the budget. The brief's real requirement is that a
 * repeat visitor does not re-watch a slow hero on every visit.
 */
const REVEAL_DURATION = 0.28
const REVEAL_STAGGER = 0.04

/**
 * Real product facts only — the same three that appear in the pricing and
 * social-proof sections. Anything aspirational ("thousands of authors") is
 * barred by spec 005 §8.2.
 */
const TRUST = ["No card required", "3 free books", "EPUB, MOBI & PDF", "You press Publish, always"]

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
    const root = rootRef.current
    const title = titleRef.current
    if (!root || !title) return

    const mm = gsap.matchMedia()

    mm.add(MOTION_ALLOWED_MQ, () => {
      /*
       * `mask: "words"` gives each word an overflow-hidden wrapper, so the words
       * rise from behind their own line box rather than fading in place. That is
       * the whole difference between a headline that looks typeset and one that
       * looks like a fade.
       */
      const split = SplitText.create(title, { type: "words", mask: "words" })
      let reverted = false
      const revertSplit = () => {
        if (reverted) return
        reverted = true
        if (split.isSplit) split.revert()
      }

      const ctx = gsap.context(() => {
        const tl = gsap.timeline()

        tl.from(".landing-eyebrow", {
          opacity: 0,
          y: 12,
          duration: 0.3,
          ease: "power3.out",
        })

        tl.from(
          split.words,
          {
            yPercent: 110,
            opacity: 0,
            duration: REVEAL_DURATION,
            stagger: REVEAL_STAGGER,
            ease: "power3.out",
            onComplete: revertSplit,
          },
          0.08,
        )

        // fromTo, not from: the from-values are applied the moment the tween is
        // created, so late copy is never painted visible-then-hidden on a slow
        // device between first paint and timeline start.
        tl.fromTo(
          ".landing-hero-late > *",
          { opacity: 0, y: 12 },
          {
            opacity: 1,
            y: 0,
            duration: 0.35,
            stagger: 0.08,
            ease: "power3.out",
          },
          0.35,
        )

        tl.fromTo(
          ".hero-book",
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" },
          0.3,
        )
      }, root)

      return () => {
        ctx.revert()
        // Idempotent, and needed for the case where the tween was killed before
        // completing — a half-split headline is worse than an unsplit one.
        revertSplit()
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

        <div className="landing-hero-late">
          <p className="landing-subtitle">
            Describe an idea in a sentence and your AI worker takes it from a blank page to a
            formatted, cover-ready draft &mdash; streaming every sentence as it writes.
          </p>

          <div className="landing-actions">
            <Link className="btn-primary" href={primaryHref} data-magnetic>
              {signedIn ? "Go to workspace" : "Start my book free"}
            </Link>
            {/*
              Secondary action is an IN-PAGE ANCHOR, never a route (spec 005 AC 21):
              it lands on the tour section where step 3 shows the writing panel.
            */}
            <a className="landing-cta-secondary" href="#how-it-works">
              Watch it write
            </a>
          </div>

          <ul className="landing-hero-trust" aria-label="What comes with the free tier">
            {TRUST.map((item) => (
              <li className="landing-hero-trust-item" key={item}>
                {item}
              </li>
            ))}
          </ul>

          {!signedIn && (
            <p className="landing-note">
              Already started?{" "}
              <Link className="landing-signin-inline" href={signInHref}>
                Sign in
              </Link>
            </p>
          )}
        </div>
      </div>

      <div className="landing-hero-visual">
        <HeroBook />
      </div>
    </section>
  )
}
