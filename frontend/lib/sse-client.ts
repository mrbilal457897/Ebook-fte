"use strict"

export type SseEvent = {
  event: string
  data: Record<string, unknown>
}

export type StreamResult =
  | { ok: true; status: 200; terminal: "version" | "error" | "stream_closed" }
  | { ok: false; status: number; errorCode?: string; upgrade?: boolean }

/**
 * Framework-neutral SSE client for the generation endpoint (T029).
 *
 * POSTs a prompt to `/api/generate`, reads the `ReadableStream`, and emits
 * `token` / `version` / `error` frames parsed from the SSE wire format
 * (`event:` / `data:` lines separated by blank lines — contracts/
 * generation-api.md). An `AbortSignal` from the caller stops the reader
 * (unmount/refresh); the reader is cancelled so the upstream closes cleanly.
 *
 * Returns once a terminal `version`/`error` frame arrives, the stream closes,
 * or the pre-stream JSON rejection is read (status !== 200).
 */
export async function streamGenerate(
  prompt: string,
  opts: {
    signal?: AbortSignal
    onEvent?: (ev: SseEvent) => void
  } = {},
): Promise<StreamResult> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
    signal: opts.signal,
    cache: "no-store",
  })

  if (!res.ok || !res.body) {
    let errorCode: string | undefined
    let upgrade: boolean | undefined
    try {
      const body = (await res.json()) as { code?: string; upgrade?: boolean }
      errorCode = body.code
      upgrade = body.upgrade
    } catch {
      /* non-JSON upstream error: pass through as-is */
    }
    return { ok: false, status: res.status, errorCode, upgrade }
  }

  return readSse(res.body, opts)
}

export async function readSse(
  body: ReadableStream<Uint8Array>,
  opts: { signal?: AbortSignal; onEvent?: (ev: SseEvent) => void } = {},
): Promise<StreamResult> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  const abortHandler = () => void reader.cancel().catch(() => {})
  opts.signal?.addEventListener("abort", abortHandler, { once: true })

  try {
    let terminal: "version" | "error" | "stream_closed" | null = null
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      for (;;) {
        const frameEnd = buffer.search(/\r?\n\r?\n/)
        if (frameEnd === -1) break
        const raw = buffer.slice(0, frameEnd)
        buffer = buffer.slice(frameEnd + (buffer[frameEnd] === "\r" ? 4 : 2))

        const ev = parseFrame(raw)
        if (!ev) continue
        opts.onEvent?.(ev)
        if (ev.event === "version" || ev.event === "error") {
          terminal = ev.event as "version" | "error"
          return { ok: true, status: 200, terminal }
        }
      }
    }
    return { ok: true, status: 200, terminal: terminal ?? "stream_closed" }
  } finally {
    opts.signal?.removeEventListener("abort", abortHandler)
  }
}

function parseFrame(raw: string): SseEvent | null {
  let event = "message"
  const data: string[] = []
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim()
    else if (line.startsWith("data:")) data.push(line.slice(5).trimStart())
  }
  if (data.length === 0) return null
  try {
    return { event, data: JSON.parse(data.join("\n")) as Record<string, unknown> }
  } catch {
    return { event, data: { raw: data.join("\n") } }
  }
}
