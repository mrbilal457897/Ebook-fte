"use client"

import { PricingCard } from "@/components/ui"

/**
 * Pricing — one real tier (spec 005 Part IV §26, §7 row 7).
 *
 * ############################################################################
 * # OWNER ACTION BEFORE LAUNCH — paid tiers and dollar amounts must come     #
 * # from the confirmed Lago subscription decisions (AGENTS.md §2), not from  #
 * # here. Only the Free tier is shown because "3 free books, no card" is a  #
 * # documented product fact; inventing a price to look established is the   #
 * # §8.2 honesty contract applied to money.                                  #
 * ############################################################################
 *
 * The PricingCard is the Step-2 library component (`components/ui`), same
 * card used on /design-system — one pricing component across the product.
 *
 * SPEC: specs/005-visual-identity-scroll-hero/spec.md §26.
 */

type PricingSectionProps = {
  signedIn: boolean
  primaryHref: string
}

const FREE_FEATURES = [
  "3 books, start to finish",
  "Cover concepts and revisions",
  "EPUB, MOBI and print-ready PDF",
  "Per-platform publishing checklists",
  "Bring your own model key (BYOK)",
  "No card required",
]

export default function PricingSection({ signedIn, primaryHref }: PricingSectionProps) {
  return (
    <section
      className="landing-section landing-pricing"
      id="pricing"
      aria-labelledby="pricing-title"
    >
      <h2 className="landing-section-title" id="pricing-title" data-reveal>
        Pricing
      </h2>
      <p className="landing-section-sub" data-reveal>
        One real tier today. Paid plans launch with billing — nothing is charged until then.
      </p>

      <div className="pricing-wrap" data-reveal>
        <PricingCard
          name="Free"
          description="Everything you need to take one book from idea to a publishable package."
          price="$0"
          period="to start"
          features={FREE_FEATURES}
          cta={signedIn ? "Go to your workspace" : "Start my book free"}
          href={primaryHref}
          highlighted
          badge="Free tier"
        />
      </div>

      {/*
        Paid-plans note is deliberately vague on numbers: unlimited books and
        campaign workflows are documented product directions (AGENTS.md §2,
        ads + generation), but the price is an owner decision, not ours.
      */}
      <p className="pricing-note" data-reveal>
        Paid plans will add unlimited books and ad-campaign workflows. Pricing is announced before
        launch &mdash; you will never find a surprise charge here.
      </p>
    </section>
  )
}
