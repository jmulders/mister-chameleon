-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 106: subscription dunning
--
-- Adds dunning lifecycle columns to the `subscriptions` table and creates the
-- `tenant_dunning_settings` table for per-tenant payment-due email configuration.
--
-- ─── subscriptions additions ─────────────────────────────────────────────────
--
--   payment_due_since      — set when subscription first becomes past_due;
--                            cleared when payment is received.
--   dunning_email_sent_at  — set when the payment-due email has been dispatched;
--                            prevents duplicate sends on every cron run.
--
-- ─── tenant_dunning_settings ─────────────────────────────────────────────────
--
--   One row per tenant (optional — defaults are used when absent).
--
--   email_subject        — subject line for the payment-due email.
--   email_body           — plain-text body template.  Supported placeholders:
--                            {{tenant_name}}       name from tenant_settings
--                            {{plan_name}}         e.g. "Growth"
--                            {{amount}}            formatted amount e.g. "€ 349,00"
--                            {{due_date}}          ISO date the period expired
--                            {{quarantine_end}}    ISO date service stops (due + 8 days)
--                            {{payment_link}}      optional link set by the admin
--   billing_email        — recipient override; falls back to tenant contact email.
--   quarantine_days      — days between past_due and full service suspension (default 8).
--   payment_link         — optional URL to a payment page, injected into template.
--
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Add dunning columns to subscriptions ──────────────────────────────────

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS payment_due_since     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dunning_email_sent_at TIMESTAMPTZ;

-- ── 2. Create tenant_dunning_settings ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenant_dunning_settings (
  tenant_id     TEXT        PRIMARY KEY REFERENCES tenant_settings (tenant_id) ON DELETE CASCADE,

  email_subject TEXT        NOT NULL DEFAULT 'Your subscription payment is due',
  email_body    TEXT        NOT NULL DEFAULT
    'Hi,

Your subscription to {{plan_name}} is now past due. The amount of {{amount}} was due on {{due_date}}.

To avoid service interruption, please arrange payment before {{quarantine_end}}.

After that date, personalisation will be suspended until payment is received.

{{payment_link}}

If you have any questions, please reply to this email.

Best regards,
The Mister Chameleon team',

  -- Optional recipient override (falls back to tenant contact / wallet notification email).
  billing_email TEXT,

  -- Days between becoming past_due and content being blocked entirely (default 8).
  quarantine_days INT NOT NULL DEFAULT 8 CHECK (quarantine_days >= 1 AND quarantine_days <= 90),

  -- Optional URL to include in the email body via {{payment_link}}.
  payment_link  TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. Auto-update trigger ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_tenant_dunning_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_dunning_settings_updated_at ON tenant_dunning_settings;
CREATE TRIGGER trg_tenant_dunning_settings_updated_at
  BEFORE UPDATE ON tenant_dunning_settings
  FOR EACH ROW EXECUTE FUNCTION update_tenant_dunning_settings_updated_at();

-- ── 4. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE tenant_dunning_settings ENABLE ROW LEVEL SECURITY;

-- Service role (used by server actions and cron) has full access via RLS bypass.
-- No public policies — admin UI accesses this table exclusively via service-role client.
