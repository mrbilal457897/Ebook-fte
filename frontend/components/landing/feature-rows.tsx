/**
 * The five capability rows, alternating text/image sides on desktop.
 *
 * COPY CEILING, set by the hero: one short headline, 2–3 sentences maximum, one
 * visual, at most one secondary CTA. If a feature needs a paragraph to explain
 * itself, the feature needs a simpler description — not more words.
 *
 * VISUALS ARE CSS, BUILT FROM TOKENS. No stock photography, no borrowed imagery,
 * no screenshots of a product state that does not exist. Each visual is
 * `aria-hidden` decoration that illustrates its row's idea; the row's meaning is
 * entirely in the text beside it.
 *
 * ALTERNATION IS A DESKTOP LAYOUT EFFECT ONLY. Text is first in the DOM in every
 * row, so on mobile (one column) and for screen readers and keyboard users the
 * order is always word-then-illustration, and the alternation never reorders
 * content. That is `order` in the media query, not markup.
 *
 * SPEC: specs/005-visual-identity-scroll-hero/spec.md §7, §13, §8.1, §8.4.
 */

type Feature = {
  id: string
  title: string
  body: string
  visual: "content" | "cover" | "format" | "publish" | "marketing"
}

const FEATURES: Feature[] = [
  {
    id: "content",
    title: "The writing, end to end",
    body: "Outline, chapters, and a draft you can steer. Ask for a warmer tone or a slower opening and it revises the text without rewriting what you liked.",
    visual: "content",
  },
  {
    id: "cover",
    title: "Covers with foil, not clip-art",
    body: "Describe a look in a sentence and get two to four distinct directions to choose between, each with its own prompt you can refine.",
    visual: "cover",
  },
  {
    id: "format",
    title: "Formatted for the shelf it lands on",
    body: "EPUB and MOBI that reflow properly, and print-ready PDF with the trim size, margins and spine calculated for your page count.",
    visual: "format",
  },
  {
    id: "publish",
    title: "A submission package you can actually submit",
    body: "We validate your files and metadata against KDP, Apple Books and IngramSpark, then hand you a per-platform checklist of exactly what to press. We do not press Publish for you.",
    visual: "publish",
  },
  {
    id: "marketing",
    title: "Marketing on your own ad account",
    body: "Ad copy written per platform, and campaigns created in the ad account you connect yourself. Nothing spends without your approval.",
    visual: "marketing",
  },
]

function FeatureVisual({ kind }: { kind: Feature["visual"] }) {
  return (
    <div className={`landing-row-visual hover-lift landing-row-visual-${kind}`} aria-hidden="true">
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
        <>
          <span className="landing-visual-ad">
            <span className="landing-visual-ad-rule" />
            <span className="landing-visual-ad-body" />
            <span className="landing-visual-ad-cta">Start reading</span>
          </span>
        </>
      )}
    </div>
  )
}

export default function FeatureRows() {
  return (
    <section className="landing-rows" id="features" aria-labelledby="landing-features-title">
      <h2 className="landing-section-title" id="landing-features-title" data-reveal>
        What it does
      </h2>

      {FEATURES.map((feature) => (
        <div className="landing-row" key={feature.id} data-reveal>
          <div className="landing-row-copy">
            <h3 className="landing-row-title">{feature.title}</h3>
            <p className="landing-row-body">{feature.body}</p>
          </div>
          <FeatureVisual kind={feature.visual} />
        </div>
      ))}
    </section>
  )
}
