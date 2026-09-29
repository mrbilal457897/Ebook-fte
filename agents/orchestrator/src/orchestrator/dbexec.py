"""Run the Orchestrator's blocking Postgres work off the event loop.

`models.transaction()` is synchronous psycopg, and every stage of a generation
is a database round trip: admission, BYOK resolution, and — by FR-005 — one
commit per streamed chunk, committed *before* the corresponding `token` event is
emitted. Called inline from the `async def` endpoint, each of those round trips
blocks the whole event loop. Measured against the project's real remote
Postgres (T046), one round trip costs 0.4-0.9 s, so a single generation pinned
the loop for seconds at a time and any second request arriving in that window
could not even begin.

Two consequences, both fixed by handing the blocking work to a worker thread:

1. **Latency.** The SSE response is produced by the generator; the commit is
   still awaited before the token is yielded (FR-005 is unchanged — nothing the
   customer saw is ever unpersisted), but the loop stays free to flush the
   response and serve other work while the commit is in flight.
2. **Concurrency.** Because the loop is no longer pinned, two requests genuinely
   overlap. `already_in_progress` becomes observable at the HTTP layer instead of
   being masked by serialisation (the T046 `AC6-http` skip).

`psycopg_pool.ConnectionPool` is thread-safe, and each `transaction()` checks
out its own connection, so running these concurrently is exactly what the pool
exists for. Ordering is preserved where it matters: `await run_blocking(...)`
completes before the next stage starts.
"""

import asyncio
from collections.abc import Callable


async def run_blocking[T](fn: Callable[[], T]) -> T:
    """Run `fn()` in the default thread pool, propagating its result/exception."""
    return await asyncio.to_thread(fn)
