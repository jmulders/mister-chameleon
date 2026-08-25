-- Ad-ID capture: add the remaining ad click-ID columns to visitor_profiles.
--
-- gclid (Google) and fbclid (Meta) columns already exist; this adds
-- msclkid (Microsoft Ads) and ttclid (TikTok). All nullable text, populated
-- first-touch and only when the visitor has consented (analytics/personalization),
-- alongside the existing utm_* / referrer_domain attribution fields.

alter table public.visitor_profiles add column if not exists msclkid text;
alter table public.visitor_profiles add column if not exists ttclid  text;
