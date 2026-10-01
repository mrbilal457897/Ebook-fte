"use client"

import { useCallback, useState } from "react"

import { triggerUpgrade } from "@/lib/upgrade"

/**
 * T040 US3 exhaustion prompt: shown when a generation attempt returns
 * `402 free_tier_exhausted`. On click it starts the Lago checkout flow and
 * opens the gateway-hosted page where the customer stores a payment method.
 *
 * The link Lago returns expires after 24 hours, so that is stated plainly
 * instead of letting the customer discover it as a dead link tomorrow.
 */
export default function UpgradePrompt() {
  const [state, setState] = useState<"idle" | "starting" | "ok" | "error">("idle")
  const [message, setMessage] = useState<string>("")

  const onUpgrade = useCallback(async () => {
    setState("starting")
    const result = await triggerUpgrade()
    if (!result.ok) {
      setState("error")
      setMessage(result.message)
      return
    }
    window.open(result.checkoutUrl, "_blank", "noopener")
    setState("ok")
    setMessage(
      result.expiresInHours
        ? `Opening checkout — this link expires in ${result.expiresInHours} hours.`
        : "Opening checkout…",
    )
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