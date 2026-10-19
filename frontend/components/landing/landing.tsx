"use client"

import { useRef } from "react"
import Masthead from "@/components/landing/masthead"
import Hero from "@/components/landing/hero"
import SocialProof from "@/components/landing/social-proof"
import SeeItInAction from "@/components/landing/see-it-in-action"
import FeatureRows from "@/components/landing/feature-rows"
import HowItWorks from "@/components/landing/how-it-works"
import Faq from "@/components/landing/faq"
import FinalCta from "@/components/landing/final-cta"
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
 * SECTION ORDER is a pacing decision recorded in
 * `specs/005-visual-identity-scroll-hero/spec.md` §7: hero, social proof, the
 * differentiator (watch it write), capabilities, the real flow, the questions,
 * one closing ask. There is deliberately no testimonial section — not an empty
 * one. It returns when there are real attributed quotes.
 *
 * TENANT THREADING (FR-010) lives here and nowhere else: every link toward auth
 * carries `?tenant=<slug>`, and a visitor who arrived on a subscribing company's
 * branded link must stay bound to it. The slug is threaded into the masthead and
 * the hero; in-page anchors never carry it because they are not tenant-scoped.
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

        <SeeItInAction />

        <FeatureRows />

        <HowItWorks />

        <Faq />

        <FinalCta
          primaryHref={primaryHref}
          label={signedIn ? "Go to workspace" : "Start writing free"}
        />

        <SiteFooter signedIn={signedIn} primaryHref={primaryHref} signInHref={signInHref} />
      </div>
    </>
  )
}
