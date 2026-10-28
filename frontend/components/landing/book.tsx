import { useState } from "react"
import type { CSSProperties, ReactNode } from "react"

export type CoverData = {
  t: string
  g: string
  a: string
  bg: string
  fg: string
  m: "orbit" | "sun" | "wave" | "arch" | "grid" | "moon"
}

const MOTIFS: Record<CoverData["m"], ReactNode> = {
  orbit: (
    <>
      <circle cx="120" cy="150" r="62" fill="none" stroke="currentColor" strokeWidth="2" />
      <ellipse cx="120" cy="150" rx="92" ry="29" fill="none" stroke="currentColor" strokeWidth="2" transform="rotate(-27 120 150)" />
      <circle cx="190" cy="98" r="8" fill="currentColor" />
    </>
  ),
  sun: (
    <>
      <circle cx="158" cy="128" r="48" fill="currentColor" opacity=".92" />
      <path d="M0 240 Q75 180 130 228 T240 206 V340 H0Z" fill="currentColor" opacity=".32" />
      <path d="M0 270 Q78 225 142 265 T240 245 V340 H0Z" fill="currentColor" opacity=".52" />
    </>
  ),
  wave: (
    <>
      <path d="M0 182 Q35 150 70 182 T140 182 T210 182 T280 182" fill="none" stroke="currentColor" strokeWidth="4" />
      <path d="M0 212 Q35 180 70 212 T140 212 T210 212 T280 212" fill="none" stroke="currentColor" strokeWidth="2" opacity=".75" />
      <circle cx="176" cy="93" r="28" fill="none" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  arch: (
    <>
      <path d="M42 246V145a78 78 0 0 1 156 0v101" fill="none" stroke="currentColor" strokeWidth="7" />
      <path d="M72 246V156a48 48 0 0 1 96 0v90" fill="none" stroke="currentColor" strokeWidth="3" opacity=".72" />
      <circle cx="120" cy="148" r="8" fill="currentColor" />
    </>
  ),
  grid: (
    <>
      <path d="M42 76H198M42 102H176M42 128H190M42 154H155M42 180H196" stroke="currentColor" strokeWidth="3" opacity=".75" />
      <rect x="142" y="202" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="3" />
    </>
  ),
  moon: (
    <>
      <path d="M166 72a69 69 0 1 0 9 136 73 73 0 0 1-9-136Z" fill="currentColor" />
      <circle cx="78" cy="106" r="3" fill="currentColor" />
      <circle cx="110" cy="72" r="2" fill="currentColor" />
      <circle cx="199" cy="178" r="3" fill="currentColor" />
    </>
  ),
}

export const COVERS: CoverData[] = [
  { t: "Orbit of Salt", g: "Sci-fi", a: "M. Okafor", bg: "#14163A", fg: "#F2C879", m: "orbit" },
  { t: "The Slow Yes", g: "Self-help", a: "A. Rahman", bg: "#E9DCC3", fg: "#2A2A2A", m: "sun" },
  { t: "The Quiet Tide", g: "Mystery", a: "L. Verhoeven", bg: "#0F4C4A", fg: "#F4EFE6", m: "wave" },
  { t: "Paper Kingdoms", g: "Fantasy", a: "S. Idris", bg: "#6B1D2A", fg: "#F5D9A8", m: "arch" },
  { t: "Ledger & Light", g: "Business", a: "D. Chen", bg: "#F26B3A", fg: "#101010", m: "grid" },
  { t: "Small Hours", g: "Poetry", a: "N. Ali", bg: "#2B2B2B", fg: "#E8E2D4", m: "moon" },
]

type BookProps = {
  cover: CoverData
  scale?: number
  className?: string
  decorative?: boolean
  style?: CSSProperties
}

export function Book({ cover, scale = 1, className = "", decorative = false, style }: BookProps) {
  const [peek, setPeek] = useState(false)
  const handleMove = (event: React.MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const shine = event.currentTarget.querySelector<HTMLElement>(".bk-shine")
    shine?.style.setProperty("--mx", `${((event.clientX - rect.left) / rect.width) * 100}%`)
    shine?.style.setProperty("--my", `${((event.clientY - rect.top) / rect.height) * 100}%`)
  }
  return (
    <div
      className={`bkw ${className}`.trim()}
      style={{ "--bs": scale, ...style } as CSSProperties}
      aria-hidden={decorative || undefined}
    >
      <div className="bsc">
        <article
          className={`bk${peek ? " is-peeking" : ""}`}
          role={decorative ? undefined : "img"}
          aria-label={decorative ? undefined : `${cover.t} cover`}
          onMouseMove={decorative ? undefined : handleMove}
          style={{ "--cover-bg": cover.bg, "--cover-fg": cover.fg } as CSSProperties}
          onClick={() => {
            if (!decorative && matchMedia("(hover: none)").matches) {
              setPeek(true)
              window.setTimeout(() => setPeek(false), 850)
            }
          }}
        >
          <div className="bk-back" />
          <div className="bk-spine"><span>{cover.t}</span></div>
          <div className="bk-pages" />
          <div className="bk-front">
            <svg className={`bk-art bk-art-${cover.m}`} viewBox="0 0 240 340" aria-hidden="true">
              <rect width="240" height="340" fill={cover.bg} />
              <g color={cover.fg}>{MOTIFS[cover.m]}</g>
            </svg>
            <span className="bk-genre">{cover.g}</span>
            <span className="bk-title">{cover.t}</span>
            <span className="bk-author">{cover.a}</span>
            <span className="bk-shine" />
          </div>
        </article>
      </div>
    </div>
  )
}
