"use client"

/**
 * Composer: the prompt textarea + submit button (T036). Presentational —
 * the page owns generation state and passes `onGenerate`.
 */
export default function Composer({
  prompt,
  onChange,
  busy,
  onGenerate,
}: {
  prompt: string
  onChange: (value: string) => void
  busy: boolean
  onGenerate: () => void
}) {
  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault()
        if (!busy && prompt.trim()) onGenerate()
      }}
    >
      <textarea
        className="textarea-input"
        value={prompt}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe the book you want written — e.g. a twentieth-century lighthouse keeper‘s memoir told as a thriller…"
        aria-label="Book prompt"
        required
      />
      <div className="composer-row">
        <span className="banner">
          Text streams into the document below as it‘s written and is saved the moment it appears.
        </span>
        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? "Writing…" : "Start writing"}
        </button>
      </div>
    </form>
  )
}
