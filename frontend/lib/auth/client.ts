import { createAuthClient } from "better-auth/react"

/**
 * No relative base URL here.
 *
 * better-auth treats any truthy `baseURL` as absolute and runs it straight
 * through `new URL()` (better-auth/dist/utils/url.mjs, `withPath` ->
 * `assertHasProtocol`). `baseURL: "/"` therefore throws
 * `BetterAuthError: Invalid base URL: /` in the browser, before any request is
 * sent, which took down sign-up, sign-in and the Google button together.
 *
 * Passing the app's own origin keeps every auth request on this origin — so it
 * also keeps the session cookie first-party and tenant-scoped — with no
 * duplicate configuration of the public URL.
 */
export const authClient = createAuthClient({
  baseURL: typeof window === "undefined" ? undefined : window.location.origin,
})
