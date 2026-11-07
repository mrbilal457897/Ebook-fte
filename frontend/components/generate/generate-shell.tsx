"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import gsap from "gsap"
import { prefersReducedMotion } from "@/lib/motion-preference"

/**
 * Generation workspace on the v3 poster theme: the same dark canvas and brand
 * topbar as the auth screens, then the writing panel with its entrance
 * animation (fade + 12px rise, staggered children, reduced-motion respected).
 */
export default function GenerateShell({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (prefersReducedMotion()) return

    const ctx = gsap.context(() => {
      gsap.from(".app-panel", { opacity: 0, y: 12, duration: 0.3, ease: "power2.out" })
      gsap.from(".app-panel > *", {
        opacity: 0,
        y: 12,
        duration: 0.3,
        stagger: 0.05,
        ease: "power2.out",
      })
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={rootRef} className="v3-app v3-app-workspace">
      <div className="v3-topbar">
        <Link className="v3-topbar-brand" href="/">
          <span className="v3-topbar-drawn" aria-hidden="true" />
          Tomewick <b>AI</b>
        </Link>
        <span className="v3-topbar-note">Say the book. We ship the manuscript.</span>
      </div>
      <div className="app-shell v3-appshell">{children}</div>
    </div>
  )
}
