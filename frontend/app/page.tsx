import Landing from "@/components/landing/landing"
import { getSession } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

/**
 * Public entry point. A visitor who arrived through a company's tenant link
 * (`/?tenant=<slug>`) keeps that slug so sign-up binds them to the right
 * tenant (FR-010). Signed-in visitors get the same page with the primary
 * action pointed at their workspace — no forced redirect.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>
}) {
  const { tenant } = await searchParams

  let signedIn = false
  try {
    const session = await getSession()
    signedIn = Boolean(session?.user?.id)
  } catch {
    signedIn = false
  }

  return <Landing signedIn={signedIn} tenantSlug={tenant?.trim() || "example-press"} />
}
