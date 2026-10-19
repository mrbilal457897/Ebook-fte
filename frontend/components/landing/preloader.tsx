"use client"

import { useEffect, useState } from "react"

/**
 * First-load-of-a-session branded preloader for the marketing landing page.
 *
 * Three properties are load-bearing, in this order:
 *
 * 1. **It never blocks for more than 1.5s.** The exit is driven by a CSS
 *    animation declared in globals.css, not by JavaScript. If the script never
 *    runs — JS disabled, a chunk fails to load, a hydration error — the overlay
 *    still fades itself out and becomes `visibility: hidden` at 1.5s. A
 *    preloader that waits on assets on a slow connection is a worse failure than
 *    no preloader at all.
 * 2. **It only appears once per session.** `sessionStorage` holds the marker,
 *    read inside try/catch because storage throws outright in some privacy
 *    modes and an uncaught throw here would strand the overlay. The same marker
 *    is read by a blocking inline script in `app/layout.tsx` that sets
 *    `data-preloader` on <html> before first paint — without it the overlay
 *    would paint on every navigation of the session and then vanish on
 *    hydration, which is a flash, not a preloader.
 * 3. **It fails open.** Every path that could go wrong resolves the same way
 *    the timeout does.
 *
 * Marketing chrome on `/` only. No product screen gets one — a screen a
 * customer opens daily must not spend its first 1.2s behind a wordmark.
 *
 * SPEC: specs/005-visual-identity-scroll-hero/spec.md §17.
 */

const SESSION_KEY = "ebook-fte-preloader-seen"

/** Exit the moment critical fonts are in, but never wait longer than this. */
const READY_EXIT_MS = 1200

export default function Preloader() {
  const [exiting, setExiting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    // The head script sets this only on a session's first load of a page that
    // has a preloader. Absent means we have already seen it this session.
    if (document.documentElement.dataset.preloader !== "run") return

    let timer: ReturnType<typeof setTimeout> | undefined
    let exited = false

    try {
      sessionStorage.setItem(SESSION_KEY, "1")
    } catch {
      // Storage unavailable. The preloader still works; it just reappears on
      // the next navigation, which is a cosmetic cost and not a failure.
    }

    const exit = () => {
      // Both the fonts promise and the timeout call this, and fonts can win
      // twice (ready then re-resolve). Without the guard the second call
      // overwrites `timer`, orphaning the first — and an orphaned timer still
      // calls setDone on an unmounted component.
      if (exited) return
      exited = true

      setExiting(true)
      // Let the CSS transition run before the node leaves the tree, otherwise
      // there is no fade-out — the overlay is simply deleted mid-frame.
      timer = setTimeout(() => setDone(true), 300)
    }

    // Whichever comes first. `document.fonts` is absent in some environments,
    // so it is optional rather than assumed.
    const fonts = document.fonts?.ready
    if (fonts) {
      fonts.then(exit).catch(() => {})
    }

    const cap = setTimeout(exit, READY_EXIT_MS)

    return () => {
      clearTimeout(cap)
      if (timer) clearTimeout(timer)
      if (document.documentElement.dataset.preloader === "run") {
        delete document.documentElement.dataset.preloader
      }
    }
  }, [])

  if (done) return null

  return (
    <div className={`preloader ${exiting ? "is-exiting" : ""}`} aria-hidden="true">
      <span className="preloader-mark">
        <span className="preloader-mark-rule" />
        E-book&nbsp;FTE
      </span>
    </div>
  )
}
