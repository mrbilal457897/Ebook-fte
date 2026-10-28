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
    <footer className="v3-footer">
      <div className="v3-container">
        <Link href={homeHref} aria-label="Tomewick AI home" className="v3-footer-logo">
          <strong>Tomewick AI</strong><small>E-book</small>
        </Link>

        <div className="v3-footer-columns">
          <div>
            <p className="v3-label">
              Product
            </p>
            <div className="v3-footer-links">
              <a href="#features">Features</a>
              <a href="#how-it-works">How it works</a>
              <a href="#shelf">Covers</a>
              <a href="#pricing">Pricing</a>
              <a href="#faq">FAQ</a>
            </div>
          </div>
          <div>
            <p className="v3-label">
              Account
            </p>
            <div className="v3-footer-links">
              {!signedIn && <Link href={signInHref}>Sign in</Link>}
              <Link href={primaryHref}>{signedIn ? "Go to workspace" : "Start my book free"}</Link>
            </div>
          </div>
        </div>

        <div className="v3-footer-base">
          <span>© {new Date().getFullYear()} E-book FTE</span>
          <span>Independent authors, published on their own terms</span>
        </div>
      </div>
    </footer>
  )
}
