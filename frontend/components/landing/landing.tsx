"use client"

import { useRef } from "react"
import Masthead from "@/components/landing/masthead"
import Hero from "@/components/landing/hero"
import LearnBento from "@/components/landing/learn-bento"
import HowItWorksTour from "@/components/landing/how-it-works-tour"
import CoversShelf from "@/components/landing/covers-shelf"
import WhoItsFor from "@/components/landing/who-its-for"
import FounderNote from "@/components/landing/founder-note"
import PricingSection from "@/components/landing/pricing-section"
import Faq from "@/components/landing/faq"
import FinalCta from "@/components/landing/final-cta"
import MobileCtaBar from "@/components/landing/mobile-cta-bar"
import SiteFooter from "@/components/landing/site-footer"
import PaperGrain from "@/components/landing/paper-grain"
import Preloader from "@/components/landing/preloader"
import { gsap, ScrollTrigger } from "@/lib/gsap-setup"
import { useEffect } from "react"

export default function Landing({
  signedIn,
  tenantSlug,
}: {
  signedIn: boolean
  tenantSlug: string
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  const tenantQuery = `?tenant=${encodeURIComponent(tenantSlug)}`
  const homeHref = `/${tenantQuery}`
  const primaryHref = signedIn ? "/generate" : `/signup${tenantQuery}`
  const signInHref = `/signin${tenantQuery}`
  const primaryLabel = signedIn ? "Go to workspace" : "Start writing free"

  useEffect(() => {
    const hero = document.querySelector<HTMLElement>(".v3-hero")
    const stageWrap = document.querySelector<HTMLElement>(".v3-stage-wrap")
    const stageContainer = document.querySelector<HTMLElement>(".v3-hero-visual")
    if (!hero || !stageWrap || !stageContainer) return
    const fit = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      // ≥760px is a two-column hero (copy left, book stage right). The three
      // stacked-on-the-left books below that width are the phone layout.
      const isTwoColumn = w >= 760
      // Measure the real copy column height; the fixed 560px assumption
      // collapsed the books into minis whenever the text wrapped taller.
      const copyEl = document.querySelector<HTMLElement>(".v3-hero-grid > .poster-hero-copy")
      const copyHeight = copyEl?.offsetHeight ?? (isTwoColumn ? 560 : 390)
      const availableHeight = isTwoColumn ? Math.max(220, h - copyHeight - 30) : Math.max(170, h - 390)
      const availableWidth = Math.max(220, Math.min(600, stageContainer.clientWidth || w - 36, w - 36))
      const renderedScale = isTwoColumn
        // Books: doubled per user request — height fit is relaxed (×2) but the
        // width fit still uses the measured column so books never crop.
        ? Math.min(0.85, availableWidth / 600, (availableHeight / 600) * 2)
        // Stacked phones: fill the measured width/height without cropping.
        : Math.min(0.9, availableWidth / 600, (availableHeight / 600) * 1.5)
      // Book composition is authored on a 600px-wide stage; on phones the
      // three books sit inside the (narrower) visual column.
      const compositionWidth = Math.min(600, stageContainer.clientWidth || w - 36)
      stageWrap.style.setProperty("--hero-book-scale", String(renderedScale))
      stageWrap.style.setProperty("--hero-layout-width", `${Math.min(600, stageContainer.clientWidth || 600)}px`)
      const positions = isTwoColumn
        ? { left: 0, center: 180, right: 360 }
        : { left: Math.max(0, compositionWidth / 2 - 230), center: compositionWidth / 2 - 120, right: Math.max(0, compositionWidth / 2 + 26) }
      stageWrap.style.setProperty("--hero-x-left", `${positions.left}px`)
      stageWrap.style.setProperty("--hero-x-center", `${positions.center}px`)
      stageWrap.style.setProperty("--hero-x-right", `${positions.right}px`)
      stageWrap.style.height = `${560 * renderedScale + 90}px`
      stageWrap.style.minHeight = `${560 * renderedScale + 90}px`
      if (isTwoColumn && h > 820) {
        hero.style.height = "100svh"
        hero.style.minHeight = "100svh"
        hero.style.paddingTop = "74px"
        hero.style.paddingBottom = "14px"
      } else {
        hero.style.height = "auto"
        hero.style.minHeight = "100svh"
        hero.style.paddingTop = "calc(68px + env(safe-area-inset-top) + 28px)"
        hero.style.paddingBottom = "32px"
      }
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(stageContainer)
    window.addEventListener("resize", fit)
    return () => { observer.disconnect(); window.removeEventListener("resize", fit) }
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    gsap.registerPlugin(ScrollTrigger)
    const allowMotion = window.matchMedia("(prefers-reduced-motion: no-preference)").matches
    const cleanups: Array<() => void> = []
    const ctx = gsap.context(() => {
      if (allowMotion) {
        const preDelay = document.documentElement.dataset.preloader === "run" ? 1.25 : 0
        const tl = gsap.timeline({ delay: preDelay, defaults: { ease: "power4.out" } })
        tl.from(".v3-spine-row i", { yPercent: 100, stagger: { each: 0.01, from: "random" }, duration: 0.55 }, 0)
          .from(".v3-eyebrow", { y: 18, opacity: 0, duration: 0.5 }, 0.08)
          .from(".v3-h1 > span > span", { yPercent: 110, duration: 1.1, stagger: 0.12 }, 0.12)
          .from(".v3-hero-sub,.v3-hero-actions > *, .v3-trust", { y: 20, opacity: 0, duration: 0.55, stagger: 0.1 }, 0.46)
          .from(".v3-book-position .bk", { y: 140, opacity: 0, duration: 1.5, stagger: 0.15 }, 0.28)
          .from(".v3-chip", { scale: 0.8, opacity: 0, duration: 0.5, stagger: 0.12 }, 0.9)
        gsap.to(".v3-book-position .bk", { y: "-=14", duration: 3.5, ease: "sine.inOut", yoyo: true, repeat: -1, stagger: 0.45 })
        // Marquee is CSS-keyframed so this timeline does not fight the track transform.

        // "How it works": reference-file pinned story. On desktop the whole
        // section pins while a scrubbed timeline plays the preparation story —
        // manuscript lines fill, the page slides away, format chips pop and
        // the submission checklist lands — while the step list lights up one
        // step at a time from scrub progress. Mobile and reduced-motion fall
        // back to plain enter-reveals with a scroll-highlighted active step.
        const howSteps = gsap.utils.toArray<HTMLElement>(".v3-how .v3-step")
        const activate = (i: number) => howSteps.forEach((step, k) => step.classList.toggle("is-active", k === i))
        if (window.matchMedia("(min-width: 900px)").matches) {
          activate(0)
          const story = gsap.timeline({
            scrollTrigger: {
              trigger: ".v3-how",
              start: "top top",
              end: "+=3200",
              pin: true,
              scrub: 0.6,
              onUpdate: (self) => activate(Math.min(4, Math.floor(self.progress * 5))),
            },
          })
          story
            .fromTo(
              ".v3-how .v3-manuscript i",
              { width: 0 },
              { width: (i: number) => `${70 + ((i * 37) % 30)}%`, duration: 3, stagger: 0.25, ease: "none" },
            )
            .to(".v3-how .v3-manuscript", { yPercent: -105, duration: 1.2, ease: "power2.inOut" }, "+=.3")
            .from(".v3-how .v3-format-chips span", { y: 20, opacity: 0, duration: 0.6, stagger: 0.2 }, "-=.2")
            .from(".v3-how .v3-package-card", { x: 80, opacity: 0, duration: 0.8 }, "+=.2")
            .from(".v3-how .v3-package-card span", { x: 20, opacity: 0, duration: 0.5, stagger: 0.3 })
            .from(".v3-how .v3-package-card strong", { scale: 0.9, opacity: 0, duration: 0.5 })
            .to(".v3-how .v3-package-card strong", { scale: 1.06, yoyo: true, repeat: 3, duration: 0.3 })
        } else {
          howSteps.forEach((step, k) => {
            gsap.from(step, {
              x: k % 2 ? 32 : -32,
              opacity: 0,
              duration: 0.65,
              ease: "power3.out",
              scrollTrigger: { trigger: step, start: "top 88%", once: true },
            })
          })
          gsap.from(gsap.utils.toArray<HTMLElement>(
            ".v3-how .v3-story-cover, .v3-how .v3-format-chips, .v3-how .v3-package-card",
          ), { y: 46, opacity: 0, scale: 0.94, duration: 0.7, stagger: 0.16, ease: "power3.out", scrollTrigger: { trigger: ".v3-story-stage", start: "top 78%", once: true } })
        }

        const reveals = gsap.utils.toArray<HTMLElement>(".rv,.v3-feature-card")
        reveals.forEach((el, i) => gsap.from(el, { y: 50, opacity: 0, duration: 0.75, delay: el.classList.contains("v3-feature-card") ? (i % 6) * 0.1 : 0, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 88%", once: true } }))

        root.querySelectorAll<HTMLElement>(".mag").forEach((button) => {
          const xTo = gsap.quickTo(button, "x", { duration: 0.35, ease: "power3.out" })
          const yTo = gsap.quickTo(button, "y", { duration: 0.35, ease: "power3.out" })
          const move = (event: MouseEvent) => { const r = button.getBoundingClientRect(); xTo((event.clientX - r.left - r.width / 2) * 0.25); yTo((event.clientY - r.top - r.height / 2) * 0.35) }
          const reset = () => { xTo(0); yTo(0) }
          button.addEventListener("mousemove", move)
          button.addEventListener("mouseleave", reset)
          cleanups.push(() => { button.removeEventListener("mousemove", move); button.removeEventListener("mouseleave", reset) })
        })

        const stage = stageRef.current
        if (stage && window.matchMedia("(hover:hover) and (pointer:fine)").matches) {
          const rx = gsap.quickTo(stage, "rotationX", { duration: 1, ease: "power3.out" })
          const ry = gsap.quickTo(stage, "rotationY", { duration: 1, ease: "power3.out" })
          const move = (event: MouseEvent) => { const r = stage.getBoundingClientRect(); ry(((event.clientX-r.left)/r.width-.5)*18); rx(-((event.clientY-r.top)/r.height-.5)*12) }
          const reset = () => { rx(0); ry(0) }
          stage.addEventListener("mousemove", move)
          stage.addEventListener("mouseleave", reset)
          cleanups.push(() => { stage.removeEventListener("mousemove", move); stage.removeEventListener("mouseleave", reset) })
        }

        const refresh = () => ScrollTrigger.refresh()
        document.fonts?.ready.then(refresh)
        window.addEventListener("load", refresh, { once: true })
        cleanups.push(() => window.removeEventListener("load", refresh))
      }
    }, root)
    return () => { cleanups.forEach((cleanup) => cleanup()); ctx.revert() }
  }, [])

  return (
    <>
      <div ref={rootRef} className="landing poster v3-poster">
        <Preloader />
        <PaperGrain />
        <Masthead
          signedIn={signedIn}
          primaryHref={primaryHref}
          signInHref={signInHref}
          homeHref={homeHref}
        />

        <main id="main-content">
        <Hero signedIn={signedIn} primaryHref={primaryHref} signInHref={signInHref} stageRef={stageRef} />

        <div className="v3-ribbon" aria-hidden="true">
          <div className="v3-ribbon-track">
            {(["Amazon KDP", "Apple Books", "IngramSpark", "EPUB", "MOBI", "Print PDF"] as const).map((item, i) => (
              <span className="v3-ribbon-item" key={item}>
                {item}{i < 5 && <b aria-hidden="true">★</b>}
              </span>
            ))}
          </div>
        </div>

        <LearnBento />

        <HowItWorksTour />

        <CoversShelf />

        <section className="v3-section v3-control" id="control">
          <div className="v3-container v3-control-inner">
            <span className="v3-label">Human on the switch</span>
            <h2>It stops.<br />You decide.</h2>
            <p>
              It cannot publish, spend, or run up a bill without a person saying so. Bring your own
              model key and your words never pass through anyone else&apos;s account.
            </p>
            <a className="v3-btn v3-btn-ink mag" href="#why">
              Why we built it
            </a>
          </div>
        </section>

        <WhoItsFor />

        <FounderNote />

        <PricingSection signedIn={signedIn} primaryHref={primaryHref} />

        <Faq />

        <FinalCta primaryHref={primaryHref} label={primaryLabel} />

        <MobileCtaBar primaryHref={primaryHref} label={primaryLabel} />

        <SiteFooter
          signedIn={signedIn}
          primaryHref={primaryHref}
          signInHref={signInHref}
          homeHref={homeHref}
        />
        </main>
      </div>
    </>
  )
}
