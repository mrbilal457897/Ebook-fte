"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"

export default function MobileCtaBar({ primaryHref, label }: { primaryHref: string; label: string }) {
  const barRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const host = barRef.current?.parentElement
    if (!host) return

    const hero = host.querySelector<HTMLElement>(".poster-hero")
    const finalCta = host.querySelector<HTMLElement>(".poster-final-cta")
    let heroPassed = false
    let ctaInView = false
    const update = () => setVisible(heroPassed && !ctaInView)
    const observers: IntersectionObserver[] = []

    if (hero) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          heroPassed = !entry.isIntersecting && entry.boundingClientRect.top < 0
          update()
        },
        { threshold: 0 },
      )
      observer.observe(hero)
      observers.push(observer)
    }
    if (finalCta) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          ctaInView = entry.isIntersecting
          update()
        },
        { threshold: 0 },
      )
      observer.observe(finalCta)
      observers.push(observer)
    }
    return () => observers.forEach((observer) => observer.disconnect())
  }, [])

  return (
    <div ref={barRef} className={`poster-mobile-cta${visible ? " is-visible" : ""}`}>
      <Link className="poster-btn poster-btn--coral" href={primaryHref}>
        {label}
      </Link>
      <span className="poster-mono">3 free books - no card</span>
    </div>
  )
}
