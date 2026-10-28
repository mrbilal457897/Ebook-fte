export default function WhoItsFor() {
  return (
    <section className="v3-section v3-light v3-who" id="who" aria-labelledby="fit-title">
      <div className="v3-container">
      <h2 className="v3-h2" id="fit-title">Built for people with a book in their head.</h2>

      <div className="v3-who-grid">
        <article className="v3-who-card v3-who-sage">
          <h3>
            Made for you if&hellip;
          </h3>
          <ul>
            <li>You have a book in your head and no realistic way to draft it a chapter at a time.</li>
            <li>You want the cover, the EPUB, the print file and the publishing checklist handled alongside the text.</li>
            <li>You would rather supervise the parts that cost money or go live than babysit every sentence.</li>
          </ul>
        </article>

        <article className="v3-who-card v3-who-mustard">
          <h3>
            Not the right tool if&hellip;
          </h3>
          <ul>
            <li>You want something published without reading it. The final Publish click is yours, always.</li>
            <li>You need a guaranteed bestseller. No tool can promise that.</li>
            <li>You want bulk content shipped without review. The free tier is capped, and costly actions wait for a human.</li>
          </ul>
        </article>
      </div>
      </div>
    </section>
  )
}
