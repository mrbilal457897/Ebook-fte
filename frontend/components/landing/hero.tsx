"use client"

import Link from "next/link"
import { Book, COVERS } from "@/components/landing/book"
import type { RefObject } from "react"

export default function Hero({
  signedIn,
  primaryHref,
  signInHref,
  stageRef,
}: {
  signedIn: boolean
  primaryHref: string
  signInHref: string
  stageRef: RefObject<HTMLDivElement | null>
}) {
  return (
    <section className="v3-hero" aria-labelledby="landing-hero-title">
      <div className="v3-spine-wall" aria-hidden="true">
        <div className="v3-spine-row">
          {Array.from({ length: 60 }, (_, i) => (
            <i key={`a-${i}`} style={{ "--spine-height": `${(i * 7) % 70}px` } as React.CSSProperties} />
          ))}
        </div>
        <div className="v3-spine-row">
          {Array.from({ length: 60 }, (_, i) => (
            <i key={`b-${i}`} style={{ "--spine-height": `${((i + 11) * 7) % 70}px` } as React.CSSProperties} />
          ))}
        </div>
      </div>
      <div className="v3-container v3-hero-grid">
      <div className="poster-hero-copy">
        <span className="v3-eyebrow">Your AI publishing team</span>

        <h1 className="v3-h1" id="landing-hero-title">
          <span><span>Say the book.</span></span>
          <span><span>We <em>ship</em> the</span></span>
          <span><span>manuscript.</span></span>
        </h1>

        <p className="v3-hero-sub">
          One sentence in. A drafted, covered, formatted book out, ready for KDP, Apple Books and
          IngramSpark. You press Publish, always.
        </p>

        <div className="poster-hero-actions">
          <Link className="v3-btn v3-btn-ivory mag" href={primaryHref}>
            {signedIn ? "Go to workspace" : "Start my book free →"}
          </Link>
          <a className="v3-btn v3-btn-outline mag" href="#how-it-works">
            Watch it write
          </a>
        </div>

        <p className="v3-trust">No card <b>/</b> 3 free books <b>/</b> EPUB <b>/</b> MOBI <b>/</b> PDF</p>

        {!signedIn && (
          <p>
            Already started?{" "}
            <Link href={signInHref} style={{ textDecoration: "underline", fontWeight: 600 }}>
              Sign in
            </Link>
          </p>
        )}
      </div>

      <div className="v3-stage-wrap v3-hero-visual">
        <div className="v3-stage-shell">
          <div className="v3-stage" ref={stageRef}>
            <div className="v3-book-position v3-book-left"><Book cover={COVERS[0]} decorative /></div>
            <div className="v3-book-position v3-book-right"><Book cover={COVERS[1]} decorative /></div>
            <div className="v3-book-position v3-book-center"><Book cover={COVERS[2]} decorative /></div>
          </div>
        </div>
        <div className="v3-chips">
          <div className="v3-chip"><span className="v3-live-dot" />Chapter 1 · writing now / The Salt Road</div>
          <div className="v3-chip">Saved the instant it appears</div>
        </div>
      </div>
      </div>
    </section>
  )
}
