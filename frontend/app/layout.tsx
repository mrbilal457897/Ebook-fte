import type { Metadata } from "next"
import { Fraunces, Inter, Literata } from "next/font/google"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import "./globals.css"
import "./components.css"

// Fraunces replaced Literata for DISPLAY on 2026-10-05.
//
// Literata is a text face — it is genuinely excellent for reading a chapter and
// that is why it stays as --font-literata — but at display sizes it reads as a
// book being *set*, not as a book being *sold*. Marketing headlines need
// character and a distinct voice; Fraunces has a variable optical-size axis plus
// SOFT and WONK axes, so a single family spans quiet paragraph text and a
// high-impact headline. It is a variable font, so the "soft"/"wonk" axes cost
// one file, not three.
//
// Both are self-hosted by next/font (no runtime request to Google) and exposed
// as CSS variables that globals.css composes into --font-display / --font-body.
// If you rename these variables, update the :root font tokens too — a family
// named there but not loaded here falls back silently, which is how this project
// shipped months of "General Sans" that was never actually loaded.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
})

// Literata stays loaded: it is the long-form reading face and remains the
// fallback for anything that should feel like a page of a book.
const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin"],
  display: "swap",
})

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "E-book FTE — your AI publishing team",
  description:
    "Describe your book in a sentence and watch it get written, covered, formatted and submitted — with your approval before anything goes live.",
  /*
   * The favicon was previously nothing, so the tab showed a bare default glyph —
   * for a product whose whole point is a recognisable brand, that was a real
   * miss. `icon` inlined as a data URI rather than shipped as a file in /public:
   * one less request on the critical path, and the tab icon cannot 404.
   *
   * It is the same open-book-with-gold-spine mark as `components/brand/logo.tsx`,
   * simplified to the two page shapes and the spine — at 16px the fanned leaf
   * edges are sub-pixel and only add mud.
   */
  icons: {
    icon:
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
<rect width="32" height="32" rx="7" fill="#121821"/>
<path d="M16 8.5C13.2 6.4 9.8 5.6 6 6v16.4c3.8-.4 7.2.4 10 2.5V8.5Z" fill="#efe7d6" opacity="0.92"/>
<path d="M16 8.5c2.8-2.1 6.2-2.9 10-2.5v16.4c-3.8-.4-7.2.4-10 2.5V8.5Z" fill="#efe7d6" opacity="0.62"/>
<rect x="15.25" y="7.6" width="1.5" height="18" rx="0.75" fill="#c2a15a"/>
</svg>`,
      ),
  },
}

/**
 * Applies the stored theme before first paint.
 *
 * This must stay inline and blocking in <head>. A React effect in
 * ThemeToggle runs after hydration, which is after the browser has already
 * painted the page — a returning customer with the light theme stored would
 * see a flash of the dark canvas on every visit. This is the standard
 * no-flash-of-incorrect-theme pattern.
 *
 * Dark is the default and the fallback: the brand must not change because of
 * an OS setting, so nothing here reads prefers-color-scheme.
 */
const themeBootstrap = `(function(){try{var t=localStorage.getItem("ebook-fte-theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;}}catch(e){}})();`

/**
 * Decides whether the landing preloader may paint, before first paint.
 *
 * Same no-flash reasoning as themeBootstrap above. If the decision were made in
 * the Preloader component's effect instead, the overlay would be in the server
 * HTML, would paint on every navigation of the session, and would then vanish on
 * hydration — a flash of a preloader on every page view, which is worse than
 * having none.
 *
 * `display: none` is the CSS default for `.preloader`; this attribute is the
 * only thing that makes it visible. Storage failures return without setting it,
 * so an unreadable sessionStorage means no preloader rather than a permanent
 * one. The attribute is inert on pages that do not render a Preloader.
 */
const preloaderBootstrap = `(function(){try{if(sessionStorage.getItem("ebook-fte-preloader-seen"))return;}catch(e){return;}document.documentElement.dataset.preloader="run";})();`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        <script dangerouslySetInnerHTML={{ __html: preloaderBootstrap }} />
      </head>
      <body className={`${fraunces.variable} ${literata.variable} ${inter.variable}`}>
        {children}
        <ThemeToggle />
      </body>
    </html>
  )
}
