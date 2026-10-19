"use client"

import { useId, useState } from "react"

/**
 * FAQ: the six questions a non-technical first-time author actually has.
 *
 * These answers do the product's real job on this page — reducing first-use
 * fear, which is an explicit requirement for the Onboarding/Support Chatbot's
 * tone and therefore for every customer-facing surface.
 *
 * A REAL ACCORDION, not a list of toggles:
 * - Each trigger is a `<button>` with `aria-expanded` and `aria-controls`; each
 *   panel is labelled by its trigger. Divs with onClick are not buttons and are
 *   not keyboard reachable.
 * - ONE panel open at a time. Two open answers mean the section grows taller
 *   than the visitor expected and the "one answer" reading is lost.
 * - The panel is unmounted when closed rather than hidden with CSS, so its
 *   contents stay out of the accessibility tree and out of find-in-page.
 *
 * SPEC: specs/005-visual-identity-scroll-hero/spec.md §12.
 */

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
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const baseId = useId()

  return (
    <section className="landing-section landing-faq" id="faq" aria-labelledby="landing-faq-title">
      <h2 className="landing-section-title" id="landing-faq-title" data-reveal>
        Questions people actually ask
      </h2>

      <div className="landing-faq-list">
        {FAQS.map((faq, index) => {
          const isOpen = openIndex === index
          const triggerId = `${baseId}-q-${index}`
          const panelId = `${baseId}-a-${index}`

          return (
            <div className="landing-faq-item" key={faq.q} data-reveal>
              <h3 className="landing-faq-heading">
                <button
                  type="button"
                  className="landing-faq-trigger"
                  id={triggerId}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                >
                  <span className="landing-faq-question">{faq.q}</span>
                  {/* Decorative: the state is already on aria-expanded. */}
                  <span className="landing-faq-marker" aria-hidden="true" />
                </button>
              </h3>

              {isOpen && (
                <div
                  className="landing-faq-panel"
                  id={panelId}
                  role="region"
                  aria-labelledby={triggerId}
                >
                  <p className="landing-faq-answer">{faq.a}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
