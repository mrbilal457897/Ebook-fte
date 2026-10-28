import type { Metadata } from "next"
import { DM_Serif_Display, IBM_Plex_Mono, Plus_Jakarta_Sans, Sora } from "next/font/google"
import "./globals.css"
import "./components.css"

/*
 * Font stacks for the v3 design. Books alone use DM Serif Display.
 */
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "swap",
  weight: ["600", "700", "800"],
})

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "700", "800"],
})

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["500"],
})

const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  display: "swap",
  weight: "400",
})

export const metadata: Metadata = {
  title: "Tomewick AI — E-book publishing team",
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
<rect width="32" height="32" rx="5" fill="#0B0C10"/>
<path d="M16 7C12 4 7 4 3 5v21c5-1 9 0 13 3V7Zm0 0c4-3 9-3 13-2v21c-5-1-9 0-13 5V7Z" fill="#FFB938"/>
<path d="M16 7v22" stroke="#6B1D2A" stroke-width="2.2"/>
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
    <html lang="en" suppressHydrationWarning>
      <body className={`${sora.variable} ${jakarta.variable} ${plexMono.variable} ${dmSerif.variable}`}>
        {/*
          Must run before first paint: marks the session's first load so the
          Preloader can show. Same key constant as Preloader in
          components/landing/preloader.tsx — updated there if changed.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{if(!sessionStorage.getItem("ebook-fte-preloader-seen"))' +
              '{document.documentElement.dataset.preloader="run"}}catch(e){}',
          }}
        />
        <a className="v3-skip" href="#main-content">Skip to content</a>
        {children}
      </body>
    </html>
  )
}
