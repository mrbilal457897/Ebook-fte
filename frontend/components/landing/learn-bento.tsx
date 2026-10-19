"use client"

import { useRef } from "react"
import { useMotion } from "@/lib/motion"
import { staggerReveal } from "@/lib/motion/presets"

/**
 * "What it does" — the capabilities bento (spec 005 Part IV §26, §7 row 3).
 *
 * REPLACES THE FIVE ALTERNATING FEATURE ROWS. Same copy discipline (§7's
 * density ceiling): one headline, ≤3 sentences, one visual per card. The
 * visuals are the same CSS-only, token-only art the rows used — no stock
 * photography, no borrowed imagery, no screenshots of states that do not
 * exist — plus one new CSS waveform for the audiobook card.
 *
 * PUBLISHING'S WORDING IS CONSTRAINED BY §8.1: we validate and prepare a
 * package and hand over a checklist. We never press Publish.
 *
 * STAGGERED ENTRANCE is this section's own `useMotion` + `staggerReveal`
 * (cards are deliberately NOT `data-reveal`, so the page-wide reveal in
 * landing.tsx cannot double-animate them). Reduced motion: the preset's
 * gate never runs, cards are simply content.
 *
 * LAYOUT: 3 columns, writing card featured (2 cols, visual beside copy),
 * audiobook a full-width strip, everything 1 column under 768px in DOM order
 * — no layout reorders content for screen readers (§13's surviving rule).
 */

type Capability = {
  id: string
  title: string
  body: string
  visual: "content" | "cover" | "format" | "publish" | "marketing" | "voice"
  layout: "featured" | "default" | "full"
}

const CAPABILITIES: Capability[] = [
  {
    id: "content",
    title: "The writing, end to end",
    body: "Outline, chapters, and a draft you can steer. Ask for a warmer tone or a slower opening and it revises the text without rewriting what you liked.",
    visual: "content",
    layout: "featured",
  },
  {
    id: "cover",
    title: "Covers with foil, not clip-art",
    body: "Describe a look in a sentence and get two to four distinct directions to choose between, each with its own prompt you can refine.",
    visual: "cover",
    layout: "default",
  },
  {
    id: "format",
    title: "Formatted for the shelf it lands on",
    body: "EPUB and MOBI that reflow properly, plus print-ready PDF with trim size, margins and spine calculated from your page count.",
    visual: "format",
    layout: "default",
  },
  {
    id: "publish",
    title: "A package you can actually submit",
    body: "Your files and metadata are validated against KDP, Apple Books and IngramSpark, then you get a per-platform checklist of exactly what to press. We never press Publish for you.",
    visual: "publish",
    layout: "default",
  },
  {
    id: "marketing",
    title: "Marketing on your own ad account",
    body: "Ad copy written per platform, and campaigns created in the ad account you connect yourself. Nothing spends without your approval.",
    visual: "marketing",
    layout: "default",
  },
  {
    id: "voice",
    title: "An audiobook, in a voice you choose",
    body: "Pick a narrator voice that fits the genre, hear a sample, then render the full book to audio — the same text, spoken.",
    visual: "voice",
    layout: "full",
  },
]

function CardVisual({ kind }: { kind: Capability["visual"] }) {
  return (
    <div className="bento-visual" aria-hidden="true">
      {kind === "content" && (
        <>
          <span className="landing-visual-sheet" />
          <span className="landing-visual-caret" />
        </>
      )}

      {kind === "cover" && (
        <>
          <span className="landing-visual-cover">
            <span className="landing-visual-foil" />
          </span>
          <span className="landing-visual-cover landing-visual-cover-alt">
            <span className="landing-visual-foil" />
          </span>
        </>
      )}

      {kind === "format" && (
        <>
          <span className="landing-visual-page" />
          <span className="landing-visual-measure">
            <span className="landing-visual-measure-rule" />
            <span className="landing-visual-measure-label">6&Prime;&times;9&Prime;</span>
          </span>
        </>
      )}

      {kind === "publish" && (
        <>
          <span className="landing-visual-checklist">
            <span className="landing-visual-check">
              <span className="landing-visual-tick" />
            </span>
            <span className="landing-visual-check">
              <span className="landing-visual-tick" />
            </span>
            <span className="landing-visual-check">
              <span className="landing-visual-tick" />
            </span>
          </span>
          <span className="landing-visual-badge">ready</span>
        </>
      )}

      {kind === "marketing" && (
        <span className="landing-visual-ad">
          <span className="landing-visual-ad-rule" />
          <span className="landing-visual-ad-body" />
          <span className="landing-visual-ad-cta">Start reading</span>
        </span>
      )}

      {kind === "voice" && (
        <span className="landing-visual-wave">
          <span className="landing-visual-wave-bar" />
          <span className="landing-visual-wave-bar" />
          <span className="landing-visual-wave-bar" />
          <span className="landing-visual-wave-bar" />
          <span className="landing-visual-wave-bar" />
        </span>
      )}
    </div>
  )
}

export default function LearnBento() {
  const gridRef = useRef<HTMLDivElement>(null)

  useMotion(
    gridRef,
    (q, root) => {
      staggerReveal(q(".bento-card"), { scroll: { trigger: root }, y: 16, stagger: 0.06 })
    },
    [],
  )

  return (
    <section className="landing-section landing-bento" id="features" aria-labelledby="bento-title">
      <h2 className="landing-section-title" id="bento-title" data-reveal>
        Everything from idea to published
      </h2>

      <div className="bento-grid" ref={gridRef}>
        {CAPABILITIES.map((capability) => (
          <article
            className={`bento-card hover-lift bento-card-${capability.layout}`}
            key={capability.id}
          >
            <CardVisual kind={capability.visual} />
            <div className="bento-copy">
              <h3 className="bento-title">{capability.title}</h3>
              <p className="bento-body">{capability.body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
