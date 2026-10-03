import type { Metadata } from "next"
import { Inter, Literata } from "next/font/google"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import "./globals.css"

// Literata is the serif Google ships for long-form reading, so it reads as
// "book" even at heading sizes. Both are self-hosted by next/font (no runtime
// request to Google) and exposed as CSS variables that globals.css composes
// into --font-display / --font-body. If you rename these variables, update
// the :root font tokens too — a family named there but not loaded here falls
// back silently, which is how this project shipped months of "General Sans"
// that was never actually loaded.
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className={`${literata.variable} ${inter.variable}`}>
        {children}
        <ThemeToggle />
      </body>
    </html>
  )
}
