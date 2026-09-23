export type UpgradeResult = {
  deferred: boolean
  url: string | null
  message: string
}

/**
 * T040 upgrade trigger (US3, FR-011): initiates the Lago subscription-checkout
 * entry point from the exhaustion prompt. This slice only fires the trigger
 * — the Lago checkout flow itself is a separate slice — so the result is
 * normally `{ deferred: true }`; if a checkout URL is configured server-side
 * it is returned here for the prompt to open.
 */
export async function triggerUpgrade(): Promise<UpgradeResult> {
  const res = await fetch("/api/upgrade", { method: "POST" })
  const body = (await res.json()) as Partial<UpgradeResult>
  if (!res.ok || !body.deferred) {
    return {
      deferred: false,
      url: null,
      message: body.message ?? "Upgrade could not be started — try again.",
    }
  }
  return {
    deferred: true,
    url: body.url ?? null,
    message: body.message ?? "Checkout is on its way.",
  }
}
