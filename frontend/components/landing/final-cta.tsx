import Link from "next/link"

/**
 * Final CTA: one line, one button, a visually distinct surface.
 *
 * It repeats what the hero already said and introduces nothing new. A closing
 * section that has to explain itself has failed at being a closing section.
 *
 * SPEC: specs/005-visual-identity-scroll-hero/spec.md §7.
 */

export default function FinalCta({ primaryHref, label }: { primaryHref: string; label: string }) {
  return (
    <section className="landing-cta" data-reveal>
      <h2 className="landing-section-title">Your first book is three prompts away.</h2>
      <Link className="btn-primary" href={primaryHref} data-magnetic>
        {label}
      </Link>
      <p className="landing-note">Three free books. No card required.</p>
    </section>
  )
}
