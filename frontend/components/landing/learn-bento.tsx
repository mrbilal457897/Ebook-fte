"use client"

const CARDS = [
  {
    num: "01",
    title: "The writing end to end",
    body: "Outline, chapters, and a draft you can steer. Ask for a warmer tone or a slower opening and it revises the text without rewriting what you liked.",
    color: "#F5B83D",
  },
  {
    num: "02",
    title: "Covers with foil, not clip-art",
    body: "Describe a look in a sentence and get two to four distinct directions to choose between, each with its own prompt you can refine.",
    color: "#0F4C4A",
    text: "#F4EFE6",
  },
  {
    num: "03",
    title: "Formatted for the shelf",
    body: "EPUB and MOBI that reflow properly, plus print-ready PDF with trim size, margins and spine calculated from your page count.",
    color: "#F26B3A",
  },
  {
    num: "04",
    title: "A package you can submit",
    body: "Your files and metadata are validated against KDP, Apple Books and IngramSpark, then you get a per-platform checklist of exactly what to press. We never press Publish for you.",
    color: "#6B1D2A",
    text: "#F5D9A8",
  },
  {
    num: "05",
    title: "Marketing on your own account",
    body: "Ad copy written per platform, and campaigns created in the ad account you connect yourself. Nothing spends without your approval.",
    color: "#BFE0C6",
  },
  {
    num: "06",
    title: "An audiobook, your narrator",
    body: "Pick a narrator voice that fits the genre, hear a sample, then render the full book to audio — the same text, spoken.",
    color: "#14163A",
    text: "#F2C879",
  },
]

export default function LearnBento() {
  return (
    <section className="v3-section v3-light v3-features" id="features" aria-labelledby="bento-title">
      <div className="v3-container">
      <span className="v3-label">Everything from idea to published</span>
      <h2 className="v3-h2" id="bento-title">
        A whole publishing house in one tab.
      </h2>

      <div
        className="v3-feature-grid"
      >
        {CARDS.map((card) => (
          <article
            key={card.num}
            className="v3-feature-card rv"
            style={{ background: card.color, color: card.text || "var(--ink)" }}
          >
            <span className="v3-card-number">
              {card.num}
            </span>
            <h3>
              {card.title}
            </h3>
            <p>{card.body}</p>
          </article>
        ))}
      </div>
      </div>
    </section>
  )
}
