-- One row per subscription period charged on a Mollie mandate (Mollie step 3).
--
-- The row is claimed before anything is sent to Mollie, keyed on the tenant
-- and the period that ended. A second run of the renewal job finds it and
-- does not charge again. Its status follows the payment:
--
--   creating   claimed, Mollie has not answered yet
--   pending    Mollie accepted the charge, the bank has not confirmed (a
--              direct debit takes working days); the period has moved on
--   paid       the money is in
--   failed     refused, or reversed by the payer; the tenant is past due
--
-- Only the service role reads and writes this table. Row level security is on
-- and has no policy, so the public keys see nothing.

create table if not exists mollie_renewals (
  tenant_id       text        not null,
  period_end      timestamptz not null,           -- the end of the period this charge renews
  payment_id      text,                           -- tr_..., null until Mollie answered
  amount_cents    integer     not null check (amount_cents > 0),
  plan            text        not null,
  cycle           text        not null,
  status          text        not null default 'creating'
                              check (status in ('creating', 'pending', 'paid', 'failed')),
  period_advanced boolean     not null default false,   -- the subscription period moved on for this charge
  problem         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  settled_at      timestamptz,
  primary key (tenant_id, period_end)
);

create unique index if not exists mollie_renewals_payment_uidx on mollie_renewals (payment_id) where payment_id is not null;

alter table mollie_renewals enable row level security;
