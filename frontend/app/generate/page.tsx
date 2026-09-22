"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import Composer from "@/components/generate/composer"
import GenerateShell from "@/components/generate/generate-shell"
import StreamPanel from "@/components/stream/stream-panel"
import type { StreamStatus } from "@/components/stream/stream-panel"
import { streamGenerate } from "@/lib/sse-client"

type AccountState = {
  freeTier: { used: number; limit: number; remaining: number }
  inFlight: boolean
}

/**
 * T036 generation workspace: composer + watch-it-write stream panel driven by
 * the SSE client. Aborts the reader on unmount (US4 groundwork), shows a
 * "still working" state when the first token drags (FR-004), and renders an
 * upgrade prompt when the free allowance is spent (US3 groundwork).
 */
export default function GeneratePage() {
  const [prompt, setPrompt] = useState("")
  const [text, setText] = useState("")
  const [status, setStatus] = useState<StreamStatus>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [stillWorking, setStillWorking] = useState(false)
  const [upgradePrompt, setUpgradePrompt] = useState(false)
  const [account, setAccount] = useState<AccountState | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const refreshAccount = useCallback(async () => {
    const res = await fetch("/api/account", { cache: "no-store" })
    if (res.ok) setAccount((await res.json()) as AccountState)
  }, [])

  useEffect(() => {
    if (!/fte_device_id=/.test(document.cookie)) {
      document.cookie = `fte_device_id=${crypto.randomUUID()}; path=/; max-age=63072000; samesite=lax`
    }
    void refreshAccount()
  }, [refreshAccount])

  useEffect(() => {
    return () => controllerRef.current?.abort()
  }, [])

  const onGenerate = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setText("")
    setErrorMessage(null)
    setUpgradePrompt(false)
    setStatus("working")
    setStillWorking(false)

    const slowTimer = setTimeout(() => setStillWorking(true), 1200)

    const result = await streamGenerate(prompt, {
      signal: controller.signal,
      onEvent: (ev) => {
        if (ev.event === "token") {
          setStillWorking(false)
          setText((prev) => prev + String(ev.data.delta ?? ""))
        } else if (ev.event === "version") {
          setStatus("done")
        }
      },
    })

    clearTimeout(slowTimer)

    if (controller.signal.aborted) {
      setStatus("stopped")
      return
    }

    if (!result.ok) {
      if (result.errorCode === "free_tier_exhausted") {
        setUpgradePrompt(true)
        setStatus("idle")
      } else if (result.errorCode === "already_in_progress") {
        setErrorMessage("A generation is already in progress on another tab or device.")
        setStatus("stopped")
      } else {
        setErrorMessage(result.errorCode ?? `request failed (${result.status})`)
        setStatus("error")
      }
    } else if (result.terminal === "error") {
      setErrorMessage(
        "The model stopped mid-stream — credits were refunded if this was a provider fault.",
      )
      setStatus("error")
    } else if (result.terminal === "stream_closed") {
      setErrorMessage(null)
      setStatus("stopped")
    } else {
      setStatus("done")
    }

    void refreshAccount()
  }, [prompt, refreshAccount])

  const allowanceLabel = account
    ? account.freeTier.remaining > 0
      ? `${account.freeTier.remaining} ${account.freeTier.remaining === 1 ? "free generation" : "free generations"} left`
      : "Free allowance used up"
    : ""

  return (
    <GenerateShell>
      <div className="app-panel">
        <header className="app-head">
          <span className="app-title">Write your book</span>
          {allowanceLabel && (
            <span className={`allowance-pill ${status === "working" ? "is-working" : ""}`}>
              <span className="dot" />
              {allowanceLabel}
            </span>
          )}
        </header>

        {upgradePrompt && (
          <div className="banner is-warn" role="alert">
            You‘ve used your 3 free generations. Upgrade to keep writing — the subscription flow is
            on its way.
          </div>
        )}

        <Composer
          prompt={prompt}
          onChange={setPrompt}
          busy={status === "working"}
          onGenerate={onGenerate}
        />

        <StreamPanel
          text={text}
          status={status}
          stillWorking={stillWorking}
          errorMessage={errorMessage}
        />
      </div>
    </GenerateShell>
  )
}
