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
      <circle cx="120" cy="152" r="72" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="120" cy="152" r="26" fill="currentColor" />
      <ellipse cx="120" cy="152" rx="106" ry="30" fill="none" stroke="currentColor" strokeWidth="2.5" transform="rotate(-22 120 152)" />
      <circle cx="208" cy="116" r="6" fill="currentColor" />
      <circle cx="42" cy="222" r="6" fill="currentColor" />
      <circle cx="162" cy="66" r="4" fill="currentColor" />
      <circle cx="56" cy="88" r="3" fill="currentColor" />
      <circle cx="188" cy="266" r="3" fill="currentColor" />
    </>
  ),
  sun: (
    <>
      <circle cx="120" cy="128" r="46" fill="currentColor" />
      <circle cx="120" cy="128" r="64" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 10" />
      <circle cx="120" cy="128" r="84" fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".5" />
      <path d="M0 262 Q120 210 240 262 V340 H0Z" fill="currentColor" opacity=".35" />
      <path d="M0 292 Q120 248 240 292 V340 H0Z" fill="currentColor" opacity=".55" />
    </>
  ),
  wave: (
    <>
      <circle cx="120" cy="112" r="34" fill="currentColor" />
      <path d="M0 200 Q60 174 120 200 T240 200" fill="none" stroke="currentColor" strokeWidth="4" />
      <path d="M0 232 Q60 206 120 232 T240 232" fill="none" stroke="currentColor" strokeWidth="2.5" opacity=".7" />
      <path d="M0 264 Q60 238 120 264 T240 264" fill="none" stroke="currentColor" strokeWidth="2" opacity=".45" />
      <path d="M0 296 Q60 270 120 296 T240 296" fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".25" />
    </>
  ),
  arch: (
    <>
      <path d="M52 258V158a68 68 0 0 1 136 0v100" fill="none" stroke="currentColor" strokeWidth="8" />
      <path d="M92 258V166a28 28 0 0 1 56 0v92" fill="currentColor" opacity=".35" />
      <circle cx="120" cy="76" r="14" fill="currentColor" />
      <path d="M40 266h160" stroke="currentColor" strokeWidth="3" />
    </>
  ),
  grid: (
    <>
      <path d="M42 76H198M42 102H176M42 128H190M42 154H155M42 180H196" stroke="currentColor" strokeWidth="3" opacity=".75" />
      <rect x="142" y="202" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="120" cy="272" r="14" fill="currentColor" />
    </>
  ),
  moon: (
    <>
      <path d="M166 72a69 69 0 1 0 9 136 73 73 0 0 1-9-136Z" fill="currentColor" />
      <circle cx="78" cy="106" r="3" fill="currentColor" />
      <circle cx="110" cy="72" r="2" fill="currentColor" />
      <circle cx="199" cy="178" r="3" fill="currentColor" />
      <circle cx="64" cy="258" r="5" fill="currentColor" opacity=".6" />
      <circle cx="188" cy="272" r="4" fill="currentColor" opacity=".6" />
    </>
  ),
}

export const COVERS: CoverData[] = [
  { t: "Orbit of Salt", g: "Sci-fi", a: "M. Okafor", bg: "#2A1245", fg: "#FFD166", m: "orbit" },
  { t: "The Slow Yes", g: "Self-help", a: "A. Rahman", bg: "#166A55", fg: "#FFF3D6", m: "sun" },
  { t: "The Quiet Tide", g: "Mystery", a: "L. Verhoeven", bg: "#0B2545", fg: "#7DE3C3", m: "wave" },
  { t: "Paper Kingdoms", g: "Fantasy", a: "S. Idris", bg: "#46135F", fg: "#FFC97E", m: "arch" },
  { t: "Ledger & Light", g: "Business", a: "D. Chen", bg: "#F6F1E7", fg: "#C2410C", m: "grid" },
  { t: "Small Hours", g: "Poetry", a: "N. Ali", bg: "#12121C", fg: "#C9F24B", m: "moon" },
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
