import Link from "next/link"

export default function FinalCta({ primaryHref, label }: { primaryHref: string; label: string }) {
  return (
    <section className="v3-final-cta poster-final-cta">
      <div className="v3-container">
        <h2>Your first book is <em>three prompts</em> away.</h2>
        <Link className="v3-btn v3-btn-ivory mag" href={primaryHref}>{label}</Link>
      </div>
    </section>
  )
}
