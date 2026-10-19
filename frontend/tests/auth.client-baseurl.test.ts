import { afterEach, describe, expect, it, vi } from "vitest"

import { createAuthClient } from "better-auth/react"

/*
 * Regression guard for the browser-side failure that took down sign-up,
 * sign-in and the Google button at once:
 *
 *   BetterAuthError: Invalid base URL: /. Please provide a valid base URL.
 *
 * better-auth treats any truthy `baseURL` as absolute and runs it through
 * `new URL()` (dist/utils/url.mjs: withPath -> assertHasProtocol), so the
 * relative `baseURL: "/"` this project used to configure threw before a single
 * request left the browser. The server-side endpoints were healthy the whole
 * time, which is exactly why only a test that constructs the real client can
 * catch it.
 */

const ORIGIN = "http://localhost:3000"

function stubBrowser() {
  vi.stubGlobal("window", {
    location: { origin: ORIGIN, href: `${ORIGIN}/signup` },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("authClient base URL", () => {
  it("rejects a relative baseURL — the exact failure that broke auth", () => {
    stubBrowser()
    expect(() => createAuthClient({ baseURL: "/" })).toThrow(/Invalid base URL/)
  })

  it("constructs against the app origin when no baseURL is given", () => {
    stubBrowser()
    const client = createAuthClient({ baseURL: undefined })
    expect(client).toBeTruthy()
    expect(() => createAuthClient({ baseURL: ORIGIN })).not.toThrow()
  })

  it("the shipped client module builds without throwing, server or browser", async () => {
    // Node (no window): must not throw, which is what keeps the server render
    // and the `await import()` call sites in the auth pages safe.
    vi.resetModules()
    const serverSide = await import("@/lib/auth/client")
    expect(serverSide.authClient).toBeTruthy()

    // Browser: resolves the app origin rather than a bare "/".
    stubBrowser()
    vi.resetModules()
    const browserSide = await import("@/lib/auth/client")
    expect(browserSide.authClient).toBeTruthy()
  })
})
