"use client"

import { useEffect, useRef } from "react"
import gsap from "gsap"
import { prefersReducedMotion } from "@/lib/motion-preference"

/**
 * Generation workspace shell: centered sticker panel on the paper canvas with a GSAP
 * entrance (fade + 12px rise, staggered children, `prefers-reduced-motion`
 * respected).
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
    <div ref={rootRef} className="app-shell">
      {children}
    </div>
  )
}
