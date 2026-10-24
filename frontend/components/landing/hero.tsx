"use client"

import Link from "next/link"

export default function Hero({
  signedIn,
  primaryHref,
  signInHref,
}: {
  signedIn: boolean
  primaryHref: string
  signInHref: string
}) {
  return (
    <section className="poster-section poster-hero" aria-labelledby="landing-hero-title">
      <div className="poster-hero-copy">
        <span className="poster-kicker">Your AI publishing team</span>

        <h1 className="poster-h1" id="landing-hero-title">
          Say the book.
          <br />
          We <span className="poster-hero-title-accent">ship</span> the
          <br />
          manuscript.
        </h1>

        <p className="poster-body poster-hero-sub">
          One sentence in. A drafted, covered, formatted book out, ready for KDP, Apple Books and
          IngramSpark. You press Publish, always.
        </p>

        <div className="poster-hero-actions">
          <Link className="poster-btn poster-btn--coral" href={primaryHref}>
            {signedIn ? "Go to workspace" : "Start my book free"}
          </Link>
          <a className="poster-btn poster-btn--white" href="#how-it-works">
            Watch it write
          </a>
        </div>

        <ul className="poster-hero-meta" aria-label="Free tier details">
          <li>No card</li>
          <li className="poster-hero-meta-sep" aria-hidden="true">·</li>
          <li>3 free books</li>
          <li className="poster-hero-meta-sep" aria-hidden="true">·</li>
          <li>EPUB / MOBI / PDF</li>
        </ul>

        {!signedIn && (
          <p>
            Already started?{" "}
            <Link href={signInHref} style={{ textDecoration: "underline", fontWeight: 600 }}>
              Sign in
            </Link>
          </p>
        )}
      </div>

      <div className="poster-hero-visual">
        <div className="poster-covers" aria-hidden="true">
          <article className="poster-cover poster-cover--blue">
            <span className="poster-cover-genre">Sci-fi</span>
            <h3 className="poster-cover-title poster-cover-title--yellow">Orbit of Salt</h3>
            <span className="poster-cover-caption">Draft option 1</span>
          </article>
          <article className="poster-cover poster-cover--mint">
            <span className="poster-cover-genre">Self-help</span>
            <h3 className="poster-cover-title">The Slow Yes</h3>
            <span className="poster-cover-caption">Draft option 3</span>
          </article>
          <article className="poster-cover poster-cover--coral">
            <span className="poster-cover-genre">Mystery</span>
            <h3 className="poster-cover-title">The Quiet Tide</h3>
            <span className="poster-cover-caption">Cover option 2 of 4</span>
          </article>
        </div>
        <div className="poster-sticker poster-sticker--rotate-right poster-sticker--hero-top">
          <span className="poster-sticker-dot is-blink" />
          <span>Chapter 1 · writing now · The Salt Road</span>
        </div>
        <div className="poster-sticker poster-sticker--yellow poster-sticker--rotate-left poster-sticker--hero-bottom">
          <span>Saved the instant it appears</span>
        </div>
      </div>
    </section>
  )
}
