"""Incremental persistence of streamed content (T032, FR-005/FR-006).

Each chunk is appended to `content_versions.content` and the in-flight lease
is renewed in the SAME committed transaction, BEFORE the `token` event is
emitted to the customer (research.md §7, AC4): whatever the UI shows, the
system-of-record already holds. The terminal event flips `is_partial=false`
and writes exactly one `capability_invocations` row + one `audit_log` row in
a single transaction (FR-006, AC5, T028).

This module owns the transaction shapes; `server.py` owns the ordering of
events vs. commits. No agent-facing SQL here (Article IV.3).
"""

from psycopg import Connection

from orchestrator import gate, models


def persist_chunk(
    conn: Connection,
    *,
    version_id: str,
    tenant_id: str,
    account_id: str,
    delta: str,
    lease_id: str,
    lease_window_seconds: int,
) -> None:
    """Append one streamed chunk and renew the live lease (T043 groundwork)."""
    models.append_content(
        conn,
        version_id=version_id,
        tenant_id=tenant_id,
        account_id=account_id,
        delta=delta,
    )
    models.renew_lease(
        conn,
        lease_id=lease_id,
        tenant_id=tenant_id,
        account_id=account_id,
        window_seconds=lease_window_seconds,
    )


def finalize_generation(
    conn: Connection,
    *,
    version_id: str,
    tenant_id: str,
    account_id: str,
    lease_id: str,
    agent: str,
    inputs: dict,
    output: dict,
    latency_ms: int,
    success: bool,
    action: str = "generation.complete",
    status: str = "success",
) -> None:
    """Terminal transaction: finalize version, record one invocation + one
    audit row, release the lease (FR-006, AC5, T028 all in the same txn)."""
    models.finalize_content_version(
        conn,
        version_id=version_id,
        tenant_id=tenant_id,
        account_id=account_id,
    )
    models.record_invocation(
        conn,
        tenant_id=tenant_id,
        account_id=account_id,
        agent=agent,
        action=action,
        inputs=inputs,
        output=output,
        latency_ms=latency_ms,
        success=success,
    )
    models.record_audit(
        conn,
        tenant_id=tenant_id,
        account_id=account_id,
        agent=agent,
        action=action,
        inputs=inputs,
        output=output,
        status=status,
    )
    models.release_lease(
        conn,
        lease_id=lease_id,
        tenant_id=tenant_id,
        account_id=account_id,
    )


def fail_generation(
    conn: Connection,
    *,
    tenant_id: str,
    account_id: str,
    lease_id: str,
    agent: str,
    inputs: dict,
    output: dict,
    refund: bool,
) -> None:
    """Failure transaction: refund the consumed credit when nothing usable was
    produced (FR-008, Clarification Q1), write one `generation.failed` audit
    row, release the lease — all atomically."""
    if refund:
        gate.refund_free_tier(
            conn,
            tenant_id=tenant_id,
            account_id=account_id,
        )
    models.record_audit(
        conn,
        tenant_id=tenant_id,
        account_id=account_id,
        agent=agent,
        action="generation.failed",
        inputs=inputs,
        output=output,
        status="failed",
    )
    models.release_lease(
        conn,
        lease_id=lease_id,
        tenant_id=tenant_id,
        account_id=account_id,
    )