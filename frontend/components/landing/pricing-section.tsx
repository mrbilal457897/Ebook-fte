"use client"

import Link from "next/link"

export default function PricingSection({ signedIn, primaryHref }: { signedIn: boolean; primaryHref: string }) {
  return (
    <section className="poster-section" id="pricing" aria-labelledby="pricing-title" style={{ background: "var(--yellow)", maxWidth: "100%", marginTop: 0, padding: "clamp(72px, 12vw, 112px) var(--space-4)", borderTop: "3px solid var(--ink)", borderBottom: "3px solid var(--ink)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "clamp(24px, 6vw, 48px)", alignItems: "center" }}>
        <div>
          <span className="poster-kicker">Pricing</span>
          <h2 className="poster-h2" id="pricing-title" style={{ marginTop: 18, marginBottom: 14 }}>
            Free to start. Seriously.
          </h2>
          <p className="poster-body">
            Paid plans arrive with billing. Pricing is announced before launch, so no surprise charges.
          </p>
        </div>

        <article className="poster-card poster-pricing-card" style={{ boxShadow: "var(--shadow-xl)" }}>
          <span className="poster-mono">Free tier</span>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(4rem, 12vw, 8rem)", letterSpacing: "-0.05em", lineHeight: 0.9 }}>
            $0
          </div>
          <ul style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16, marginBottom: 24, lineHeight: 1.6 }}>
            <li>3 books start to finish</li>
            <li>Cover concepts and revisions</li>
            <li>EPUB, MOBI, print PDF</li>
            <li>Per-platform checklists</li>
            <li>Bring your own key</li>
            <li>No card required</li>
          </ul>
          <Link className="poster-btn poster-btn--blue" href={primaryHref} style={{ width: "100%" }}>
            {signedIn ? "Go to your workspace" : "Start writing free"}
          </Link>
        </article>
      </div>
    </section>
  )
}
