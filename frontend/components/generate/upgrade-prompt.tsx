"use client"

import { useCallback, useState } from "react"

import { triggerUpgrade } from "@/lib/upgrade"

/**
 * T040 US3 exhaustion prompt: shown when a generation attempt returns
 * `402 free_tier_exhausted`. Presents a clear upgrade call-to-action and, on
 * click, fires the Lago checkout-entry trigger (lib/upgrade + /api/upgrade).
 * Checkout itself is deferred to a later slice, so the success message says
 * so explicitly instead of pretending a payment flow exists.
 */
export default function UpgradePrompt() {
  const [state, setState] = useState<"idle" | "starting" | "ok" | "error">("idle")
  const [message, setMessage] = useState<string>("")

  const onUpgrade = useCallback(async () => {
    setState("starting")
    const result = await triggerUpgrade()
    if (!result.deferred && !result.url) {
      setState("error")
      setMessage(result.message)
      return
    }
    if (result.url) {
      window.open(result.url, "_blank", "noopener")
      setState("ok")
      setMessage("Opening checkout…")
      return
    }
    setState("ok")
    setMessage(result.message)
  }, [])

  return (
    <div className="banner is-warn" role="alert">
      <div className="upgrade-prompt-copy">
        <strong>You’ve used your free generations.</strong>
        <span>Upgrade to keep writing with your own model keys.</span>
      </div>
      <button
        className="btn-primary upgrade-prompt-cta"
        disabled={state === "starting"}
        onClick={onUpgrade}
      >
        {state === "starting" ? "Starting…" : "Upgrade"}
      </button>
      {(state === "ok" || state === "error") && (
        <span className="upgrade-prompt-status">{message}</span>
      )}
    </div>
  )
}
