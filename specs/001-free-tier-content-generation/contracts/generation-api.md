# External API — Generation, Account, Content

Browser ↔ Next.js. Auth is the Next.js session (cookie). All other contracts
are [orchestrator-api.md](orchestrator-api.md) (internal).

## `POST /api/generate`

Starts a generation and streams the book content.

- **Auth:** required. Signed-out → `401` `{ "code": "signed_out" }` with **no**
  rows created anywhere (FR-001, AC1).
- **Request body:**
  ```json
  { "prompt": "a pirate chef writes a memoir", "bookId": "optional-existing-uuid" }
  ```
- **Pre-stream rejections** (JSON, no model call made, no credit consumed):

  | Status | Body | When |
  |--------|------|------|
  | `400` | `{ "code": "invalid_prompt" }` | empty/oversized prompt |
  | `409` | `{ "code": "already_in_progress" }` | an active lease exists for this account (FR-009/AC6) |
  | `402` | `{ "code": "free_tier_exhausted", "upgrade": true }` | `free_tier_count >= limit` (FR-007/AC2); UI shows the upgrade prompt (FR-011) |
  | `429` | `{ "code": "rate_limited" }` | device or IP over its configured limit (FR-002); no credit consumed |

- **On admission** the response begins as `text/event-stream; charset=utf-8`
  with the events below. Every `token` event is persisted incrementally before
  it is emitted (FR-005), the lease is renewed, and the first `token` event
  must arrive ≤ 2 s under normal load (FR-004/AC3).

  | Event | Data |
  |-------|------|
  | `token` | `{ "delta": "…" }` — one streamed text chunk |
  | `version` | `{ "versionId": uuid, "bookId": uuid, "conversationId": uuid, "isPartial": false, "fullText": "…" }` — terminal success; exactly one per generation (AC5) |
  | `error` | `{ "code": "byok_invalid" \| "provider_error" \| "rate_limited" \| "internal", "message": "…", "refunded": true }` — terminal; `refunded:true` only when a provider/BYOK fault (Clarification Q1; FR-008). No fallback ever occurs. |

  A streamed `rate_limited` error event means the **provider** throttled the
  request; the boundary device/IP limit instead rejects with JSON `429`
  pre-stream (FR-002) — see the table above.

- **Connection drop:** the lease stops being renewed and self-expires
  (Clarification Q2); the credit already consumed is **not** refunded
  (Clarification Q1). Client re-fetches via `GET /api/generation/[id]`.

### Wire example

```
POST /api/generate
→ 200 text/event-stream
event: token
data: {"delta":"Once "}

event: token
data: {"delta":"upon a "}

event: version
data: {"versionId":"…","bookId":"…","conversationId":"…","isPartial":false,"fullText":"Once upon a …"}
```

### Client requirements

- Use `fetch(..., { method: 'POST', body: JSON.stringify({ prompt }) })` and
  read the SSE-formatted body with a `ReadableStream` reader (`EventSource` is
  GET-only and unusable for POST).
- Abort the reader on unmount/refresh; show "generation stopped" on stream
  error or premature close (Edge Cases).

## `GET /api/generation/[id]`

Re-fetches saved content after an interruption (AC4, User Story 4).

- **Auth:** required. `404` if the version is not in the caller's tenant.
- **200** → `{ "versionId": uuid, "bookId": uuid, "conversationId": uuid,
  "content": "…", "isPartial": true|false, "updatedAt": iso }`
- Content shown by the UI and `content` returned here must match for every
  check that occurred before the interruption (AC4).

## `GET /api/account`

Drives the allowance display and exhaustion prompt.

- **Auth:** required.
- **200** → `{ "freeTier": { "used": n, "limit": 3, "remaining": m },
  "inFlight": bool, "activeByokProvider": "gemini"|"openai"|"anthropic"|null }`
- `inFlight` mirrors the live lease so the UI can present the
  already-in-progress state across devices (FR-009).