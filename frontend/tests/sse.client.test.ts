import { describe, expect, it, vi } from "vitest"

import { readSse, streamGenerate } from "@/lib/sse-client"
import type { SseEvent } from "@/lib/sse-client"

function frame(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function streamOf(frames: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const f of frames) controller.enqueue(enc.encode(f))
      controller.close()
    },
  })
}

describe("US2 SSE client (T029): /api/generate stream parsing", () => {
  it("parses token deltas and a terminal version event", async () => {
    const seen: SseEvent[] = []
    const result = await readSse(
      streamOf([
        frame("token", { delta: "The first " }),
        frame("token", { delta: "sentence." }),
        frame("version", {
          versionId: "v1",
          bookId: "b1",
          conversationId: "c1",
          isPartial: false,
          fullText: "The first sentence.",
        }),
      ]),
      { onEvent: (ev) => seen.push(ev) },
    )

    expect(result).toEqual({ ok: true, status: 200, terminal: "version" })
    expect(seen.map((e) => e.event)).toEqual(["token", "token", "version"])
    expect((seen[2].data as { fullText: string }).fullText).toBe("The first sentence.")
  })

  it("terminates on an error event", async () => {
    const seen: SseEvent[] = []
    const result = await readSse(streamOf([frame("error", { code: "provider_error" })]), {
      onEvent: (ev) => seen.push(ev),
    })

    expect(result).toEqual({ ok: true, status: 200, terminal: "error" })
    expect(seen[0]).toEqual({ event: "error", data: { code: "provider_error" } })
  })

  it("handles frames split across many chunks (incremental TextDecoder)", async () => {
    const full = frame("token", { delta: "split across chunks" })
    const halfA = Math.ceil(full.length / 2)
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const enc = new TextEncoder()
        controller.enqueue(enc.encode(full.slice(0, halfA)))
        controller.enqueue(enc.encode(full.slice(halfA)))
        controller.close()
      },
    })

    const seen: SseEvent[] = []
    await readSse(stream, { onEvent: (ev) => seen.push(ev) })
    expect(seen).toEqual([{ event: "token", data: { delta: "split across chunks" } }])
  })

  it("reports stream_closed terminal when the stream ends without a terminal event", async () => {
    const result = await readSse(streamOf([frame("token", { delta: "partial only" })]))
    expect(result).toEqual({ ok: true, status: 200, terminal: "stream_closed" })
  })

  it("POSTs the prompt and reads pre-stream JSON rejections", async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: "free_tier_exhausted", upgrade: true }), {
        status: 402,
        headers: { "Content-Type": "application/json" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await streamGenerate("some prompt")

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("/api/generate")
    expect(JSON.parse(init.body as string)).toEqual({ prompt: "some prompt" })
    expect(result).toEqual({
      ok: false,
      status: 402,
      errorCode: "free_tier_exhausted",
      upgrade: true,
    })
    vi.unstubAllGlobals()
  })

  it("aborts the reader when the signal fires (unmount/refresh)", async () => {
    const controller = new AbortController()
    controller.abort()

    const result = await readSse(
      new ReadableStream<Uint8Array>({
        pull() {
          throw new Error("reader must not be pulled after abort")
        },
      }),
      { signal: controller.signal },
    ).catch(() => ({ ok: false as const, status: 0, errorCode: "aborted", upgrade: undefined }))

    expect(result).toBeTruthy()
  })
})
