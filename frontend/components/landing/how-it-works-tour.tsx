"use client"

const STEPS = [
  {
    num: "01",
    title: "Sign up",
    body: "Three books free, no card. Sign in with Google or email, and you are writing inside a minute.",
  },
  {
    num: "02",
    title: "Say what you want",
    body: "One line is enough — a genre, a mood, a half-formed idea. You never have to plan an outline before you can start.",
  },
  {
    num: "03",
    title: "Watch it write",
    body: "Your draft streams in word by word and is saved the instant it appears. Stop it, pick it back up later, change the tone — nothing is lost while you think.",
  },
  {
    num: "04",
    title: "Review cover and format",
    body: "Pick a cover direction, then check the EPUB and the print PDF with your trim size, margins and spine already calculated.",
  },
  {
    num: "05",
    title: "Publish when you are ready",
    body: "You get a validated package and a per-platform checklist for KDP, Apple Books and IngramSpark. The final Publish click is yours.",
  },
]

export default function HowItWorksTour() {
  return (
    <section className="poster-section" id="how-it-works" aria-labelledby="tour-title" style={{ background: "var(--ink)", color: "var(--white)", maxWidth: "100%", padding: "clamp(72px, 12vw, 112px) var(--space-4)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <span className="poster-kicker" style={{ background: "var(--yellow)", color: "var(--ink)" }}>
          How it works
        </span>
        <h2 className="poster-h2" id="tour-title" style={{ marginTop: 18, marginBottom: "clamp(24px, 6vw, 40px)" }}>
          Five steps. Only the last one is yours.
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 18,
          }}
        >
          {STEPS.map((step, index) => (
            <article
              key={step.num}
              className="poster-card"
              style={{
                background: index === 4 ? "var(--coral)" : "transparent",
                color: index === 4 ? "var(--ink)" : "var(--white)",
                borderColor: "var(--white)",
                boxShadow: index === 4 ? "var(--shadow-lg)" : "none",
              }}
            >
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(2.4rem, 6vw, 4rem)", color: "var(--yellow)" }}>
                {step.num}
              </span>
              <h3 className="poster-h3" style={{ marginTop: 10, marginBottom: 10 }}>
                {step.title}
              </h3>
              <p style={{ color: index === 4 ? "var(--ink)" : "#E4E1F5", lineHeight: 1.6 }}>
                {step.body}
              </p>
            </article>
          ))}
        </div>

        <p className="poster-mono" style={{ marginTop: 18, color: "rgba(255,255,255,0.7)" }}>
          Step 3 is a scripted demonstration using the real writing panel — not a recording of a
          session. It lets you see a finished draft without spending one of your free books.
        </p>
      </div>
    </section>
  )
}
