"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"

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
  const [open, setOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const drawer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const focusable = () =>
      Array.from(
        drawer.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      )
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
        menuButton.current?.focus()
        return
      }
      if (event.key === "Tab") {
        const items = focusable()
        const first = items[0]
        const last = items[items.length - 1]
        if (!first || !last) return
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener("keydown", onKeyDown)
    drawer.current?.querySelector<HTMLElement>("a")?.focus()
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open])

  return (
    <header className="poster-header">
      <div className="poster-header-inner">
        <Link className="poster-logo" href={homeHref} aria-label="Tomewick AI home">
          <span className="poster-logo-mark" aria-hidden="true" />
          <span>
            Tomewick <span className="poster-logo-ai">AI</span><small>E-book</small>
          </span>
        </Link>

        <nav className="poster-nav" aria-label="Primary">
          <a className="poster-nav-link" href="#features">
            Features
          </a>
          <a className="poster-nav-link" href="#how-it-works">
            How it works
          </a>
          <a className="poster-nav-link" href="#shelf">Covers</a>
          <a className="poster-nav-link" href="#pricing">
            Pricing
          </a>
          <a className="poster-nav-link" href="#faq">
            FAQ
          </a>
        </nav>

        <div className="poster-header-actions">
          {!signedIn && (
            <Link href={signInHref} style={{ fontWeight: 600 }}>
              Sign in
            </Link>
          )}
          <Link className="poster-btn poster-btn--yellow poster-btn--sm" href={primaryHref}>
            Start free
          </Link>
          <button
            ref={menuButton}
            className="poster-mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="poster-drawer"
            onClick={() => setOpen((value) => !value)}
          >
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M1 1H17M1 7H17M1 13H17" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <div className="poster-drawer is-open" id="poster-drawer">
          <button
            className="poster-drawer-backdrop"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <nav
            ref={drawer}
            className="poster-drawer-panel"
            aria-label="Mobile primary"
            aria-modal="true"
            role="dialog"
          >
            <button
              className="poster-drawer-close"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              Close
            </button>
            <a className="poster-drawer-link" href="#features" onClick={() => setOpen(false)}>
              Features
            </a>
            <a className="poster-drawer-link" href="#how-it-works" onClick={() => setOpen(false)}>
              How it works
            </a>
            <a className="poster-drawer-link" href="#pricing" onClick={() => setOpen(false)}>
              Pricing
            </a>
            <a className="poster-drawer-link" href="#faq" onClick={() => setOpen(false)}>
              FAQ
            </a>
            {!signedIn && (
              <Link className="poster-drawer-link" href={signInHref} onClick={() => setOpen(false)}>
                Sign in
              </Link>
            )}
            <Link
              className="poster-btn poster-btn--yellow"
              href={primaryHref}
              onClick={() => setOpen(false)}
            >
              Start free
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}
