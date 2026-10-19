"use client"

import { useEffect, useRef, useState } from "react"
import StreamPanel, { type StreamStatus } from "@/components/stream/stream-panel"
import { prefersReducedMotion } from "@/lib/motion-preference"

/**
 * "See it in action": the real `StreamPanel` component, driven by a scripted
 * loop.
 *
 * THIS IS A RECONSTRUCTION, NOT A RECORDING. There is no screen capture of a
 * real session yet, so rather than fabricate a product screenshot or ship a
 * broken `<video>`, this section runs the actual UI component with a scripted
 * passage of prose. That is honest — it is the real component, not a picture of
 * one — but it is not a real generation, and the copy below says so rather than
 * letting a visitor read it as evidence that their book would look like this.
 * If a real capture is ever produced, prefer it and delete the loop.
 *
 * The panel is rendered with `announce={false}`. It is a live region in the
 * product, where text arriving genuinely is news. Here it types forever on a
 * timer, and an `aria-live` region re-announcing every character on an endless
 * cycle is the worst thing a landing page can do to a screen-reader user.
 *
 * Reduced motion does not loop. It renders the finished passage with status
 * "done" — the same settled state, no animation, still the real component.
 *
 * SPEC: specs/005-visual-identity-scroll-hero/spec.md §9, §22.
 */

/**
 * Kept short on purpose. The panel below it has a constant height (see
 * globals.css) precisely so this loop cannot shift the page — the shorter the
 * passage, the less a phone has to scroll inside that fixed box.
 */
const PASSAGE = `Chapter One — The Letter

The letter arrived on a Tuesday, three weeks after Marian had stopped counting the days.

She had given up on it ever coming. The house was sold, the cat given away, and the whole of her mother's library fitted into eleven cardboard boxes.

Yet here it was on the doormat, in the same cream envelope as always. Only the address had changed.`

/** Milliseconds per revealed character. */
const TICK_MS = 18

/** How long the finished passage rests before the loop restarts. */
const HOLD_MS = 2600

export default function SeeItInAction() {
  const [text, setText] = useState("")
  const [status, setStatus] = useState<StreamStatus>("idle")
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const demoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const demo = demoRef.current
    if (!demo) return

    // Reduced motion: show the finished passage immediately rather than typing
    // it. A simulated typewriter is motion, and the point of the section — what
    // the panel looks like — survives without it.
    if (prefersReducedMotion()) {
      setText(PASSAGE)
      setStatus("done")
      return
    }

    let shown = 0
    let stopped = false
    let running = false

    const clearTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = undefined
    }

    const step = () => {
      if (stopped || !running) return

      if (shown === 0) setStatus("working")

      shown = Math.min(shown + 3, PASSAGE.length)
      setText(PASSAGE.slice(0, shown))

      if (shown >= PASSAGE.length) {
        setStatus("done")
        clearTimer()
        timerRef.current = setTimeout(() => {
          shown = 0
          setText("")
          setStatus("idle")
          step()
        }, HOLD_MS)
        return
      }

      clearTimer()
      timerRef.current = setTimeout(step, TICK_MS)
    }

    const start = () => {
      running = true
      // A beat of "Nothing yet" before the first token, because that is what the
      // product actually looks like — and the pause is what makes the first
      // sentence arriving feel like it was written rather than pasted.
      clearTimer()
      timerRef.current = setTimeout(step, 900)
    }

    const stop = () => {
      running = false
      clearTimer()
    }

    /*
     * Only type while the section is on screen.
     *
     * A loop that runs forever whether or not anyone is looking at it burns
     * frames for the entire time the visitor spends on the hero, and it makes
     * the rest of the page continuously un-observable (every 18ms the DOM below
     * the hero changes). Gating on visibility is both the cheaper option and the
     * one that makes the section read as "it started when you arrived at it".
     *
     * `threshold: 0.25` rather than 0 so a single sliver of panel at the edge of
     * the viewport does not start a loop the visitor cannot see.
     */
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) start()
        else stop()
      },
      { threshold: 0.25 },
    )
    observer.observe(demo)

    return () => {
      stopped = true
      observer.disconnect()
      clearTimer()
    }
  }, [])

  return (
    <section
      className="landing-section"
      id="see-it-in-action"
      aria-labelledby="landing-action-title"
    >
      <div className="landing-action-copy" data-reveal>
        <h2 className="landing-section-title landing-section-title-left" id="landing-action-title">
          Watch it write
        </h2>
        <p className="landing-action-body">
          This is the real writing panel, not a screenshot of it. Your draft streams in sentence by
          sentence and is saved as it appears &mdash; close the tab mid-paragraph and you come back
          to the paragraph you left.
        </p>
        <p className="landing-action-note">
          A scripted demonstration, so you can see what a finished draft looks like without spending
          one of your three free books.
        </p>
      </div>

      <div className="landing-action-demo" data-reveal ref={demoRef}>
        <StreamPanel
          text={text}
          status={status}
          stillWorking={false}
          errorMessage={null}
          announce={false}
        />
      </div>
    </section>
  )
}
