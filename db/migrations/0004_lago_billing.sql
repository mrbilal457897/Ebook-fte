-- 0004 — Lago-backed billing records.
-- AGENTS.md §8 lists `subscriptions` / `invoices` in the system of record, and
-- §2 says Lago provides subscription + invoicing logic while card capture
-- still needs a licensed payment gateway underneath. So these tables mirror
-- Lago as the source of truth for billing state, and hold no card data.
--
-- Forward-only; do not edit after being applied.

BEGIN;

-- AGENTS.md §8 says `accounts` carries the end-customer's "subscription tier",
-- but the column was never added - 0001 created the table without it. Added
-- here rather than edited into 0001 because 0001 has been applied. The free
-- tier is what the gate enforces today, so this is denormalised state kept in
-- step with `subscriptions` by the webhook handler, not an independent input.
ALTER TABLE accounts
    ADD COLUMN subscription_tier text NOT NULL DEFAULT 'free';

ALTER TABLE accounts
    ADD CONSTRAINT accounts_subscription_tier_valid
    CHECK (subscription_tier IN ('free', 'pro', 'enterprise'));

-- One Lago subscription per account. `lago_external_id` is Lago's own
-- subscription id; `external_id` is the id WE sent Lago, so a webhook can be
-- matched even if Lago's row was created by a retry.
CREATE TABLE subscriptions (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        uuid NOT NULL REFERENCES tenants(id),
    account_id       uuid NOT NULL REFERENCES accounts(id),
    lago_external_id text NOT NULL UNIQUE,
    lago_customer_id text,
    plan_code        text NOT NULL,
    external_id      text NOT NULL UNIQUE,
    status           text NOT NULL,
    started_at       timestamptz,
    ending_at        timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT subscriptions_status_valid
        CHECK (status IN ('pending', 'active', 'suspended', 'terminated', 'expired'))
);

-- A customer can have at most one live subscription. Without this, a retried
-- subscription-creation call would leave two active rows and the tier check
-- would be ambiguous about which one is real.
CREATE UNIQUE INDEX subscriptions_one_live_per_account
    ON subscriptions (account_id)
    WHERE status IN ('pending', 'active');

CREATE INDEX subscriptions_account_id_idx ON subscriptions (account_id);

-- Invoices mirrored from Lago. This is a read model for the customer's billing
-- history, not a place we compute money: Lago owns the amounts.
CREATE TABLE invoices (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        uuid NOT NULL REFERENCES tenants(id),
    account_id       uuid NOT NULL REFERENCES accounts(id),
    subscription_id  uuid REFERENCES subscriptions(id),
    lago_external_id text NOT NULL UNIQUE,
    number           text,
    status           text NOT NULL,
    amount_cents     bigint NOT NULL,
    currency         text NOT NULL,
    issued_at        timestamptz,
    paid_at          timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT invoices_status_valid
        CHECK (status IN ('draft', 'open', 'paid', 'voided', 'uncollectible')),
    CONSTRAINT invoices_amount_non_negative CHECK (amount_cents >= 0),
    CONSTRAINT invoices_currency_shape CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE INDEX invoices_account_id_idx ON invoices (account_id, created_at DESC);

-- Processed Lago webhook deliveries, keyed by Lago's own X-Lago-Unique-Key.
-- This is not a nicety: Lago's HMAC signature covers the raw body with NO
-- timestamp, so a captured request can be replayed verbatim forever and the
-- signature will still verify. The unique key is Lago's documented
-- single-processing guarantee, and this table is what makes it real - a replay
-- would otherwise re-apply a subscription activation (or re-bill a customer)
-- however many times it was sent.
CREATE TABLE billing_webhook_receipts (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    unique_key     text NOT NULL UNIQUE,
    webhook_type   text NOT NULL,
    received_at    timestamptz NOT NULL DEFAULT now(),
    applied        boolean NOT NULL DEFAULT true
);

CREATE INDEX billing_webhook_receipts_received_at_idx
    ON billing_webhook_receipts (received_at DESC);

COMMIT;
