import Link from "next/link"
import Logo from "@/components/brand/logo"

/**
 * The landing page footer.
 *
 * WAS ONE LINE OF TEXT ("Independent authors, published on their own terms."),
 * which is not a footer — it gave a visitor no way to get anywhere and left the
 * page ending in a rule. A marketing page's footer is its last chance to offer a
 * route, so this one carries the brand, the two real destinations, and the
 * tenant threading that FR-010 requires.
 *
 * TENANT THREADING (FR-010) is the reason this component takes `tenantQuery`
 * rather than hard-coding links. Every link that leaves for auth or the app
 * carries `?tenant=<slug>`, exactly as the masthead does. A footer is the last
 * thing on the page and the easiest link to forget, and a visitor who signs up
 * from here would otherwise be silently attributed to the fallback tenant — the
 * same failure the wordmark comment in masthead.tsx warns about.
 *
 * NOTHING HERE IS INVENTED. No invented legal pages, no fake `Privacy Policy`
 * route, no social handles that go nowhere, no newsletter form with no backend.
 * A link that 404s is worse than no link, and this product has not built those
 * pages yet. The two destinations that exist are auth and the app; when the real
 * legal pages exist they get added here, not faked now.
 *
 * The year is rendered from `new Date()` at render time. This is a static
 * marketing page with no per-request data, so it is correct at build time and
 * simply needs a rebuild next January — cheaper than making the whole page
 * dynamic over one string.
 *
 * SPEC: specs/005-visual-identity-scroll-hero/spec.md §7, §10 (footer is not a
 * section; it inherits the anchor list and the tenant-threading rules).
 */
export default function SiteFooter({
  signedIn,
  primaryHref,
  signInHref,
}: {
  signedIn: boolean
  primaryHref: string
  signInHref: string
}) {
  return (
    <footer className="landing-footer">
      <div className="landing-footer-inner">
        <div className="landing-footer-brand">
          <Link className="landing-wordmark landing-footer-mark" href="/">
            <Logo size={32} />
            <span className="landing-wordmark-text">
              E-book&nbsp;<span className="landing-wordmark-accent">FTE</span>
            </span>
          </Link>
          <p className="landing-footer-tag">
            Your AI publishing team. Describe the book; supervise the parts that cost money or go
            live.
          </p>
        </div>

        <nav className="landing-footer-col" aria-label="Footer">
          <h2 className="landing-footer-heading">Product</h2>
          <a className="landing-footer-link" href="#features">
            Features
          </a>
          <a className="landing-footer-link" href="#how-it-works">
            How it works
          </a>
          <a className="landing-footer-link" href="#pricing">
            Pricing
          </a>
          <a className="landing-footer-link" href="#faq">
            FAQ
          </a>
        </nav>

        <nav className="landing-footer-col" aria-label="Account">
          <h2 className="landing-footer-heading">Account</h2>
          {!signedIn && (
            <Link className="landing-footer-link" href={signInHref}>
              Sign in
            </Link>
          )}
          <Link className="landing-footer-link" href={primaryHref}>
            {signedIn ? "Go to workspace" : "Start my book free"}
          </Link>
        </nav>
      </div>

      <div className="landing-footer-base">
        <p>Independent authors, published on their own terms.</p>
        <p>&copy; {new Date().getFullYear()} E-book FTE</p>
      </div>
    </footer>
  )
}
