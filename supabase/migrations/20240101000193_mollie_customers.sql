-- The Mollie customer of a tenant, and the mandate it gave (Mollie step 2).
--
-- A mandate is the tenant's authorisation to charge them again without them
-- being there. Mollie keeps it on a customer object. The platform keeps the
-- pair of ids, per mode: a test key and a live key see different customers.
--
-- Only the service role reads and writes this table. Row level security is on
-- and has no policy, so the public keys see nothing.

create table if not exists mollie_customers (
  tenant_id      text        not null,
  mode           text        not null check (mode in ('test', 'live')),
  customer_id    text        not null,             -- cst_...
  mandate_id     text,                             -- mdt_..., null until a first payment is paid
  mandate_method text,                             -- the method of that first payment: ideal, creditcard, ...
  mandate_since  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (tenant_id, mode)
);

create unique index if not exists mollie_customers_customer_uidx on mollie_customers (customer_id);

alter table mollie_customers enable row level security;
