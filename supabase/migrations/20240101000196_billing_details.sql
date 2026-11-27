-- Who to invoice, where they are, and their VAT number (Mollie step 5).
--
-- The country and the VAT number decide the VAT of every charge. The name
-- and the address go on the invoice. One row per tenant. A tenant without a
-- row is treated as a Dutch customer.
--
-- Only the service role reads and writes this table. Row level security is on
-- and has no policy, so the public keys see nothing.

create table if not exists billing_details (
  tenant_id     text        primary key,
  company_name  text,
  address_line  text,
  postal_code   text,
  city          text,
  country       text        not null default 'NL' check (country ~ '^[A-Z]{2}$'),
  vat_number    text,
  invoice_email text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table billing_details enable row level security;

-- The trial form asks for the country and the VAT number, so the first charge
-- after the trial already has the right VAT.
alter table pending_trial_signups add column if not exists country    text;
alter table pending_trial_signups add column if not exists vat_number text;
