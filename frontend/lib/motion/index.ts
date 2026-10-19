/**
 * The motion module's public surface. Import everything from here:
 *
 *     import { useMotion, fadeUp, MOTION } from "@/lib/motion"
 *
 * Pieces:
 * - `tokens.ts`   — durations, easings, preset defaults (one source of truth)
 * - `presets.ts`  — the reusable animations; contract documented at its top
 * - `use-motion.ts` — the React wrapper (gsap.context + cleanup + font refresh)
 *
 * Plugin registration does NOT happen here — that stays in
 * `lib/gsap-setup.ts`, the single registration point.
 */

export { MOTION, type MotionCleanup } from "./tokens"
export * from "./presets"
export { useMotion, type MotionScope, type MotionSelector, type MotionSetup } from "./use-motion"
