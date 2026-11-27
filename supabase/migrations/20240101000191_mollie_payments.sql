-- Payments started at Mollie (one-time purchases, step 1 of Mollie next to Stripe).
--
-- Mollie's return address cannot carry the payment id, so the platform keeps
-- its own reference next to the id. The row is also the record of what was
-- started: an abandoned payment stays visible instead of vanishing.
--
-- Only the service role reads and writes this table. Row level security is on
-- and has no policy, so the public keys see nothing.

create table if not exists mollie_payments (
  id           text        primary key,          -- Mollie payment id (tr_...)
  ref          uuid        not null unique,      -- the platform's reference, in the return address
  tenant_id    text        not null,
  kind         text        not null,             -- session_bundle | credit_bundle | wallet_top_up
  bundle_id    text,
  amount_cents integer     not null check (amount_cents > 0),
  mode         text        not null check (mode in ('test', 'live')),
  status       text        not null default 'open',
  problem      text,                             -- why a paid payment was not delivered
  credited_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists mollie_payments_tenant_idx on mollie_payments (tenant_id, created_at desc);

alter table mollie_payments enable row level security;
