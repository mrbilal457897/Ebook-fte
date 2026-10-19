"use client"

import { useRef } from "react"
import { useMotion } from "@/lib/motion"
import { countUp } from "@/lib/motion/presets"

/**
 * Social-proof strip: three REAL product facts, not usage claims.
 *
 * ############################################################################
 * # HONESTY CONTRACT (spec 005 §8.2, Part IV §26/§29)                          #
 * # These figures are product facts and can be verified in this repo:         #
 * # 3 = free-tier book cap (AGENTS.md §3.9); 4 = platforms covered by the     #
 * # Publishing Advisor roster (KDP, Apple Books, IngramSpark,                 #
 * # Draft2Digital, AGENTS.md §4); 3 = export formats (EPUB, MOBI, PDF,        #
 * # AGENTS.md §4).                                                            #
 * #                                                                            #
 * # USAGE FIGURES ("books published", "authors", "time to draft") remain      #
 * # OPEN. When a real, sourced number exists it may replace a slot — do not   #
 * # invent one, and do not re-add the old "—" placeholder row alongside real  #
 * # facts: a strip of dashes next to real numbers reads as a broken page.     #
 * ############################################################################
 *
 * COUNT-UP: each value counts from 0 when the strip scrolls into view
 * (`countUp`'s scroll option, motion-gated internally). The FINAL value is in
 * the served markup, so no-JS and reduced-motion visitors see the right
 * numbers immediately and the count never changes the page's height
 * (`font-variant-numeric: tabular-nums` in CSS keeps digits from jittering).
 *
 * SPEC: specs/005-visual-identity-scroll-hero/spec.md §7 row 2, §8.2, §14 AC 27.
 */

const STAT_FIGURES = [
  { value: 3, label: "free books to start" },
  { value: 4, label: "publishing platforms guided" },
  { value: 3, label: "export formats, EPUB to print PDF" },
]

export default function SocialProof() {
  const rootRef = useRef<HTMLElement>(null)

  useMotion(
    rootRef,
    (q, root) => {
      for (const el of q("[data-proof-value]")) {
        const to = Number(el.getAttribute("data-to"))
        if (!Number.isFinite(to)) continue
        countUp(el, { to, scroll: { trigger: root, start: "top 85%" } })
      }
    },
    [],
  )

  return (
    <section className="landing-proof" aria-labelledby="landing-proof-title" ref={rootRef}>
      <h2 className="landing-proof-title" id="landing-proof-title">
        By the numbers
      </h2>

      <ul className="landing-proof-list">
        {STAT_FIGURES.map((stat) => (
          <li className="landing-proof-item" key={stat.label} data-reveal>
            {/*
              The final value is the element's markup content. The count-up only
              ever rewrites it at runtime, and its cleanup restores it.
            */}
            <span className="landing-proof-value" data-proof-value data-to={stat.value}>
              {stat.value}
            </span>
            <span className="landing-proof-label">{stat.label}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
