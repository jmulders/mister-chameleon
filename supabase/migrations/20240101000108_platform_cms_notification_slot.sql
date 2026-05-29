-- migration: 20240101000108_platform_cms_notification_slot
--
-- Adds "notification" to the variant_type CHECK constraint on
-- platform_cms_content so the platform CMS provider can store and query
-- notification overlay variants alongside the existing slots.

-- Drop old CHECK constraint (Postgres requires drop + re-add for ALTER).
ALTER TABLE public.platform_cms_content
  DROP CONSTRAINT IF EXISTS platform_cms_content_variant_type_check;

-- Add updated CHECK constraint including "notification".
ALTER TABLE public.platform_cms_content
  ADD CONSTRAINT platform_cms_content_variant_type_check
    CHECK (variant_type IN ('hero', 'proof', 'cta', 'feature', 'conversion', 'notification'));
