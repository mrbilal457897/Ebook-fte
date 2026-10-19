/**
 * "Who it's for" — two honest columns, fit and not-fit (spec 005 Part IV §26,
 * §7 row 5).
 *
 * The not-fit column exists because the product's real boundaries are a
 * selling point to the right reader and a warning to the wrong one. Saying
 * "publishing is prepare-and-validate and the final click is yours" up front
 * is the same honesty the rest of the page owes (§8.1), applied to audience
 * instead of a feature blurb.
 *
 * NO INVENTED PERSONAS. Every line is derived from documented product facts:
 * the supervised-worker model, the free-tier cap, BYOK, prepare-and-validate
 * publishing, no guaranteed outcomes. Nothing here is a guess at who the
 * customer "probably" is.
 *
 * SPEC: specs/005-visual-identity-scroll-hero/spec.md §26.
 */

const FOR_YOU = [
  "You have a book in your head and no realistic way to draft it a chapter at a time.",
  "You want the cover, the EPUB, the print file and the publishing checklist handled alongside the text — not bolted on after.",
  "You would rather supervise the parts that cost money or go live than babysit every sentence.",
]

const NOT_FOR_YOU = [
  "You want something published without reading it. Publishing here is prepare-and-validate; the final Publish click is yours, always.",
  "You need a guaranteed bestseller. No tool can promise that, and this one does not pretend to.",
  "You want bulk content shipped without review. The free tier is capped, and every costly action waits for a human.",
]

export default function WhoItsFor() {
  return (
    <section className="landing-section landing-fit" aria-labelledby="fit-title">
      <h2 className="landing-section-title" id="fit-title" data-reveal>
        Who it&rsquo;s for
      </h2>

      <div className="fit-grid">
        <div className="fit-col" data-reveal>
          <h3 className="fit-heading">Made for you if&hellip;</h3>
          <ul className="fit-list">
            {FOR_YOU.map((item) => (
              <li className="fit-item fit-item-yes" key={item}>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="fit-col" data-reveal>
          <h3 className="fit-heading">Not the right tool if&hellip;</h3>
          <ul className="fit-list">
            {NOT_FOR_YOU.map((item) => (
              <li className="fit-item fit-item-no" key={item}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
