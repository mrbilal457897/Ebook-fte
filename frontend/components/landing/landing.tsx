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
import Preloader from "@/components/landing/preloader"
import PaperGrain from "@/components/landing/paper-grain"
import AuroraBackground from "@/components/landing/aurora-background"
import { useMagneticButtons, useSectionReveal } from "@/components/landing/motion-hooks"

/**
 * Composition root for the public landing page at `/`.
 *
 * This file arranges sections and holds the two page-wide behaviours (section
 * entrance, magnetic buttons). It owns no choreography of its own — every
 * animation belongs to the component that has the elements it animates, which is
 * why two timelines can never end up fighting over the same node.
 *
 * SECTION ORDER is the Step-4 SaaS order recorded in
 * `specs/005-visual-identity-scroll-hero/spec.md` §7 (Part IV §25 supersedes the
 * old §7 order):
 *
 *   hero → trust → capabilities bento → how-it-works tour → who it's for →
 *   founder note → pricing → FAQ → one closing ask
 *
 * The old alternating feature rows, standalone demo, and standalone steps are
 * superseded (bento + tour absorb them); their files remain on disk, unimported.
 * Still no testimonial section — not an empty one. It returns when there are
 * real attributed quotes.
 *
 * TENANT THREADING (FR-010) lives here and nowhere else: every link toward auth
 * carries `?tenant=<slug>`, and a visitor who arrived on a subscribing company's
 * branded link must stay bound to it. The slug is threaded into the masthead,
 * the hero, the pricing CTA, the final CTA, and the mobile CTA bar; in-page
 * anchors never carry it because they are not tenant-scoped (§10).
 *
 * An already-authed visitor sees the same page with the primary action pointed at
 * their workspace instead of a redundant sign-up.
 */
export default function Landing({
  signedIn,
  tenantSlug,
}: {
  signedIn: boolean
  tenantSlug: string
}) {
  const rootRef = useRef<HTMLDivElement>(null)

  useSectionReveal(rootRef)
  useMagneticButtons(rootRef)

  const tenantQuery = `?tenant=${encodeURIComponent(tenantSlug)}`
  const homeHref = `/${tenantQuery}`
  const primaryHref = signedIn ? "/generate" : `/signup${tenantQuery}`
  const signInHref = `/signin${tenantQuery}`
  const primaryLabel = signedIn ? "Go to workspace" : "Start writing free"

  return (
    <>
      <Preloader />
      <AuroraBackground />
      <PaperGrain />

      <div ref={rootRef} className="landing">
        <Masthead
          signedIn={signedIn}
          primaryHref={primaryHref}
          signInHref={signInHref}
          homeHref={homeHref}
        />

        <Hero signedIn={signedIn} primaryHref={primaryHref} signInHref={signInHref} />

        <SocialProof />

        <LearnBento />

        <HowItWorksTour />

        <WhoItsFor />

        <FounderNote />

        <PricingSection signedIn={signedIn} primaryHref={primaryHref} />

        <Faq />

        <FinalCta primaryHref={primaryHref} label={primaryLabel} />

        <MobileCtaBar primaryHref={primaryHref} label={primaryLabel} />

        <SiteFooter signedIn={signedIn} primaryHref={primaryHref} signInHref={signInHref} />
      </div>
    </>
  )
}
