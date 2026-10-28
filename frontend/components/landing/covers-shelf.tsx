"use client"

import { useEffect, useRef, useState } from "react"
import { Book, COVERS } from "@/components/landing/book"
import { gsap } from "@/lib/gsap-setup"

const STATS = [
  ["3", "free books"],
  ["4", "cover directions"],
  ["3", "platforms checked"],
  ["1", "click is yours"],
]

export default function CoversShelf() {
  const [perRow, setPerRow] = useState(3)
  const [scale, setScale] = useState(0.68)
  const section = useRef<HTMLElement>(null)
  const values = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(() => {
    let active = false
    const fit = () => {
      const p = window.innerWidth >= 640 ? 3 : 2
      setPerRow(p)
      const rows = 6 / p
      const w = Math.min(window.innerWidth, 1240) - 56
      const bw = (w - (p - 1) * 18) / (p * 240)
      const bh = (window.innerHeight - 330 - rows * 60) / (rows * 340)
      setScale(Math.max(0.45, Math.min(0.85, bw, bh)))
    }
    fit()
    window.addEventListener("resize", fit)
    const root = section.current
    let io: IntersectionObserver | undefined
    const allowMotion = window.matchMedia("(prefers-reduced-motion: no-preference)").matches
    const cleanup: Array<() => void> = []
    if (allowMotion) {
      if (root) {
        gsap.from(".v3-shelf-book .bk", {
          y: 120,
          opacity: 0,
          rotationY: -70,
          duration: 1.15,
          stagger: 0.1,
          ease: "power4.out",
          scrollTrigger: { trigger: root, start: "top 78%" },
        })
        const books = gsap.utils.toArray<HTMLElement>(".v3-shelf-book .bk")
        books.forEach((book) => {
          const enter = () => gsap.to(book, { y:-26, scale:1.05, duration:.7, ease:"power3.out" })
          const leave = () => gsap.to(book, { rotationX:0, rotationY:0, y:0, scale:1, duration:1.1, ease:"elastic.out(1,.55)" })
          book.addEventListener("mouseenter", enter)
          book.addEventListener("mouseleave", leave)
          cleanup.push(() => { book.removeEventListener("mouseenter", enter); book.removeEventListener("mouseleave", leave) })
        })
        values.current.forEach((el, index) => {
          if (!el) return
          const value = Number(STATS[index][0])
          const counter = { n: 0 }
          gsap.to(counter, { n:value, duration:1.6, ease:"power2.out", snap:{n:1}, scrollTrigger:{trigger:root,start:"top 90%"}, onUpdate:()=>{el.textContent=String(counter.n)} })
        })
      }
    }
    if (root && "IntersectionObserver" in window) {
      io = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting || active || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
        active = true
        values.current.forEach((el, i) => {
          if (!el) return
          const target = Number(STATS[i][0])
          const start = performance.now()
          const tick = (now: number) => {
            const t = Math.min(1, (now - start) / 1600)
            const eased = 1 - Math.pow(1 - t, 2)
            el.textContent = String(Math.round(target * eased))
            if (t < 1) requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        })
      }, { threshold: 0.35 })
      io.observe(root)
    }
    return () => { window.removeEventListener("resize", fit); io?.disconnect(); cleanup.forEach((fn) => fn()); gsap.killTweensOf(".v3-shelf-book .bk") }
  }, [])

  return (
    <section className="v3-section v3-shelf" id="shelf" aria-labelledby="shelf-title" ref={section}>
      <div className="v3-container">
        <span className="v3-label">A whole bookshelf, from one sentence</span>
        <h2 className="v3-shelf-title" id="shelf-title">Every book leaves with a cover worth holding.</h2>
        <div className="v3-shelves" style={{ "--bs": scale, "--per-row": perRow } as React.CSSProperties}>
          {Array.from({ length: Math.ceil(6 / perRow) }, (_, row) => (
            <div className="v3-shelf-row" key={row}>
              {COVERS.slice(row * perRow, row * perRow + perRow).map((cover) => (
                <Book key={cover.t} cover={cover} className="v3-shelf-book" scale={scale} />
              ))}
              <div className="v3-plank" aria-hidden="true" />
            </div>
          ))}
        </div>
        <div className="v3-stats-row">
        {STATS.map(([value, label], i) => (
          <div className="v3-stat" key={label}>
            <strong data-value={value}><span ref={(el) => { values.current[i] = el }}>{value}</span></strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
