"use client"

const CARDS = [
  {
    num: "01",
    title: "The writing end to end",
    body: "Outline, chapters, and a draft you can steer. Ask for a warmer tone or a slower opening and it revises the text without rewriting what you liked.",
    color: "var(--yellow)",
  },
  {
    num: "02",
    title: "Covers with foil, not clip-art",
    body: "Describe a look in a sentence and get two to four distinct directions to choose between, each with its own prompt you can refine.",
    color: "var(--coral)",
  },
  {
    num: "03",
    title: "Formatted for the shelf",
    body: "EPUB and MOBI that reflow properly, plus print-ready PDF with trim size, margins and spine calculated from your page count.",
    color: "var(--mint)",
  },
  {
    num: "04",
    title: "A package you can submit",
    body: "Your files and metadata are validated against KDP, Apple Books and IngramSpark, then you get a per-platform checklist of exactly what to press. We never press Publish for you.",
    color: "var(--white)",
  },
  {
    num: "05",
    title: "Marketing on your own account",
    body: "Ad copy written per platform, and campaigns created in the ad account you connect yourself. Nothing spends without your approval.",
    color: "var(--blue)",
    text: "var(--white)",
  },
  {
    num: "06",
    title: "An audiobook, your narrator",
    body: "Pick a narrator voice that fits the genre, hear a sample, then render the full book to audio — the same text, spoken.",
    color: "var(--yellow)",
  },
]

export default function LearnBento() {
  return (
    <section className="poster-section" id="features" aria-labelledby="bento-title">
      <span className="poster-kicker">Everything from idea to published</span>
      <h2 className="poster-h2" id="bento-title" style={{ marginTop: 18, marginBottom: "clamp(24px, 6vw, 40px)" }}>
        A whole publishing house in one tab.
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 22,
        }}
      >
        {CARDS.map((card) => (
          <article
            key={card.num}
            className="poster-card"
            style={{ background: card.color, color: card.text || "var(--ink)" }}
          >
            <span className="poster-mono" style={{ display: "block", marginBottom: 12 }}>
              {card.num}
            </span>
            <h3 className="poster-h3" style={{ marginBottom: 10 }}>
              {card.title}
            </h3>
            <p style={{ lineHeight: 1.6 }}>{card.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
