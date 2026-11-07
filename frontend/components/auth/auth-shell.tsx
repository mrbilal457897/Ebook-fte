"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import gsap from "gsap"
import { prefersReducedMotion } from "@/lib/motion-preference"

/**
 * Auth screen on the v3 poster theme: dark gradient canvas, the small brand
 * topbar, and a centered card with the same entrance animation as before
 * (fade + 12px rise, staggered children, prefers-reduced-motion respected).
 */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (prefersReducedMotion()) return

    const ctx = gsap.context(() => {
      gsap.from(".auth-card", {
        opacity: 0,
        y: 12,
        duration: 0.3,
        ease: "power2.out",
      })
      gsap.from(".auth-card > *", {
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
    <div ref={rootRef} className="v3-app v3-app-auth">
      <div className="v3-topbar">
        <Link className="v3-topbar-brand" href="/">
          <span className="v3-topbar-drawn" aria-hidden="true" />
          Tomewick <b>AI</b>
        </Link>
        <span className="v3-topbar-note">E-book worker · human on the switch</span>
      </div>
      <div className="auth-shell v3-auth-shell">
        <div className="auth-card">{children}</div>
      </div>
    </div>
  )
}
