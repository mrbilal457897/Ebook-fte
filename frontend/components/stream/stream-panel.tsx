"use client"

export type StreamStatus = "idle" | "working" | "done" | "stopped" | "error"

/**
 * Stream panel: the watch-it-write document plus status line (T036). Shows
 * `isPartial` hint while working, "still working" if the first token stalls,
 * and terminal text on completion. Presentational.
 */
export default function StreamPanel({
  text,
  status,
  stillWorking,
  errorMessage,
  savedHint,
}: {
  text: string
  status: StreamStatus
  stillWorking: boolean
  errorMessage: string | null
  savedHint?: string | null
}) {
  const hasText = text.length > 0
  const statusLabel =
    status === "working"
      ? "Streaming…"
      : status === "done"
        ? "Draft complete"
        : status === "stopped"
          ? "Generation stopped"
          : status === "error"
            ? "Generation failed"
            : "Nothing yet"

  return (
    <section className="stream-panel" aria-live="polite">
      <header className="stream-header">
        <span
          className={`status-dot ${status === "idle" ? "" : status === "working" ? "is-working" : status === "done" ? "is-done" : "is-stopped"}`}
        />
        {statusLabel}
        {status === "working" && stillWorking && (
          <span className="still-working">still working…</span>
        )}
        {status === "working" && <span>draft saved as it streams (partial)</span>}
      </header>

      <div className={`stream-text ${hasText ? "" : "faded"}`}>
        {hasText ? text : "Your draft will appear here, word by word."}
      </div>

      {savedHint && (
        <div className="banner is-info">
          This is a restored partial draft — everything the UI showed before the interruption is
          here.
        </div>
      )}

      {status === "error" && errorMessage && (
        <div className="banner is-error">Stopped: {errorMessage}</div>
      )}
      {status === "stopped" && !savedHint && (
        <div className="banner">
          Stream closed — everything written so far has been saved; re-submit to start a fresh
          generation.
        </div>
      )}
    </section>
  )
}
