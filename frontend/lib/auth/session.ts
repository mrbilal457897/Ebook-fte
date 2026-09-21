import { auth, assertAuthConfigured } from "@/lib/auth/server"

export type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>

/**
 * Read the authenticated session in a route handler / DAL call.
 * Returns `null` when the visitor is signed out.
 *
 * Enforcement of sign-in happens HERE (and in every handler that consumes
 * this), never in middleware alone — middleware is bypassable
 * (CVE-2025-29927 class, research.md §1 security note).
 */
export async function getSession(): Promise<AuthSession> {
  assertAuthConfigured()
  return auth.api.getSession({ headers: await headers() })
}

async function headers(): Promise<Headers> {
  const { headers: nextHeaders } = await import("next/headers")
  return nextHeaders()
}
