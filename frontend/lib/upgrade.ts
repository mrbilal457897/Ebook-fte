export type UpgradeResult =
  | { ok: true; checkoutUrl: string; expiresInHours: number | null }
  | { ok: false; message: string }

/**
 * T040 upgrade trigger (US3, FR-011): starts the Lago checkout flow from the
 * exhaustion prompt.
 *
 * The server returns a real per-customer gateway checkout URL, or a `code`
 * explaining why it could not. Note the shape is no longer
 * `{ deferred, url }`: that contract existed only to describe a checkout flow
 * which did not exist, and `deferred: true` with a `url` was ambiguous — the
 * old client could not tell "billing is unconfigured" from "here is your
 * checkout link" and reported both as success.
 */
export async function triggerUpgrade(): Promise<UpgradeResult> {
  const res = await fetch("/api/upgrade", { method: "POST" })
  const body = (await res.json().catch(() => null)) as {
    checkoutUrl?: string
    expiresInHours?: number
    message?: string
    code?: string
  } | null

  if (!res.ok || !body?.checkoutUrl) {
    return {
      ok: false,
      message:
        body?.message ??
        (res.status === 503
          ? "Upgrades aren’t available on this deployment right now."
          : "Upgrade could not be started — try again."),
    }
  }

  return {
    ok: true,
    checkoutUrl: body.checkoutUrl,
    expiresInHours: body.expiresInHours ?? null,
  }
}