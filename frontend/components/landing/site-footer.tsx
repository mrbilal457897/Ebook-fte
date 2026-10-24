import Link from "next/link"

export default function SiteFooter({
  signedIn,
  primaryHref,
  signInHref,
  homeHref,
}: {
  signedIn: boolean
  primaryHref: string
  signInHref: string
  homeHref: string
}) {
  return (
    <footer style={{ borderTop: "var(--border-w) solid var(--ink)", marginTop: "clamp(48px, 10vw, 96px)" }}>
      <div className="poster-section" style={{ paddingBottom: "clamp(32px, 8vw, 64px)" }}>
        <Link href={homeHref} aria-label="E-book FTE home" style={{ display: "block", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(4rem, 16vw, 10rem)", letterSpacing: "-0.06em", lineHeight: 0.85, color: "var(--blue)", marginBottom: "clamp(24px, 6vw, 40px)" }}>
          E-book FTE
        </Link>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 24 }}>
          <div>
            <p className="poster-mono" style={{ marginBottom: 10 }}>
              Product
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <a href="#features">Features</a>
              <a href="#how-it-works">How it works</a>
              <a href="#pricing">Pricing</a>
              <a href="#faq">FAQ</a>
            </div>
          </div>
          <div>
            <p className="poster-mono" style={{ marginBottom: 10 }}>
              Account
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {!signedIn && <Link href={signInHref}>Sign in</Link>}
              <Link href={primaryHref}>{signedIn ? "Go to workspace" : "Start my book free"}</Link>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, marginTop: "clamp(32px, 8vw, 56px)", fontFamily: "var(--font-label)", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          <span>© {new Date().getFullYear()} E-book FTE</span>
          <span>Independent authors, published on their own terms</span>
        </div>
      </div>
    </footer>
  )
}
