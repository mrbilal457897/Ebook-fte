# E-book FTE — frontend

Next.js 15 App Router application. The customer-facing surface: sign-up/sign-in,
the streaming generation UI, and the server-side boundary where tenancy is
derived from the session.

**Slice:** 001 (free-tier content generation). It is the only slice that has
touched the frontend so far. Spec: `specs/001-free-tier-content-generation/`.

## What it is

- **`app/(auth)/`** — sign-up and sign-in. Email/password plus Google OAuth, via
  Better Auth behind a narrow `lib/auth/` seam. First sign-in creates the
  `accounts` row and binds it to the tenant the visitor arrived on, with the
  free-tier counter at 0 of 3.
- **`app/generate/`** — the generation page. Composer, live stream panel,
  allowance countdown, and explicit states for a slow first token, a
  stop-on-error, and an interruption ("generation stopped" with an offer to
  re-fetch the partial content).
- **`app/api/`** — the server-side boundary:
  - `api/generate/` — the SSE proxy to the Orchestrator. Presents
    `INTERNAL_AUTH_TOKEN` and an `accountRef` from the session, and passes the
    Orchestrator's token/version/error events and pre-stream JSON errors through
    untouched.
  - `api/account/` — free-tier used/limit/remaining, in-flight flag, active BYOK
    provider.
  - `api/generation/[id]/` — re-fetch of a partial or complete generation.
    Auth-required and tenant-scoped; a foreign id is a 404, not a 403.
  - `api/upgrade/` — the subscription-entry trigger. **Only the trigger.**
    Lago checkout is a separate slice (T040).
- **`lib/`**
  - `lib/tenancy.ts` — derives `tenant_id` from the authenticated session only.
    It never reads a `tenant_id` the model or the client volunteered.
  - `lib/rate-limit.ts` — hashes device/IP to SHA-256 at this boundary; the raw
    value is never sent onward.
  - `lib/sse-client.ts` — fetch-POST + `ReadableStream` parser, aborts on unmount.

## Run

```sh
cp .env.example .env    # repo root; see the file for every required variable
npm install
npm run dev             # http://localhost:3000
```

The Orchestrator and the `ebook-data` MCP server must be running for generation
to work — see `agents/orchestrator/README.md`.

## Test

```sh
npm run lint            # ESLint
npm run test            # Vitest
npm run format:check    # Prettier
```

Tests cover the auth gate (signed-out request stores nothing), sign-up tenant
linkage, the SSE client's stream parsing and abort, the proxy's event
pass-through, the account route, and partial-content re-fetch after an
interruption.
