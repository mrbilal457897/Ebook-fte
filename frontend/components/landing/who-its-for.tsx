export default function WhoItsFor() {
  return (
    <section className="poster-section" aria-labelledby="fit-title">
      <h2 className="poster-h2" id="fit-title" style={{ marginBottom: "clamp(24px, 6vw, 40px)" }}>
        Who it&rsquo;s for
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
        <article className="poster-card poster-card--mint">
          <h3 className="poster-h3" style={{ marginBottom: 12 }}>
            Made for you if&hellip;
          </h3>
          <ul style={{ display: "flex", flexDirection: "column", gap: 10, lineHeight: 1.6, paddingLeft: 18 }}>
            <li>You have a book in your head and no realistic way to draft it a chapter at a time.</li>
            <li>You want the cover, the EPUB, the print file and the publishing checklist handled alongside the text.</li>
            <li>You would rather supervise the parts that cost money or go live than babysit every sentence.</li>
          </ul>
        </article>

        <article className="poster-card poster-card--coral">
          <h3 className="poster-h3" style={{ marginBottom: 12 }}>
            Not the right tool if&hellip;
          </h3>
          <ul style={{ display: "flex", flexDirection: "column", gap: 10, lineHeight: 1.6, paddingLeft: 18 }}>
            <li>You want something published without reading it. The final Publish click is yours, always.</li>
            <li>You need a guaranteed bestseller. No tool can promise that.</li>
            <li>You want bulk content shipped without review. The free tier is capped, and costly actions wait for a human.</li>
          </ul>
        </article>
      </div>
    </section>
  )
}
