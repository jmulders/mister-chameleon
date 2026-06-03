-- Add tenant_id to form_submissions for multi-tenant scoping
ALTER TABLE form_submissions
  ADD COLUMN IF NOT EXISTS tenant_id text NULL;

CREATE INDEX IF NOT EXISTS idx_form_submissions_tenant_id
  ON form_submissions (tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_form_submissions_tenant_created
  ON form_submissions (tenant_id, created_at DESC)
  WHERE tenant_id IS NOT NULL;
