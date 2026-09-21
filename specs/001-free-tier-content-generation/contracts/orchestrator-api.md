# Internal API — Orchestrator Service

Next.js → `agents/orchestrator` (Python/ADK). Not reachable from the browser;
the only network-facing endpoint is [generation-api.md](generation-api.md).

## `POST /v1/generate` (SSE)

- **Auth:** short-lived internal token (env-configured secret) — the caller
  (Next.js) has already authenticated the user. The Orchestrator **derives
  business context from the forwarded `accountRef`, never from model text**
  (Article IV.5).
- **Request body:**
  ```json
  {
    "prompt": "…",
    "accountRef": { "tenantId": uuid, "accountId": uuid },
    "modelCredentialId": "optional-uuid" | null,
    "conversationId": uuid,
    "rateLimitContext": { "deviceKey": "sha256-hex", "clientIpKey": "sha256-hex" | null }
  }
  ```
  Device fingerprint + client IP are hashed at the Next.js boundary
  (`frontend/lib/rate-limit.ts`); only SHA-256 digests travel here — raw
  IPs/fingerprints never appear on the wire, in logs, or in audit rows.
- **Pre-stream rejections** mirror the external API's JSON errors with the
  same codes (`already_in_progress`, `free_tier_exhausted`, `invalid_prompt`,
  `rate_limited`), so Next.js proxies them untouched. Over a device or IP
  limit → `429 {"code":"rate_limited"}` before the free-tier admission (FR-002).
- **SSE events** are forwarded verbatim to the client and additionally trigger
  server-side effects at the Orchestrator:

  | Event | Orchestrator-side effect |
  |-------|--------------------------|
  | `token` | append to `content_versions.content` + bump `updated_at` (+ lease renew); emit after the write commits (FR-005) |
  | `version` | set `is_partial = false`; write exactly one `capability_invocations` row + one `audit_log` terminal row in the same transaction (FR-006/AC5); release the lease |
  | `error` | single immutable terminal audit row (`generation.failed`); `refunded:true` → decrement `free_tier_count` in the same transaction, only for provider/BYOK faults (Q1/FR-008); release the lease |

- **Guarantees enforced exclusively here** (never in the client, never as an
  agent tool):
  1. Device/IP rate-limit admit: atomic `rate_limit_counts`
     INSERT…ON CONFLICT per (tenant_id, account_id, kind, window); over-limit
     → `rate_limited`, no model call, no credit (FR-002).
  2. Atomic credit admission: `UPDATE accounts SET free_tier_count =
     free_tier_count + 1 WHERE id = :account AND tenant_id = :tenant AND
     free_tier_count < limit RETURNING free_tier_count` (FR-007).
  3. In-flight lease: guarded insert into `run_states`; renewal per `token`;
     self-expiry with no terminal event (FR-009, Q2).
  4. BYOK resolution from `model_credentials` (decrypt in-memory only);
     failure → `byok_invalid` error, refund, **no** platform fallback (FR-008).
  5. Routing: Orchestrator composes the Content Agent sub-agent; the client
     never reaches it (FR-003).

## Data-access rules (Article IV.3)

- All Postgres access from this service is orchestration code with fixed,
  named statements — **no agent-facing "run SQL" or "run code" tool exists**.
- Audit invariant: exactly one `capability_invocations` row and one terminal
  `audit_log` row per generation, same transaction as the final content write
  (AC5). Optional per-chunk `audit_log` rows, if added, use action
  `persistence.chunk` so AC5 can count terminal rows unambiguously.

## Operation notes

- Idempotency: a retried `POST /v1/generate` with the same `conversationId`
  and an already-used version must not double-admit (admission gate returns
  `already_in_progress` if a lease exists).