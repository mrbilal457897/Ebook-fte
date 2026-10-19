/**
 * Social-proof strip: ONE slot, deliberately unfilled.
 *
 * ############################################################################
 * # OWNER ACTION REQUIRED BEFORE LAUNCH — this slot ships empty on purpose.   #
 * # There is no real usage figure yet. A believable placeholder ("12,000+     #
 * # books created") is worse than an obvious gap, because it ships unnoticed.  #
 * # Replace the contents of `STAT_FIGURES` with a real, sourced number, or    #
 * # delete this whole section. Do not invent one.                             #
 * ############################################################################
 *
 * Same rule bars invented review quotes, customer counts, ratings and "trusted
 * by" logo walls. There is no testimonial section on this page at all — not an
 * empty one. It comes back when there are real attributed quotes.
 *
 * SPEC: specs/005-visual-identity-scroll-hero/spec.md §8.2, §8.3.
 */

const STAT_FIGURES = [
  { value: "—", label: "books published through E-book FTE" },
  { value: "—", label: "authors using it" },
  { value: "—", label: "average time to first draft" },
]

export default function SocialProof() {
  return (
    <section className="landing-proof" aria-labelledby="landing-proof-title">
      <h2 className="landing-proof-title" id="landing-proof-title">
        By the numbers
      </h2>

      {/*
        aria-hidden on the section? No — deliberately not. The heading is real
        content. What is hidden is only the *emptiness*: a screen reader hearing
        "books published through E-book FTE" is being told the truth, which is
        that we have no figure to give yet. Announcing "—" three times would be
        noise.
      */}
      <ul className="landing-proof-list">
        {STAT_FIGURES.map((stat) => (
          <li className="landing-proof-item" key={stat.label}>
            <span className="landing-proof-value" aria-hidden="true">
              {stat.value}
            </span>
            <span className="landing-proof-label">{stat.label}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
