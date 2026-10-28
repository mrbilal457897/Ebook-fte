"use client"

import { Book, COVERS } from "@/components/landing/book"

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
    <section className="v3-section v3-how" id="how-it-works" aria-labelledby="tour-title">
      <div className="v3-container v3-how-grid">
        <div className="v3-how-copy">
        <span className="v3-label">
          How it works
        </span>
        <h2 className="v3-h2" id="tour-title">
          Five steps. Only the last one is yours.
        </h2>

        <ol className="v3-step-list">
          {STEPS.map((step, index) => (
            <li key={step.num} className={`v3-step${index === 4 ? " is-last" : ""}`}>
              <span className="v3-step-num">
                {step.num}
              </span>
              <div><h3>{step.title}</h3><p>{step.body}</p></div>
            </li>
          ))}
        </ol>

        <p className="v3-label v3-script-note">
          Step 3 is a scripted demonstration using the real writing panel — not a recording of a
          session. It lets you see a finished draft without spending one of your free books.
        </p>
        </div>
        <div className="v3-story-stage" aria-label="Book preparation story preview">
          <div className="v3-story-cover"><Book cover={COVERS[2]} decorative /></div>
          <div className="v3-manuscript" aria-hidden="true">
            <strong>The Quiet Tide</strong>
            <i /><i /><i /><i /><i /><i /><i />
          </div>
          <div className="v3-format-chips"><span>EPUB</span><span>MOBI</span><span>PDF</span></div>
          <div className="v3-package-card">
            <b>Submission package</b>
            <span>✓ &nbsp;KDP</span><span>✓ &nbsp;Apple Books</span><span>✓ &nbsp;IngramSpark</span>
            <strong>Publish · your click</strong>
          </div>
        </div>
      </div>
    </section>
  )
}
