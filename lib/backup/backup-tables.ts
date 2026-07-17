/**
 * lib/backup/backup-tables.ts
 *
 * Welke tabellen de platform-backup meeneemt, en in welke volgorde.
 *
 * ─── Waarom dit hier staat en niet in de route ───────────────────────────────
 *
 *   Deze lijst begon als een const in app/api/admin/backup/route.ts, en de
 *   restore-route importeerde hem daar vandaan. Dat compileert niet: een
 *   route-bestand mag alleen HTTP-methodes en Next's eigen config exporteren —
 *   Next controleert dat in .next/types en geeft TS2344.
 *
 *   (Dezelfde regel waar app/api/webhooks/cms/storyblok/route.ts een uur eerder
 *   op struikelde. Ik haalde daar een re-export weg en zette er meteen zelf een
 *   terug in een andere route. Vandaar dit bestand: gedeelde data hoort niet in
 *   een route te wonen, ook niet als het toevallig zou compileren.)
 *
 *   Eén lijst, geïmporteerd door zowel backup als restore. Twee kopieën drijven
 *   uit elkaar, en dan herstelt een restore net die tabellen niet die de backup
 *   wel meenam.
 */

// ─── Wat hier wel en niet in hoort ───────────────────────────────────────────
//
// Eén vraag bepaalt de lijst: **wat moet je met de hand terugbouwen als het weg
// is?** Configuratie dus, geen geschiedenis. `served_variants` (76.920 rijen) en
// `ai_decision_logs` (60.691) zijn waardevol maar reconstrueerbaar noch
// herbouwbaar — dat is telemetrie, en het zou deze JSON-blob onbruikbaar groot
// maken. Wil je die bewaren, gebruik dan een echte pg_dump.
//
// Deze lijst dekte tot 17 juli 2026 dertien tabellen, waarvan er twee niet
// bestonden: "tenants" en "scoring_rules". De lus hieronder slaat ontbrekende
// tabellen stil over, dus die twee deden al niets — en niemand zei het.
// "scoring_rules" was vrijwel zeker `behavior_scoring_rules` bedoeld: 74 rijen
// scoringsregels die niemand in een backup had.
//
// De volgorde is bewust: de restore werkt hem van boven naar beneden af, dus
// verwijzingen komen na waar ze naar wijzen.
export const BACKUP_TABLES = [
  // ── Platform ───────────────────────────────────────────────────────────────
  "platform_settings",
  "admin_users",
  "admin_user_tenants",       // wie bij welke tenant mag — stond er niet in
  "billing_defaults",
  "billing_plans",
  "credit_pricing",
  "enrichment_pricing",
  "decay_profiles",
  "interest_profiles",        // de catalogus
  "behavior_scoring_rules",   // 74 rijen — de "scoring_rules"-spook
  "behavior_sequence_patterns",
  "site_types",
  "theme_presets",
  "page_templates",
  "site_blueprints",
  "context_variable_metadata",
  "platform_cms_content",
  "agency_branding",
  "agency_memberships",

  // ── Tenant-configuratie ────────────────────────────────────────────────────
  "tenant_settings",
  "tenant_sites",
  "tenant_site_setup",
  "tenant_domains",
  "tenant_email_transport",
  "tenant_form_settings",
  "tenant_form_overrides",
  "tenant_search_settings",
  "tenant_dunning_settings",
  "tenant_pipeline_stages",
  "tenant_interest_profiles",
  "tenant_assets",            // metadata; de bestanden zelf staan in Storage — zie hieronder
  "audience_segments",
  "adaptive_blocks",          // 59 blokken, met de hand geschreven
  "rules_config",
  "pages",
  "navigation",
  "site_navigation",
  "abm_settings",
  "ad_sync_settings",
  "demo_instances",

  // ── Geld ───────────────────────────────────────────────────────────────────
  //
  // Saldi zonder hun ledger zijn een getal zonder verantwoording. Beide, of geen
  // van beide. wallet_ledger is 3.717 rijen — groot voor deze lijst, maar het is
  // de enige plek waar staat waarom een saldo is wat het is.
  "subscriptions",
  "tenant_wallets",
  "wallet_ledger",
  "credit_balance",
  "credit_transactions",
  "session_credit_balances",
  "session_credit_ledger",
  "wallet_webhook_events",    // idempotentie: voorkomt dubbel verwerken van Stripe-events

  // ── Wat je juridisch niet kwijt mag ────────────────────────────────────────
  //
  // lead_suppressions zijn opt-outs. Die kwijtraken betekent mensen mailen die
  // gezegd hebben dat niet te willen. Dat is geen ongemak maar een AVG-probleem,
  // en het staat hier bovenaan de "waarom" ook al is de tabel nu leeg.
  "lead_suppressions",
  "abm_leads",                // eigen outreach-lijst, met de hand opgebouwd
  "form_submissions",         // binnengekomen leads

  // ── Experimenten ───────────────────────────────────────────────────────────
  //
  // De definities wel, de toewijzingen niet: plan_experiment_assignments (201) en
  // experiment_assignments (19) zijn afgeleid van een sessie-hash en groeien
  // ongelimiteerd.
  "experiments",
  "plan_experiments",
] as const;

// ─── Wat er bewust NIET in zit ───────────────────────────────────────────────
//
//   Telemetrie / geschiedenis — reconstrueert zichzelf niet, maar is ook geen
//   configuratie, en samen goed voor ~200.000 rijen:
//     served_variants 76.920 · ai_decision_logs 60.691 · usage_events 12.703
//     visitor_journey_events 10.767 · events 6.977 · sessions 1.711
//     personalization_sessions 1.514 · visitor_events 930 · abm_lead_visits 11
//     ad_conversion_events 9 · ad_sync_runs 2
//
//   Afgeleide staat — herberekent zichzelf uit het bovenstaande:
//     visitor_behavior_state 1.357 · visitor_profiles 517 · visitor_history
//     ad_sync_audience_members · enrichment_usage
//
//   Caches en debug — weggooien is de bedoeling:
//     rate_limit_counters 41.564 · billing_request_debug_events 6.672
//     statamic_drafts 1.012 · tenant_site_settings_cache
//     tenant_host_resolution_cache · webhook_deliveries · wallet_reload_attempts
//
//   Meta — hoort niet in zijn eigen backup:
//     _migrations · platform_backups · pending_trial_signups (verlopen vanzelf)
//
//   Dood — staan in productie, maar geen regel code raakt ze aan (17 juli 2026):
//     enrichment_price_cards · interest_profile_tags · runtime_rules
//
//   Deze drie stonden hier eerst wél in. Dat was een fout van mijn kant: ik heb
//   de tabellenlijst uit de database gehaald en niet gecontroleerd of de code ze
//   nog gebruikt. Ze zijn opvolgers-zonder-opruiming — `enrichment_price_cards`
//   is vervangen door `enrichment_pricing` (7 queries, migratie 072), de andere
//   twee zijn leeg. Ze worden door geen enkele migratie aangemaakt en horen ook
//   niet in een backup: dan herstel je dood schema terug.
//
//   Ze staan er nog wel. Droppen is een aparte beslissing.
//
// ─── Twee dingen die deze backup NIET dekt ───────────────────────────────────
//
//   1. tenant_assets bevat metadata; de bestanden staan in Supabase Storage
//      (bucket tenant-assets, 200 MB limiet). Een restore geeft je de rijen
//      terug en dode links naar de bestanden.
//   2. Je Statamic-content staat in een aparte repo, niet in Postgres. Deze
//      backup dekt het platform, niet de sites.
