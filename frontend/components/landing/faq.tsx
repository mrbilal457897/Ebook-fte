"use client"

const FAQS = [
  {
    q: "I have never written anything. Do I need experience?",
    a: "No. The first thing the assistant does is walk you through your idea in plain language — a genre and a mood is enough to begin. If you get stuck it answers questions rather than handing you a blank page.",
  },
  {
    q: "What if I don't like what it writes?",
    a: "Then you change it, and nothing is lost. Ask for a different tone, revise a single chapter, or start again — every draft is saved and versioned as it streams, so you can always go back to the version you preferred.",
  },
  {
    q: "Do I own the rights to what it writes?",
    a: "The output is yours. We do not resell your text, train on your books, or publish anything under our name. Bring your own model key if you would rather the writing never passed through anyone else's account at all.",
  },
  {
    q: "What does publishing actually cost me?",
    a: "The service has three free books and a paid tier after that. Publishing is separate: KDP and IngramSpark charge their own fees, and Apple Books is free, and none of those costs come through us. We show you which applies before you commit.",
  },
  {
    q: "Can I use my own OpenAI or Anthropic key?",
    a: "Yes, and it is the recommended path for existing subscribers. Connect your own provider key and the writing runs on your account, billed to you at your rate. We also work out of the box if you would rather not.",
  },
  {
    q: "What happens after my three free books?",
    a: "Nothing disappears and nothing is deleted. You keep every draft and cover you made; you can still read and export them. Generating more books needs a paid plan, which is where the free tier ends.",
  },
]

export default function Faq() {
  return (
    <section className="v3-section v3-faq" id="faq" aria-labelledby="landing-faq-title">
      <div className="v3-container">
      <h2 className="v3-h2" id="landing-faq-title">
        Questions people actually ask
      </h2>

      <div className="v3-faq-grid">
        {FAQS.map((faq) => (
          <details key={faq.q} className="v3-faq-item">
            <summary>
              {faq.q}
            </summary>
            <div className="v3-faq-answer">
              <p>{faq.a}</p>
            </div>
          </details>
        ))}
      </div>
      </div>
    </section>
  )
}
