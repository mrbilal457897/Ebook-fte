"use client"

import { useEffect, useRef, useState } from "react"
import TourStreamDemo from "@/components/landing/tour-stream-demo"

/**
 * "How it works" — the tour (spec 005 Part IV §27, §7 row 4).
 *
 * MERGES TWO RETIRED SECTIONS: the old numbered "How it works" steps and the
 * standalone "see it in action" demo. The five steps are the real product
 * flow; the sticky preview panel shows what each step looks like, and step 3's
 * preview is the REAL writing panel (`TourStreamDemo`, §9 rules).
 *
 * SCROLL-LINKING IS ACTIVATION, NOT ANIMATION (AC 48). One
 * IntersectionObserver with a centred band tracks which step crosses the
 * viewport middle and sets the active index. There is no scroll listener, no
 * ScrollTrigger pin, no scrub, and no scroll takeover anywhere in this
 * section. The sticky panel is plain CSS `position: sticky`.
 *
 * PREVIEWS ARE DECORATIVE (`aria-hidden`): mock shapes with a few real labels,
 * never fake data or invented screenshots (§8.4). The step text is the real
 * content, always visible, always in DOM order.
 *
 * REDUCED MOTION: the preview swap is an opacity transition, which the global
 * reduced-motion reset zeroes — so the swap is instant, not absent. Every
 * step's text is readable regardless of which preview is active.
 *
 * STEP 5'S WORDING IS CONSTRAINED BY §8.1: prepare and validate, then a
 * per-platform checklist; the final Publish click belongs to the author.
 *
 * SPEC: specs/005-visual-identity-scroll-hero/spec.md §7, §8.1, §9, §27.
 */

type Step = {
  id: string
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    id: "signup",
    title: "Sign up",
    body: "Three books free, no card. Sign in with Google or email, and you are writing inside a minute.",
  },
  {
    id: "idea",
    title: "Say what you want",
    body: "One line is enough — a genre, a mood, a half-formed idea. You never have to plan an outline before you can start.",
  },
  {
    id: "write",
    title: "Watch it write",
    body: "Your draft streams in word by word and is saved the instant it appears. Stop it, pick it back up later, change the tone — nothing is lost while you think.",
  },
  {
    id: "format",
    title: "Review the cover and the format",
    body: "Pick a cover direction, then check the EPUB and the print PDF with your trim size, margins and spine already calculated.",
  },
  {
    id: "publish",
    title: "Publish when you are ready",
    body: "You get a validated package and a per-platform checklist for KDP, Apple Books and IngramSpark. The final Publish click is yours.",
  },
]

export default function HowItWorksTour() {
  const rootRef = useRef<HTMLElement>(null)
  const [active, setActive] = useState(0)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const steps = Array.from(root.querySelectorAll<HTMLElement>(".tour-step"))
    if (steps.length === 0) return

    /*
     * A centred band: an element is "active" while it overlaps the middle 10%
     * of the viewport. rootMargin shrinks the observation box from both sides
     * by 45%, so exactly one step is usually in the band and the preview does
     * not flip while a step is only half on screen.
     *
     * This tracks a state (which step is being read) — it is not an
     * animation, so it deliberately runs under reduced motion too. Observers
     * are event-driven; there is no per-frame scroll work here.
     */
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const index = steps.indexOf(entry.target as HTMLElement)
          if (index !== -1) setActive(index)
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    )

    for (const step of steps) observer.observe(step)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      className="landing-section landing-tour"
      id="how-it-works"
      aria-labelledby="tour-title"
      ref={rootRef}
    >
      <h2 className="landing-section-title" id="tour-title" data-reveal>
        How it works
      </h2>

      <div className="tour-layout">
        {/*
          Preview comes first in the DOM so the phone layout leads with the
          sticky panel and the steps scroll beneath it; on desktop grid
          placement puts it in the right column. It is decorative, so its DOM
          position costs assistive tech nothing.
        */}
        <div className="tour-preview" aria-hidden="true">
          <div className={`tour-pane tour-pane-signup${active === 0 ? " is-active" : ""}`}>
            <div className="tour-mock tour-mock-signup">
              <span className="tour-mock-eyebrow">Create your account</span>
              <span className="tour-mock-line" />
              <span className="tour-mock-line tour-mock-line-short" />
              <span className="tour-mock-button">Start free</span>
              <span className="tour-mock-caption">3 free books &middot; no card</span>
            </div>
          </div>

          <div className={`tour-pane tour-pane-idea${active === 1 ? " is-active" : ""}`}>
            <div className="tour-mock tour-mock-idea">
              <span className="tour-mock-label">Your idea</span>
              <span className="tour-mock-prompt">
                A quiet literary mystery set in a coastal town.
              </span>
              <span className="tour-mock-chips">
                <span className="tour-mock-chip">Mystery</span>
                <span className="tour-mock-chip">Literary</span>
                <span className="tour-mock-chip">Slow burn</span>
              </span>
            </div>
          </div>

          <div className={`tour-pane tour-pane-write${active === 2 ? " is-active" : ""}`}>
            {/* Mounted only while active: leaving the step stops every timer. */}
            {active === 2 && <TourStreamDemo />}
          </div>

          <div className={`tour-pane tour-pane-format${active === 3 ? " is-active" : ""}`}>
            <div className="tour-mock tour-mock-format">
              <span className="landing-visual-cover">
                <span className="landing-visual-foil" />
              </span>
              <span className="landing-visual-page" />
              <span className="landing-visual-measure">
                <span className="landing-visual-measure-rule" />
                <span className="landing-visual-measure-label">6&Prime;&times;9&Prime;</span>
              </span>
            </div>
          </div>

          <div className={`tour-pane tour-pane-publish${active === 4 ? " is-active" : ""}`}>
            <div className="tour-mock tour-mock-publish">
              <span className="landing-visual-checklist">
                <span className="landing-visual-check">
                  <span className="landing-visual-tick" />
                </span>
                <span className="landing-visual-check">
                  <span className="landing-visual-tick" />
                </span>
                <span className="landing-visual-check">
                  <span className="landing-visual-tick" />
                </span>
              </span>
              <span className="landing-visual-badge">ready</span>
              <span className="tour-mock-caption">checklist &middot; you press Publish</span>
            </div>
          </div>
        </div>

        <ol className="tour-steps">
          {STEPS.map((step, index) => (
            <li
              className={`tour-step${active === index ? " is-active" : ""}`}
              key={step.id}
              data-reveal
            >
              {/*
                Decorative: the list is an <ol>, so the position is already
                announced. Announcing "1" twice is worse than not announcing it.
              */}
              <span className="tour-step-index" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="tour-step-copy">
                <h3 className="tour-step-title">{step.title}</h3>
                <p className="tour-step-body">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/*
        §9's honesty note, visible rather than buried in a comment: the panel
        is scripted, not a recording. It sits outside the aria-hidden preview.
      */}
      <p className="tour-note" data-reveal>
        Step 3 is a scripted demonstration using the real writing panel — not a recording of a
        session. It is there so you can see a finished draft without spending one of your free
        books.
      </p>
    </section>
  )
}
