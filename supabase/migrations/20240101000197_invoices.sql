-- Invoices the platform issues itself (Mollie step 5).
--
-- Stripe wrote the invoices of the subscriptions it managed. For what the
-- platform charges through Mollie it writes them itself. An invoice is a
-- snapshot: the seller, the customer and the amounts as they were when it was
-- issued. A tenant that later moves or changes its VAT number does not change
-- an invoice that already exists.
--
-- The number is a date and a counter: 20261127-0001. The counter never
-- starts again and never skips: it is taken inside the same transaction that
-- writes the invoice, under a lock on the single counter row. An invoice that
-- is not written does not use a number.
--
-- Only the service role reads and writes these tables and calls the function.

create table if not exists invoice_counter (
  id       boolean primary key default true check (id),
  last_seq bigint  not null default 0
);
insert into invoice_counter (id, last_seq) values (true, 0) on conflict (id) do nothing;

create table if not exists invoices (
  id            uuid        primary key default gen_random_uuid(),
  seq           bigint      not null unique,
  number        text        not null unique,       -- YYYYMMDD-0001
  tenant_id     text        not null,
  -- What the invoice is for, once: "payment:tr_..." or "renewal:<tenant>:<period>".
  reference     text        not null unique,
  kind          text        not null,              -- subscription | session_bundle | credit_bundle | wallet_top_up | auto_reload
  description   text        not null,
  net_cents     integer     not null check (net_cents >= 0),
  vat_cents     integer     not null check (vat_cents >= 0),
  gross_cents   integer     not null check (gross_cents = net_cents + vat_cents),
  vat_rate_bp   integer     not null,
  vat_treatment text        not null,
  payment_id    text,
  issued_at     timestamptz not null default now(),
  paid_at       timestamptz,
  customer      jsonb       not null,
  seller        jsonb       not null,
  created_at    timestamptz not null default now()
);

create index if not exists invoices_tenant_idx on invoices (tenant_id, seq desc);

alter table invoice_counter enable row level security;
alter table invoices        enable row level security;

-- Issue an invoice, once per reference.
--
-- Returns the invoice's number and whether this call made it. A second call
-- with the same reference returns the first invoice and uses no number.
create or replace function public.issue_invoice(
  p_tenant_id     text,
  p_reference     text,
  p_kind          text,
  p_description   text,
  p_net_cents     integer,
  p_vat_cents     integer,
  p_vat_rate_bp   integer,
  p_vat_treatment text,
  p_payment_id    text,
  p_paid          boolean,
  p_customer      jsonb,
  p_seller        jsonb
)
returns table (invoice_number text, created boolean)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_existing text;
  v_seq      bigint;
  v_number   text;
begin
  select i.number into v_existing from public.invoices i where i.reference = p_reference;
  if v_existing is not null then
    return query select v_existing, false;
    return;
  end if;

  -- The lock: two invoices at once take their numbers one after the other.
  update public.invoice_counter set last_seq = last_seq + 1 where id returning last_seq into v_seq;

  -- A second caller for the same reference waited on the lock above. It now
  -- sees the first one's invoice and must not write another.
  select i.number into v_existing from public.invoices i where i.reference = p_reference;
  if v_existing is not null then
    update public.invoice_counter set last_seq = last_seq - 1 where id;
    return query select v_existing, false;
    return;
  end if;

  v_number := to_char(now() at time zone 'Europe/Amsterdam', 'YYYYMMDD')
              || '-' || lpad(v_seq::text, greatest(4, length(v_seq::text)), '0');

  insert into public.invoices
    (seq, number, tenant_id, reference, kind, description, net_cents, vat_cents, gross_cents,
     vat_rate_bp, vat_treatment, payment_id, paid_at, customer, seller)
  values
    (v_seq, v_number, p_tenant_id, p_reference, p_kind, p_description, p_net_cents, p_vat_cents,
     p_net_cents + p_vat_cents, p_vat_rate_bp, p_vat_treatment, p_payment_id,
     case when p_paid then now() else null end, p_customer, p_seller);

  return query select v_number, true;
end;
$function$;

revoke all on function public.issue_invoice(text, text, text, text, integer, integer, integer, text, text, boolean, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.issue_invoice(text, text, text, text, integer, integer, integer, text, text, boolean, jsonb, jsonb) to service_role;

-- A subscription charge keeps the amounts and the wording of its invoice.
--
-- The invoice of a period is issued when Mollie accepts the charge. A charge
-- that fails before that has no invoice yet. When the tenant then pays the
-- open amount themselves, the invoice is issued at that moment, from what is
-- kept here.
alter table mollie_renewals add column if not exists net_cents           integer;
alter table mollie_renewals add column if not exists vat_cents           integer;
alter table mollie_renewals add column if not exists vat_rate_bp         integer;
alter table mollie_renewals add column if not exists vat_treatment       text;
alter table mollie_renewals add column if not exists invoice_description text;
