/**
 * "How it works": five numbered steps that mirror the actual product flow.
 *
 * These are the real steps, in the order a customer takes them: sign up,
 * describe the book, watch it generate, review the cover and format, publish
 * when ready. Step 5 is where the honest boundary sits — the product prepares
 * and validates the package and the customer presses Publish.
 *
 * SPEC: specs/005-visual-identity-scroll-hero/spec.md §7 (step 5), §8.1.
 */

const STEPS = [
  {
    title: "Sign up",
    body: "Three books free, no card. Sign in with Google or email, and you are writing inside a minute.",
  },
  {
    title: "Say what you want",
    body: "One line is enough — a genre, a mood, a half-formed idea. You never have to plan an outline before you can start.",
  },
  {
    title: "Watch it write",
    body: "Your draft streams in word by word and is saved the instant it appears. Stop it, pick it back up later, change the tone — nothing is lost while you think.",
  },
  {
    title: "Review the cover and the format",
    body: "Pick a cover direction, then check the EPUB and the print PDF with your trim size, margins and spine already calculated.",
  },
  {
    title: "Publish when you are ready",
    body: "You get a validated package and a per-platform checklist for KDP, Apple Books and IngramSpark. The final Publish click is yours.",
  },
]

export default function HowItWorks() {
  return (
    <section className="landing-section" id="how-it-works" aria-labelledby="landing-how-title">
      <h2 className="landing-section-title" id="landing-how-title" data-reveal>
        How it works
      </h2>

      <ol className="landing-steps">
        {STEPS.map((step, index) => (
          <li className="landing-step hover-lift" key={step.title} data-reveal>
            {/*
              The number is decorative: the list is an <ol>, so the position is
              already announced. Announcing "1" twice is worse than not
              announcing it at all.
            */}
            <span className="landing-step-index" aria-hidden="true">
              {index + 1}
            </span>
            <h3 className="landing-step-title">{step.title}</h3>
            <p className="landing-step-body">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
