import { ensureAccount, resolveTenantBySlug } from "@/lib/accounts"

export type FirstSignInInput = {
  tenantSlug: string
  authSubject: string
  email: string
}

export type FirstSignInResult = {
  tenantId: string
  accountId: string
  created: boolean
}

/**
 * First-sign-in handler (T022): bind the newly authenticated user to the
 * tenant whose entry point they arrived through.
 *
 * The slug comes from the entry URL the visitor chose (a tenant's own link,
 * e.g. `?tenant=example-press`), resolves against the `tenants` table — an
 * unknown slug fails loudly, it never invents a tenant. `authSubject` is the
 * session user id (better-auth), the same value resolveTenancy later matches
 * on. Provider-agnostic: email/password and OAuth first sign-ins both land
 * here.
 */
export async function onFirstSignIn(input: FirstSignInInput): Promise<FirstSignInResult> {
  const tenant = await resolveTenantBySlug(input.tenantSlug)
  return ensureAccount({
    tenantId: tenant.id,
    authSubject: input.authSubject,
    email: input.email,
  })
}
