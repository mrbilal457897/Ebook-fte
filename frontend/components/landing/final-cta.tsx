import Link from "next/link"

export default function FinalCta({ primaryHref, label }: { primaryHref: string; label: string }) {
  return (
    <section className="poster-section poster-final-cta">
      <div className="poster-card poster-card--coral" style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 18, padding: "clamp(40px, 8vw, 64px)" }}>
        <h2 className="poster-h2">Your first book is three prompts away.</h2>
        <Link className="poster-btn poster-btn--white" href={primaryHref}>
          {label}
        </Link>
        <p className="poster-mono">Three free books. No card required.</p>
      </div>
    </section>
  )
}
