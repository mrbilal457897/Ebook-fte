"use client"

import Link from "next/link"

export default function PricingSection({ signedIn, primaryHref }: { signedIn: boolean; primaryHref: string }) {
  return (
    <section className="v3-section v3-light v3-pricing" id="pricing" aria-labelledby="pricing-title">
      <div className="v3-container v3-pricing-grid">
        <div>
          <span className="v3-label">Pricing</span>
          <h2 className="v3-h2" id="pricing-title">
            Free to start. Seriously.
          </h2>
          <p className="v3-pricing-lede">
            Paid plans arrive with billing. Pricing is announced before launch, so no surprise charges.
          </p>
        </div>

        <article className="v3-price-card">
          <span className="v3-label">Free tier</span>
          <div className="v3-price-amount">
            $0
          </div>
          <ul className="v3-price-list">
            <li>3 books start to finish</li>
            <li>Cover concepts and revisions</li>
            <li>EPUB, MOBI, print PDF</li>
            <li>Per-platform checklists</li>
            <li>Bring your own key</li>
            <li>No card required</li>
          </ul>
          <Link className="v3-btn v3-btn-ivory mag" href={primaryHref}>
            {signedIn ? "Go to your workspace" : "Start writing free"}
          </Link>
        </article>
      </div>
    </section>
  )
}
