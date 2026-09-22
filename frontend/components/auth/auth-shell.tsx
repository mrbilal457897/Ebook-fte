"use client"

import { useEffect, useRef } from "react"
import gsap from "gsap"

/**
 * Design-system auth shell: centered card on the dark canvas with a GSAP
 * entrance (fade + 12px rise, staggered children, `prefers-reduced-motion`
 * respected). One primary action per screen.
 */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

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
    <div ref={rootRef} className="auth-shell">
      <div className="auth-card">{children}</div>
    </div>
  )
}
