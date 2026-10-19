/**
 * Founder note — "why we built it" (spec 005 Part IV §26, §7 row 6).
 *
 * ############################################################################
 * # OWNER ACTION BEFORE LAUNCH — when a real, named founder exists, this     #
 * # becomes their note in their words, with their name and (if wanted) a     #
 * # portrait. Until then it is first-person PLURAL and signed by the team:   #
 * # a fabricated founder with a stock headshot is the same species of lie    #
 * # as a fabricated statistic (§8.2), applied to identity instead of numbers.#
 * ############################################################################
 *
 * No link, no portrait placeholder, no invented name. When the real note
 * exists it replaces this text wholesale.
 *
 * SPEC: specs/005-visual-identity-scroll-hero/spec.md §26.
 */

export default function FounderNote() {
  return (
    <section className="landing-founder" aria-labelledby="founder-title">
      <h2 className="landing-section-title" id="founder-title" data-reveal>
        Why we built it
      </h2>

      <div className="founder-body" data-reveal>
        <p>
          We kept meeting the same two people. One had the idea and the expertise but no two free
          years to draft a book around a job. The other had finished a manuscript, then lost a month
          to trim sizes, metadata forms and platform checklists, and almost gave up there.
        </p>
        <p>
          E-book FTE is the worker we wanted to hand them: it drafts, designs, formats and prepares
          the package, and then it stops. It cannot publish, spend, or run up a bill without a
          person saying so. The parts that are easy to regret stay human.
        </p>
        <p>
          Your words stay yours. Use our models, or bring your own key so the writing never passes
          through anyone else&rsquo;s account. The book is the product &mdash; it is never the thing
          we sell.
        </p>
        <p className="founder-sign">&mdash; The E-book FTE team</p>
      </div>
    </section>
  )
}
