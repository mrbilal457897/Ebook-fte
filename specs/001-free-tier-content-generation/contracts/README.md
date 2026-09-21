# Contracts: Free-Tier Real-Time Content Generation

This directory defines the interfaces this slice exposes and consumes.

| File | Interface | Kind |
|------|-----------|------|
| [generation-api.md](generation-api.md) | `POST /api/generate` (SSE), `GET /api/generation/[id]`, `GET /api/account` | External (browser → Next.js) |
| [orchestrator-api.md](orchestrator-api.md) | `POST /v1/generate` (SSE) | Internal (Next.js → agents/orchestrator) |
| [orchestrator-prompt.md](orchestrator-prompt.md) | Orchestrator system prompt (ratified 2026-09-19) | Agent persona (Build Task 3 `SYSTEM_PROMPT`) |

Cross-cutting rules every contract inherits:

- **Tenant scoping (Article IV.5):** `tenant_id` is derived from the
  authenticated Next.js session at the boundary and forwarded to internal
  services with a short-lived internal token. It is never accepted from
  model output or request text.
- **No BYOK leakage:** provider keys never appear in any contract payload,
  log, or audit row.
- **SSE discipline:** any streamed response returns `Response(stream)`
  immediately, `runtime='nodejs'`, `dynamic='force-dynamic'`, headers
  `Content-Type: text/event-stream`, `Connection: keep-alive`,
  `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`.
- **Rejections before streaming are JSON** (not SSE) so the client gets a
  clean, typed error for pre-admission failures (401/409/402/400).