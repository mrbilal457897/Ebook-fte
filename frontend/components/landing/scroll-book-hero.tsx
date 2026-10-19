"use client"

import { useEffect, useRef } from "react"
import { gsap, ScrollTrigger } from "@/lib/gsap-setup"
import { REDUCED_MOTION_MQ } from "@/lib/motion-preference"

/**
 * Scroll-book hero: the marketing centrepiece for `/`.
 *
 * A CSS book that opens in response to scroll position — closed, cover swings
 * off the spine, leaves turn, then it settles open. Driven by a single pinned,
 * scrubbed ScrollTrigger; not a timer, and not a hand-rolled scroll listener.
 *
 * ISOLATION IS THE POINT. Per the governing design-system Skill, a heavy
 * scroll-driven sequence belongs on the marketing page and nowhere else. This
 * file is the only thing in the app that creates a ScrollTrigger, and only
 * `components/landing/landing.tsx` imports it. Putting a pinned hero in the
 * dashboard would take a deliberate import, so it cannot happen by accident.
 *
 * Static (not dynamic) imports, matching the existing convention in
 * `landing.tsx`. GSAP is already in the landing bundle, so deferring the import
 * would add async ordering complexity and save nothing.
 *
 * SPEC: specs/005-visual-identity-scroll-hero/spec.md §3.7, §3.8.
 */

export default function ScrollBookHero() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    /*
     * Plugin registration and ScrollTrigger.config({ ignoreMobileResize: true })
     * both live in lib/gsap-setup.ts, imported above. That config is global — it
     * has to apply to the whole page, not just whichever component happened to
     * remember it — so it does not belong in one component's effect.
     */

    /*
     * Triggers are created INSIDE the context, deliberately.
     *
     * React 19 StrictMode double-mounts effects in development. A trigger
     * created outside the context is not torn down by ctx.revert(), so the
     * second mount leaves a duplicate behind and the animation runs twice per
     * scroll — reproduces only in dev, and is very hard to see. (Plugin
     * *registration* moved to lib/gsap-setup.ts; only trigger creation is the
     * context's job.)
     */
    const ctx = gsap.context(() => {
      const stage = root.querySelector<HTMLElement>(".scroll-book-stage")
      const book = root.querySelector<HTMLElement>(".scroll-book-object")
      const cover = root.querySelector<HTMLElement>(".scroll-book-cover")
      const block = root.querySelector<HTMLElement>(".scroll-book-block")
      const leaves = gsap.utils.toArray<HTMLElement>(".scroll-book-leaf")
      const copyIn = root.querySelectorAll<HTMLElement>(".scroll-book-copy-late")
      const caption = root.querySelector<HTMLElement>(".scroll-book-caption")

      if (!stage || !book || !cover || !block || leaves.length === 0) return

      /*
       * Pin the whole hero SECTION, not just the book stage.
       *
       * Pinning only the stage lets the copy column scroll away while the four
       * beats play, which means the late-copy reveal would land off-screen and
       * the visitor would sit through a pinned book with nothing to read. The
       * section pin keeps the headline in view for the entire sequence — so the
       * headline can stay visible from first paint without ever being hidden
       * behind the scroll.
       *
       * `closest` rather than a prop so the fallback is local: if this component
       * is ever used outside a hero section, it pins its own stage.
       */
      const pinTarget = root.closest<HTMLElement>(".landing-hero") ?? stage

      /*
       * The reduced-motion variant is a DESIGNED static state, not an absence:
       * `data-motion="still"` flips the book to already-open and the late copy
       * to already-visible in pure CSS, with no ScrollTrigger and no pin. It is
       * applied before any measurement so the first layout pass is measured
       * against the state that will actually render.
       */
      const mm = gsap.matchMedia()

      mm.add(
        {
          isDesktop: "(min-width: 768px)",
          isMobile: "(max-width: 767px)",
          reduce: REDUCED_MOTION_MQ,
        },
        (context) => {
          const { isDesktop, reduce } = context.conditions as {
            isDesktop: boolean
            isMobile: boolean
            reduce: boolean
          }

          if (reduce) return

          /*
           * Hide the late copy from JS, not from CSS.
           *
           * CSS would mean an unstyled/JS-failed page whose CTA is permanently
           * invisible at opacity 0 — the worst possible failure for the one
           * element the whole page exists to drive toward. Setting it here means
           * the default state is visible, and only a page that has successfully
           * armed the animation ever hides anything. Same reason the reduced
           * motion book state is a media query rather than a set attribute.
           */
          gsap.set(copyIn, { opacity: 0, y: 12 })
          if (caption) gsap.set(caption, { opacity: 0, y: 8 })

          // Mobile keeps the interaction but drops the choreography: a 3D
          // page-turn is unreadable at 375px and costs the same frame budget.
          // Explicit beat positions, not even auto-spacing — pacing here is a
          // design decision, so it should be legible in the code.
          const beats = isDesktop
            ? { tilt: 1, reveal: 1, turn: 1.5, settle: 1.5 }
            : { tilt: 0.6, reveal: 0.6, turn: 0, settle: 0.6 }

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: pinTarget,
              start: "top top",
              /*
               * PIN LENGTH WAS `+=500%` ON DESKTOP. Five viewport-heights of
               * pinned scroll to play four beats is far more scroll than the
               * animation needs, and that surplus is what produced the reported
               * symptom: past roughly the second beat the timeline had finished,
               * so further scrolling moved a *static* hero and then released the
               * pin, and everything below appeared to "come up" from nowhere
               * instead of flowing. The end distance is now sized to the beats
               * (about 300% desktop / 150% mobile) so the pin releases the moment
               * the last beat lands.
               */
              end: isDesktop ? "+=300%" : "+=150%",
              pin: true,
              /*
               * `scrub` was 0.8, an 800ms catch-up. That reads as the hero
               * "drifting against" the scroll, which is the second half of the
               * same complaint — direction feels wrong because the render lags
               * the input by most of a second. 0.35 keeps a little smoothing (raw
               * 0 makes a scrubbed timeline jitter on a trackpad) without the lag.
               */
              scrub: 0.35,
              anticipatePin: 1,
              /*
               * The pin spacer height is computed from the section's measured
               * height, so if the hero's height changes — a longer headline, a
               * wider viewport, the aurora changing nothing — the pin is re-measured
               * instead of ending at a stale offset. Without this, refreshing on a
               * different width left the timeline ending early or late, which looks
               * exactly like a direction bug.
               */
              invalidateOnRefresh: true,
              /*
               * will-change is scoped to the pinned window rather than declared
               * in CSS: left on permanently it keeps a compositing layer alive
               * for the whole page session, costing memory and sometimes
               * defeating the repaint avoidance it was meant to buy.
               */
              onToggle: (self) => {
                book.style.willChange = self.isActive ? "transform" : ""
              },
            },
          })

          // ---- Beat 0 — closed book ------------------------------------------
          // A slight tilt reads as "an object on a table" rather than "a
          // rectangle in a layout".
          tl.fromTo(
            book,
            { rotate: -8, yPercent: 4 },
            {
              rotate: -22,
              yPercent: 0,
              duration: beats.tilt,
              ease: "power2.inOut",
            },
            0,
          )

          // The block's fore-edge peeking from under the cover: before anything
          // moves, the only cue that there is paper inside.
          tl.fromTo(
            block,
            { xPercent: 1.5 },
            { xPercent: 0, duration: beats.tilt, ease: "power1.out" },
            0,
          )

          // ---- Beat 1 — cover swings off the spine ---------------------------
          tl.to(cover, { rotateY: -180, duration: beats.reveal, ease: "power2.inOut" }, beats.tilt)

          if (isDesktop) {
            // ---- Beat 2 — three leaves turn --------------------------------
            // Overlapped by 0.08 each so they read as one shuffle, not three
            // separate clicks.
            const turnStart = beats.tilt + beats.reveal
            leaves.forEach((leaf, i) => {
              tl.to(
                leaf,
                { rotateY: -180, duration: 1.1, ease: "power2.inOut" },
                turnStart + i * 0.08,
              )
            })

            // ---- Beat 3 — settles open -------------------------------------
            const settleStart = turnStart + 1.1 + (leaves.length - 1) * 0.08
            tl.to(
              leaves,
              {
                // Fanned either side of the spine: a real open book is never
                // perfectly parallel.
                rotateY: (i: number) => (i % 2 === 0 ? -172 : -8),
                duration: beats.settle,
                ease: "power2.out",
              },
              settleStart,
            )

            // Copy arrives with the settle, not before: the book opening is
            // what earns attention, and copy animating over a still book
            // competes with it.
            tl.to(
              copyIn,
              {
                opacity: 1,
                y: 0,
                duration: 0.5,
                stagger: 0.08,
                ease: "power1.out",
              },
              settleStart + 0.25,
            )

            if (caption) {
              tl.fromTo(
                caption,
                { opacity: 0, y: 8 },
                { opacity: 1, y: 0, duration: 0.4, ease: "power1.out" },
                settleStart + 0.45,
              )
            }
          } else {
            // Mobile: one leaf turns. The choreography is cut, not compressed.
            tl.to(
              leaves[0],
              { rotateY: -172, duration: beats.settle, ease: "power2.out" },
              beats.tilt + beats.reveal,
            )
            tl.to(
              copyIn,
              {
                opacity: 1,
                y: 0,
                duration: 0.4,
                stagger: 0.08,
                ease: "power1.out",
              },
              beats.tilt + beats.reveal + 0.15,
            )
          }
        },
      )

      // Pin start depends on final text layout, so a late webfont swap would
      // otherwise leave the trigger measuring fallback metrics.
      document.fonts?.ready.then(() => ScrollTrigger.refresh())
    }, root)

    // Reverts every tween AND the ScrollTrigger, and un-pins the stage so no
    // spacer is left behind. Removing this line leaks a pinned trigger per
    // mount in dev StrictMode.
    return () => ctx.revert()
  }, [])

  return (
    <div className="scroll-book" ref={rootRef}>
      {/*
        Identical markup in both motion modes. The reduced-motion path is a CSS
        media query over this same tree, not a second component, so there is no
        parallel version to keep in sync.
      */}
      <div className="scroll-book-stage">
        <div className="scroll-book-object">
          {/* Paper block, with a lit fore-edge on the right */}
          <div className="scroll-book-block">
            <span className="scroll-book-edge" aria-hidden="true" />
          </div>

          {/* Leaves, each hinged on the spine. Reverse order in the DOM so leaf-1
              is the topmost and therefore the first one the reader sees turn. */}
          <div className="scroll-book-leaf scroll-book-leaf-3" aria-hidden="true" />
          <div className="scroll-book-leaf scroll-book-leaf-2" aria-hidden="true" />
          <div className="scroll-book-leaf scroll-book-leaf-1" aria-hidden="true" />

          <span className="scroll-book-spine" aria-hidden="true" />

          {/*
            Two faces: a cover hinged on the spine passes 90deg and would
            otherwise show its own front mirrored. backface-visibility plus a
            counter-rotated back face is what makes it read as a solid object
            turning rather than a plane flipping.
          */}
          <div className="scroll-book-cover" aria-hidden="true">
            <div className="scroll-book-cover-face scroll-book-cover-front">
              <span className="scroll-book-foil" />
              <span className="scroll-book-foil-rule" />
            </div>
            <div className="scroll-book-cover-face scroll-book-cover-back" />
          </div>
        </div>
      </div>

      {/*
        Decorative caption, hidden from assistive tech: it repeats information
        already in the section copy, and it is the one thing here that would
        otherwise be announced as meaningful content.
      */}
      <div className="scroll-book-caption" aria-hidden="true">
        <span className="scroll-book-caption-rule" />
        <span className="scroll-book-caption-text">
          Draft &middot; cover &middot; format &middot; publish checklist
        </span>
      </div>
    </div>
  )
}
