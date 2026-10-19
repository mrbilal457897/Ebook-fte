"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"

import Composer from "@/components/generate/composer"
import GenerateShell from "@/components/generate/generate-shell"
import UpgradePrompt from "@/components/generate/upgrade-prompt"
import StreamPanel from "@/components/stream/stream-panel"
import type { StreamStatus } from "@/components/stream/stream-panel"
import { ensureCurrentSessionLinked } from "@/lib/auth/client-link"
import { streamGenerate } from "@/lib/sse-client"

type AccountState = {
  freeTier: { used: number; limit: number; remaining: number }
  inFlight: boolean
}

type Refetched = {
  versionId: string
  content: string
  isPartial: boolean
}

/**
 * T036 generation workspace: composer + watch-it-write stream panel driven by
 * the SSE client. Aborts the reader on unmount (US4 groundwork), shows a
 * "still working" state when the first token drags (FR-004), and renders an
 * upgrade prompt when the free allowance is spent (US3 groundwork).
 */
function GenerateWorkspace() {
  const [prompt, setPrompt] = useState("")
  const [text, setText] = useState("")
  const [status, setStatus] = useState<StreamStatus>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [stillWorking, setStillWorking] = useState(false)
  const [upgradePrompt, setUpgradePrompt] = useState(false)
  const [account, setAccount] = useState<AccountState | null>(null)
  const [savedHint, setSavedHint] = useState<Refetched | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const refreshAccount = useCallback(async () => {
    const res = await fetch("/api/account", { cache: "no-store" })
    if (res.ok) setAccount((await res.json()) as AccountState)
  }, [])

  const refetchSaved = useCallback(async (versionId: string) => {
    controllerRef.current?.abort()
    const res = await fetch(`/api/generation/${versionId}`, { cache: "no-store" })
    if (!res.ok) {
      setErrorMessage("Saved content could not be retrieved.")
      setStatus("error")
      return
    }
    const saved = (await res.json()) as Refetched
    setText(saved.content)
    setSavedHint({ versionId: saved.versionId, content: saved.content, isPartial: saved.isPartial })
    setStatus(saved.isPartial ? "stopped" : "done")
  }, [])

  useEffect(() => {
    if (!/fte_device_id=/.test(document.cookie)) {
      document.cookie = `fte_device_id=${crypto.randomUUID()}; path=/; max-age=63072000; samesite=lax`
    }
    // The `accounts` row is what `resolveTenancy` and every tenant-scoped query
    // resolve against. It used to be created only by the first-sign-in seam on
    // /signup and /signin, so anyone who landed straight on /generate while
    // already authenticated (bookmark, refresh, a direct link) had no row and
    // every generation failed with `no_account`. Bind on arrival, before the
    // allowance read, so the workspace is usable the moment it renders.
    let cancelled = false
    async function bindAndLoad() {
      const slug = new URLSearchParams(window.location.search).get("tenant") ?? "example-press"
      await ensureCurrentSessionLinked(slug)
      if (!cancelled) await refreshAccount()
    }
    void bindAndLoad()
    return () => {
      cancelled = true
    }
  }, [refreshAccount])

  // US4: after a refresh/close, offer to retrieve the last interrupted draft.
  const [interruptedVersionId, setInterruptedVersionId] = useState<string | null>(null)
  useEffect(() => {
    setInterruptedVersionId(sessionStorage.getItem("fte_version"))
  }, [])

  useEffect(() => {
    return () => controllerRef.current?.abort()
  }, [])

  const onGenerate = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setText("")
    setSavedHint(null)
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
          const versionId = String(ev.data.versionId ?? "")
          setStatus("done")
          setSavedHint({
            versionId,
            content: String(ev.data.fullText ?? ""),
            isPartial: ev.data.isPartial === true,
          })
          sessionStorage.setItem("fte_version", versionId)
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

        {upgradePrompt && <UpgradePrompt />}

        {interruptedVersionId && status === "idle" && !savedHint && (
          <div className="banner is-info" role="status">
            You have a saved in-progress draft.
            <button
              className="btn-secondary"
              onClick={() => void refetchSaved(interruptedVersionId)}
            >
              Retrieve it
            </button>
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
          savedHint={savedHint?.isPartial ? savedHint.content : null}
        />
      </div>
    </GenerateShell>
  )
}

/**
 * `Suspense` matches the (auth) pages: the workspace reads the entry tenant
 * from the URL on mount, and a client component that does must sit inside a
 * boundary or the whole route bails out of prerendering.
 */
export default function GeneratePage() {
  return (
    <Suspense fallback={<GenerateShell>{null}</GenerateShell>}>
      <GenerateWorkspace />
    </Suspense>
  )
}
