import type { Metadata } from "next"
import { Bricolage_Grotesque, DM_Mono, Literata } from "next/font/google"
import "./globals.css"
import "./components.css"

/*
 * TYPOGRAPHY (sticker-poster system, 2026-10):
 *   display + body → Bricolage Grotesque (400/600/800, optical-size axis)
 *   labels         → DM Mono 500, uppercase, tracked
 *   long-form text → Literata, kept only for generated manuscript prose
 *
 * Bricolage Grotesque is a variable font, so the whole display range costs one
 * file. DM Mono is not variable and is loaded at the two weights the label
 * style uses (400 for dense metadata, 500 for section eyebrows and pills).
 *
 * All three are self-hosted by next/font at build time, exposed as CSS
 * variables and composed into --font-display / --font-body / --font-label /
 * --font-reading in globals.css. Never name a family there that this file does
 * not load — a missing family falls back silently, and the product shipped for
 * months rendering in system-ui because of exactly that.
 */
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
})

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
})

const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "E-book FTE — your AI publishing team",
  description:
    "Describe your book in a sentence and watch it get written, covered, formatted and submitted — with your approval before anything goes live.",
  /*
   * The favicon is the open-book mark on the poster's cobalt, inlined as a data
   * URI rather than shipped as a file: one less request on the critical path,
   * and the tab icon cannot 404.
   */
  icons: {
    icon:
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
<rect width="32" height="32" rx="7" fill="#2B2BFF" stroke="#111111" stroke-width="2.5"/>
<path d="M16 8.5C13.2 6.4 9.8 5.6 6 6v16.4c3.8-.4 7.2.4 10 2.5V8.5Z" fill="#FFF6E6"/>
<path d="M16 8.5c2.8-2.1 6.2-2.9 10-2.5v16.4c-3.8-.4-7.2.4-10 2.5V8.5Z" fill="#FFF6E6" opacity="0.7"/>
<rect x="15" y="7.6" width="2" height="18" rx="1" fill="#111111"/>
</svg>`,
      ),
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${bricolage.variable} ${dmMono.variable} ${literata.variable}`}>
        {children}
      </body>
    </html>
  )
}
