"use client"

/**
 * `useMotion` — the one React entry point into the motion module.
 *
 *     const scope = useRef<HTMLDivElement>(null)
 *     useMotion(scope, (q) => {
 *       fadeUp(q(".card"))
 *       navbarHideOnScroll(q(".ui-navbar")[0])
 *       return () => extraTeardown
 *     }, [runId])
 *
 * What it guarantees:
 *
 * - EVERYTHING CREATED INSIDE THE SETUP RUNS IN ONE `gsap.context`.
 *   On unmount — or when `deps` change (a replay, a route change) —
 *   `ctx.revert()` kills the tweens and ScrollTriggers and restores markup
 *   state together. A trigger created outside a context outlives the page
 *   it belonged to, which is how duplicate triggers on route change
 *   happen; this makes that structurally impossible.
 * - A cleanup RETURNED from the setup function runs too — use it for raw
 *   event listeners, which gsap.context cannot see.
 * - `q(selector)` queries INSIDE the scope, so a preset never grabs another
 *   page's navbar or hero by accident.
 * - Fonts refresh ScrollTrigger once, globally, after first load: pin and
 *   trigger positions measured before the display font swaps are measured
 *   against fallback metrics otherwise.
 *
 * `setup` is not in `deps` on purpose — it closes over render state, so its
 * identity changes every render and would rebuild the animations
 * perpetually. The `deps` array IS the update contract: pass
 * `[runId]` to replay, `[]` to set up once.
 */

import { useEffect, type DependencyList, type RefObject } from "react"
import { gsap, ScrollTrigger } from "@/lib/gsap-setup"
import type { MotionCleanup } from "./tokens"

export type MotionScope = RefObject<HTMLElement | null> | HTMLElement | null

export type MotionSelector = (selector: string) => HTMLElement[]

export type MotionSetup = (q: MotionSelector, root: HTMLElement) => void | MotionCleanup

let fontsRefreshArmed = false

/**
 * One-time: refresh ScrollTrigger after webfonts settle. Armed on first
 * `useMotion` call rather than at import, so merely importing the motion
 * module never touches the DOM.
 */
function armFontsRefresh(): void {
  if (fontsRefreshArmed || typeof document === "undefined") return
  fontsRefreshArmed = true
  document.fonts?.ready.then(() => ScrollTrigger.refresh()).catch(() => {})
}

export function useMotion(scope: MotionScope, setup: MotionSetup, deps: DependencyList = []): void {
  useEffect(() => {
    const root = scope && "current" in scope ? scope.current : scope
    if (!root) return

    let userCleanup: MotionCleanup | undefined
    let userCleanupRan = false

    const ctx = gsap.context(() => {
      const select = gsap.utils.selector(root) as MotionSelector
      const result = setup(select, root)
      if (typeof result === "function") userCleanup = result
    }, root)

    armFontsRefresh()

    return () => {
      ctx.revert()
      if (userCleanup && !userCleanupRan) {
        userCleanupRan = true
        userCleanup()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `setup` closes over render state; the caller's `deps` is the update contract (see module doc).
  }, deps)
}
