"use client"

const STATS = [
  { value: "3", label: "free books" },
  { value: "4", label: "platforms" },
  { value: "3", label: "export formats" },
]

export default function SocialProof() {
  return (
    <section className="poster-section" aria-labelledby="landing-proof-title">
      <h2 className="poster-h2" id="landing-proof-title" style={{ marginBottom: "clamp(24px, 6vw, 40px)" }}>
        By the numbers
      </h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
        {STATS.map((stat) => (
          <div key={stat.label} className="poster-sticker poster-sticker--yellow poster-sticker--rotate-left">
            <strong style={{ fontSize: "1.8rem", fontWeight: 800 }}>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
