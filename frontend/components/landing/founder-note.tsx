export default function FounderNote() {
  return (
    <section className="poster-section" id="why-we-built-it" aria-labelledby="founder-title">
      <h2 className="poster-h2" id="founder-title" style={{ marginBottom: "clamp(24px, 6vw, 40px)" }}>
        Why we built it
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 880 }}>
        <p style={{ fontSize: "clamp(18px, 2vw, 28px)", fontWeight: 600, lineHeight: 1.4 }}>
          We kept meeting the same two people. One had the idea and the expertise but no two free
          years to draft a book around a job. The other had finished a manuscript, then lost a month
          to trim sizes, metadata forms and platform checklists, and almost gave up there.
        </p>
        <p style={{ fontSize: "clamp(17px, 1.6vw, 22px)", lineHeight: 1.6 }}>
          E-book FTE is the worker we wanted to hand them: it drafts, designs, formats and prepares
          the package, and then it stops. It cannot publish, spend, or run up a bill without a person
          saying so. The parts that are easy to regret stay human.
        </p>
        <p style={{ fontSize: "clamp(17px, 1.6vw, 22px)", lineHeight: 1.6 }}>
          Your words stay yours. Use our models, or bring your own key so the writing never passes
          through anyone else&apos;s account. The book is the product — it is never the thing we sell.
        </p>
        <p className="poster-mono">&mdash; The E-book FTE team</p>
      </div>
    </section>
  )
}
