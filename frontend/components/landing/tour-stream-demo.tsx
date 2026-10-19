"use client"

import { useEffect, useRef, useState } from "react"
import StreamPanel, { type StreamStatus } from "@/components/stream/stream-panel"
import { prefersReducedMotion } from "@/lib/motion-preference"

/**
 * The real `StreamPanel`, driven by a scripted loop — the "watch it write"
 * preview for step 3 of the how-it-works tour.
 *
 * Extracted from the retired standalone "see it in action" section
 * (spec 005 Part IV §27); the reconstruction rules of §9 are unchanged:
 * this is the actual UI component with a scripted passage, not a recording
 * of a session, and the section copy says so in plain words.
 *
 * `announce={false}`: an `aria-live` region re-announcing every character on
 * an endless loop is the worst thing a landing page can do to a screen-reader
 * user. The panel here is decorative (its container is `aria-hidden`).
 *
 * REDUCED MOTION: no loop. The finished passage renders with status "done" —
 * the same settled state, still the real component, no animation.
 *
 * The loop types only while its container is on screen (IntersectionObserver,
 * 0.25 threshold): a typewriter burning frames for a section nobody is
 * looking at is the opposite of a performance budget.
 *
 * SPEC: specs/005-visual-identity-scroll-hero/spec.md §9, §22.
 */

/**
 * Kept short on purpose. The panel has a constant height (CSS), so this loop
 * cannot shift the page; the shorter the passage, the less a phone has to
 * scroll inside that fixed box.
 */
const PASSAGE = `Chapter One — The Letter

The letter arrived on a Tuesday, three weeks after Marian had stopped counting the days.

She had given up on it ever coming. The house was sold, the cat given away, and the whole of her mother's library fitted into eleven cardboard boxes.

Yet here it was on the doormat, in the same cream envelope as always. Only the address had changed.`

/** Milliseconds per revealed character. */
const TICK_MS = 18

/** How long the finished passage rests before the loop restarts. */
const HOLD_MS = 2600

export default function TourStreamDemo() {
  const [text, setText] = useState("")
  const [status, setStatus] = useState<StreamStatus>("idle")
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const demoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const demo = demoRef.current
    if (!demo) return

    // Reduced motion: show the finished passage immediately rather than typing
    // it. A simulated typewriter is motion, and the point of the preview — what
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
    <div className="tour-stream" ref={demoRef}>
      <StreamPanel
        text={text}
        status={status}
        stillWorking={false}
        errorMessage={null}
        announce={false}
      />
    </div>
  )
}
