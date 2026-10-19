"use client"

import { useEffect, useRef, useState } from "react"
import { gsap, ScrollTrigger } from "@/lib/gsap-setup"
import {
  MOTION,
  accordionHeight,
  cardLift,
  countUp,
  fadeUp,
  magneticHover,
  navbarHideOnScroll,
  pageTransition,
  parallax,
  pinnedSection,
  splitHeading,
  staggerReveal,
  svgCheckDraw,
  useMotion,
  type MotionCleanup,
} from "@/lib/motion"
import { Badge, Button, Container, Footer, Navbar } from "@/components/ui"

/**
 * /motion-demo — one section per preset in `lib/motion`, internal and
 * noindex like `/design-system`. Not linked from any product route.
 *
 * Two motion scopes on purpose:
 *   1. ENTRANCE group, deps `[runId]` — "Replay" rebuilds it: ctx.revert()
 *      kills the previous run's tweens first, so replay can never double up
 *      triggers (the duplicate-trigger failure mode this page exists to
 *      catch).
 *   2. PERSISTENT group, deps `[]` — hover/scroll/structural presets set up
 *      once; raw listeners they add are removed by the returned cleanups.
 *
 * The exit button calls presets from an event handler, which runs OUTSIDE
 * the context's execution — so it stores each returned cleanup and runs the
 * previous one before creating the next (there is no contextSafe in gsap
 * core; this manual pattern is the supported way to call presets later).
 */

const NAV_LINKS = [
  { label: "Design system", href: "/design-system" },
  { label: "Home", href: "/" },
]

export function MotionDemo() {
  const scope = useRef<HTMLDivElement>(null)
  const [runId, setRunId] = useState(0)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReduced(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  const replay = () => setRunId((n) => n + 1)

  /* Entrance presets — replayable. */
  useMotion(
    scope,
    (q) => {
      fadeUp(q(".md-fade"))
      staggerReveal(q(".md-stagger-item"))
      splitHeading(q(".md-split")[0])
      countUp(q(".md-count")[0], { to: 12480 })
      svgCheckDraw(q("[data-check]"), { stagger: 0.15 })
      pageTransition(q(".md-transition")[0], { mode: "in" })

      // Exit → return loop for pageTransition, wired as a raw listener:
      // handlers run outside the context, so its cleanups are tracked here.
      const button = q(".md-exit")[0]
      const box = q(".md-transition")[0]
      let active: MotionCleanup | undefined
      const onClick = () => {
        active?.()
        active = pageTransition(box, {
          mode: "out",
          onExitComplete: () => {
            active?.()
            active = pageTransition(box, { mode: "in" })
          },
        })
      }
      button?.addEventListener("click", onClick)
      return () => {
        button?.removeEventListener("click", onClick)
        active?.()
      }
    },
    [runId],
  )

  /* Hover, scroll and structural presets — set up once. */
  useMotion(
    scope,
    (q) => {
      magneticHover(q(".md-magnetic"))
      cardLift(q(".md-lift"))
      parallax(q(".md-parallax-shape")[0], { yPercent: -30 })

      const pin = q(".md-pin")[0]
      if (pin) {
        pinnedSection(pin, {
          end: "+=80%",
          // Factory, not an instance: only built when motion is allowed, so a
          // reduced-motion visitor gets the static version with both beats shown.
          animation: () =>
            gsap.timeline().fromTo(
              q(".md-pin-beat"),
              { opacity: 0, y: MOTION.rise * 2 },
              {
                opacity: 1,
                y: 0,
                duration: MOTION.duration.base,
                ease: MOTION.ease.out,
                stagger: MOTION.stagger,
              },
            ),
        })
      }

      navbarHideOnScroll(q(".ui-navbar")[0])

      // accordionHeight: click wiring lives here so unmount removes it.
      const trigger = q(".md-acc-trigger")[0]
      const panel = q(".md-acc-panel")[0]
      if (trigger && panel) {
        const onClick = () => {
          const open = !panel.classList.contains("is-open")
          accordionHeight(panel, open, { onSettled: () => ScrollTrigger.refresh() })
          trigger.setAttribute("aria-expanded", String(open))
        }
        trigger.addEventListener("click", onClick)
        return () => trigger.removeEventListener("click", onClick)
      }
    },
    [],
  )

  return (
    <div className="md-page" ref={scope}>
      <Navbar links={NAV_LINKS} actions={<Badge tone="accent">motion demo</Badge>} />

      <Container>
        <header className="md-head">
          <h1 className="md-title">Motion module — preset playground</h1>
          <p className="md-lede">
            Every preset exported by <code>lib/motion</code>, one card each, driven through the
            <code> useMotion</code> hook. Entrance presets replay together; scroll and hover presets
            react live.
          </p>
          <div className="md-actions">
            <Button onClick={replay}>Replay entrance presets</Button>
            <Badge tone={reduced ? "warning" : "success"} dot>
              {reduced
                ? "prefers-reduced-motion: reduce — presets idle, content static"
                : "motion allowed — presets armed"}
            </Badge>
          </div>
          <p className="md-note">
            Navbar test: scroll down past 120px — it slides away (desktop ≥768px only) — then one
            scroll up brings it back. With reduced motion it never moves.
          </p>
        </header>

        <div className="md-cases">
          <section className="md-case">
            <div className="md-case-head">
              <Badge tone="accent">fadeUp</Badge>
              <Button size="sm" variant="secondary" onClick={replay}>
                Replay
              </Button>
            </div>
            <p className="md-case-desc">
              The base entrance: fade from 0, rise 12px, 0.6s power3.out. Transform and opacity
              only.
            </p>
            <div className="md-fade md-box">I arrive with fade + rise.</div>
          </section>

          <section className="md-case">
            <div className="md-case-head">
              <Badge tone="accent">staggerReveal</Badge>
              <Button size="sm" variant="secondary" onClick={replay}>
                Replay
              </Button>
            </div>
            <p className="md-case-desc">
              Same entrance across siblings, 50ms apart (the skill&apos;s 40–60ms band), capped at
              six items so it reads polished rather than slow.
            </p>
            <div className="md-grid">
              {["Outline", "Draft", "Edit", "Cover", "Format", "Publish"].map((label, i) => (
                <div className="md-stagger-item md-tile" key={label}>
                  <span className="md-step">{i + 1}</span> {label}
                </div>
              ))}
            </div>
          </section>

          <section className="md-case">
            <div className="md-case-head">
              <Badge tone="accent">splitHeading</Badge>
              <Button size="sm" variant="secondary" onClick={replay}>
                Replay
              </Button>
            </div>
            <p className="md-case-desc">
              SplitText, word-level, total reveal ≤600ms including stagger. Reverts when finished,
              so the heading is plain text again — Ctrl-F and selection keep working. Reduced
              motion: no split at all.
            </p>
            <h2 className="md-split">Ink, gold, and forward momentum.</h2>
          </section>

          <section className="md-case">
            <div className="md-case-head">
              <Badge tone="accent">countUp</Badge>
              <Button size="sm" variant="secondary" onClick={replay}>
                Replay
              </Button>
            </div>
            <p className="md-case-desc">
              Writes formatted text — never a layout property — with tabular numerals so digits
              don&apos;t jitter. The markup itself holds the final number, so with JS off (or under
              reduced motion) it simply reads 12,480.
            </p>
            <p className="md-count">12,480</p>
            <p className="md-count-label">words generated this month</p>
          </section>

          <section className="md-case">
            <div className="md-case-head">
              <Badge tone="accent">magneticHover</Badge>
            </div>
            <p className="md-case-desc">
              Nudges towards the cursor, clamped at ±6px, cached quickTo tweens. Fine-pointer
              devices only — on touch it never moves under the thumb.
            </p>
            <div className="md-actions">
              <Button variant="secondary" className="md-magnetic">
                Magnetic
              </Button>
              <Button variant="ghost" className="md-magnetic">
                Also magnetic
              </Button>
            </div>
          </section>

          <section className="md-case">
            <div className="md-case-head">
              <Badge tone="accent">cardLift</Badge>
            </div>
            <p className="md-case-desc">
              Hover lift on transform only — 0.3s out, settle back on leave. Any shadow is a
              discrete CSS swap, never an animated box-shadow.
            </p>
            <div className="md-grid">
              {["Manuscript", "Cover", "Interior"].map((label) => (
                <div className="md-lift md-tile" key={label}>
                  {label}
                </div>
              ))}
            </div>
          </section>

          <section className="md-case">
            <div className="md-case-head">
              <Badge tone="accent">parallax</Badge>
            </div>
            <p className="md-case-desc">
              Scrub 0.8 (glides, never snaps), transform only. Scroll the window across the viewport
              and the shape drifts −30% behind it.
            </p>
            <div className="md-window">
              <div className="md-parallax-shape" aria-hidden="true" />
              <p className="md-window-note">Decorative shape — aria-hidden, drifts on scroll.</p>
            </div>
          </section>

          <section className="md-case">
            <div className="md-case-head">
              <Badge tone="accent">pinnedSection</Badge>
              <Badge tone="neutral">desktop ≥768px</Badge>
            </div>
            <p className="md-case-desc">
              Pins for 80% of the viewport, scrubs two beats in, then releases back to normal flow.
              will-change applies only while pinned. Reduced motion: no pin, both beats simply
              shown.
            </p>
            <div className="md-pin">
              <div className="md-pin-inner">
                <Badge tone="accent">pinned</Badge>
                <p className="md-pin-beat">Beat one — the section holds here while you scroll.</p>
                <p className="md-pin-beat">
                  Beat two — scrubbed in, then the pin releases and the page flows on.
                </p>
              </div>
            </div>
          </section>

          <section className="md-case">
            <div className="md-case-head">
              <Badge tone="accent">accordionHeight</Badge>
            </div>
            <p className="md-case-desc">
              The height move is delegated to the existing CSS grid-rows transition — the one
              intentional layout animation, only on user intent, zeroed by the reduced-motion reset.
              GSAP itself stays transform/opacity-only. Click to open:
            </p>
            <div className="ui-accordion">
              <div className="ui-accordion-item">
                <button
                  type="button"
                  className="ui-accordion-trigger md-acc-trigger"
                  aria-expanded="false"
                  aria-controls="md-acc-panel"
                >
                  <span>Does this work without GSAP?</span>
                  <span className="ui-accordion-marker" aria-hidden="true" />
                </button>
                <div className="ui-accordion-panel md-acc-panel" id="md-acc-panel">
                  <div>
                    <p className="ui-accordion-answer">
                      Yes — the panel is plain DOM and the reveal is CSS. The preset only toggles
                      the class and keeps aria-expanded in sync; nothing is hidden by JavaScript.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="md-case">
            <div className="md-case-head">
              <Badge tone="accent">pageTransition</Badge>
              <Button size="sm" variant="secondary" className="md-exit">
                Play exit → return
              </Button>
            </div>
            <p className="md-case-desc">
              Enter runs with the entrance group (Replay). The exit button fades the rows out, calls
              onExitComplete, and re-enters — under reduced motion the exit is skipped entirely and
              completion fires immediately, so nothing is ever unreachable.
            </p>
            <div className="md-transition md-box">
              <div data-page-item className="md-row">
                Chapter draft — ready for review
              </div>
              <div data-page-item className="md-row">
                Cover variants — 4 generated
              </div>
              <div data-page-item className="md-row">
                Format check — EPUB passed
              </div>
            </div>
          </section>

          <section className="md-case">
            <div className="md-case-head">
              <Badge tone="accent">svgCheckDraw</Badge>
              <Button size="sm" variant="secondary" onClick={replay}>
                Replay
              </Button>
            </div>
            <p className="md-case-desc">
              Dash-offset draw with expo.out — the one documented exception to transform/opacity
              (paint-only, zero layout). With JS off the checks are simply already drawn.
            </p>
            <ul className="md-check-row">
              {["Formatting valid", "Metadata mapped", "Originality checked"].map((label) => (
                <li key={label}>
                  <svg
                    className="md-check"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    data-check
                  >
                    <path d="M4 12.5l5 5L20 6.5" />
                  </svg>
                  {label}
                </li>
              ))}
            </ul>
          </section>

          <section className="md-case">
            <div className="md-case-head">
              <Badge tone="accent">navbarHideOnScroll</Badge>
            </div>
            <p className="md-case-desc">
              One whole-page ScrollTrigger (no scroll listener), 120px threshold, 8px travel guard,
              desktop only. Demo at the top of this page — scroll down, then up.
            </p>
          </section>
        </div>
      </Container>

      <Footer
        tagline="Motion module playground — every preset in lib/motion."
        base="Internal page: noindex, not linked from any product route."
      />
    </div>
  )
}
