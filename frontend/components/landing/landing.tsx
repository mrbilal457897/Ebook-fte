"use client"

import { useRef } from "react"
import Masthead from "@/components/landing/masthead"
import Hero from "@/components/landing/hero"
import SocialProof from "@/components/landing/social-proof"
import LearnBento from "@/components/landing/learn-bento"
import HowItWorksTour from "@/components/landing/how-it-works-tour"
import WhoItsFor from "@/components/landing/who-its-for"
import FounderNote from "@/components/landing/founder-note"
import PricingSection from "@/components/landing/pricing-section"
import Faq from "@/components/landing/faq"
import FinalCta from "@/components/landing/final-cta"
import MobileCtaBar from "@/components/landing/mobile-cta-bar"
import SiteFooter from "@/components/landing/site-footer"
import PaperGrain from "@/components/landing/paper-grain"

export default function Landing({
  signedIn,
  tenantSlug,
}: {
  signedIn: boolean
  tenantSlug: string
}) {
  const rootRef = useRef<HTMLDivElement>(null)

  const tenantQuery = `?tenant=${encodeURIComponent(tenantSlug)}`
  const homeHref = `/${tenantQuery}`
  const primaryHref = signedIn ? "/generate" : `/signup${tenantQuery}`
  const signInHref = `/signin${tenantQuery}`
  const primaryLabel = signedIn ? "Go to workspace" : "Start writing free"

  return (
    <>
      <div ref={rootRef} className="landing poster">
        <PaperGrain />
        <Masthead
          signedIn={signedIn}
          primaryHref={primaryHref}
          signInHref={signInHref}
          homeHref={homeHref}
        />

        <Hero signedIn={signedIn} primaryHref={primaryHref} signInHref={signInHref} />

        <div className="poster-ribbon" aria-hidden="true">
          <div className="poster-ribbon-inner">
            <span>Amazon KDP</span>
            <span className="poster-ribbon-dot">★</span>
            <span>Apple Books</span>
            <span className="poster-ribbon-dot">★</span>
            <span>IngramSpark</span>
            <span className="poster-ribbon-dot">★</span>
            <span>EPUB</span>
            <span className="poster-ribbon-dot">★</span>
            <span>MOBI</span>
            <span className="poster-ribbon-dot">★</span>
            <span>Print PDF</span>
          </div>
        </div>

        <SocialProof />

        <LearnBento />

        <HowItWorksTour />

        <section className="poster-section">
          <div className="poster-card poster-card--coral poster-control-block">
            <h2 className="poster-h2">It stops. You decide.</h2>
            <p className="poster-body" style={{ maxWidth: 760 }}>
              It cannot publish, spend, or run up a bill without a person saying so. Bring your own
              model key and your words never pass through anyone else&apos;s account.
            </p>
            <a className="poster-btn poster-btn--white" href="#why-we-built-it">
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
      </div>
    </>
  )
}
