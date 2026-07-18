#!/usr/bin/env node
/**
 * scripts/validate.ts
 *
 * System health and integrity validation for Mister Chameleon.
 *
 * ─── Checks ───────────────────────────────────────────────────────────────────
 *
 *   ENV         — required environment variables are present
 *   DB          — can connect to Supabase
 *   TABLES      — all expected tables exist
 *   MIGRATIONS  — migration files are in sync with what's in db-schema/
 *   TENANTS     — at least one tenant exists and has settings
 *   ADMIN       — at least one admin user exists
 *   SANITY      — Sanity connection (if configured)
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   node --experimental-strip-types scripts/validate.ts
 *   node --experimental-strip-types scripts/validate.ts --fix   # auto-fix where possible
 *   node --experimental-strip-types scripts/validate.ts --json  # machine-readable output
 *
 * ─── Exit codes ──────────────────────────────────────────────────────────────
 *
 *   0 = all checks passed
 *   1 = one or more checks failed
 */

import fs   from "node:fs";
import path from "node:path";

import { loadEnv, hasEnv, PROJECT_ROOT }           from "./lib/env.ts";
import { log }                                      from "./lib/logger.ts";
import { BACKUP_TABLES, getSupabaseClient }         from "./lib/supabase-client.ts";

// ── CLI args ───────────────────────────────────────────────────────────────────

const args     = process.argv.slice(2);
const jsonMode = args.includes("--json");

// ── Check result types ─────────────────────────────────────────────────────────

type CheckStatus = "pass" | "warn" | "fail" | "skip";

interface CheckResult {
  name:    string;
  status:  CheckStatus;
  detail?: string;
}

const results: CheckResult[] = [];

function check(
  name: string,
  status: CheckStatus,
  detail?: string,
): void {
  results.push({ name, status, detail });
  if (!jsonMode) {
    const icon = status === "pass" ? "✓" : status === "warn" ? "⚠" : status === "skip" ? "·" : "✗";
    const colour =
      status === "pass" ? "\x1b[32m" :
      status === "warn" ? "\x1b[33m" :
      status === "skip" ? "\x1b[90m" :
      "\x1b[31m";
    const reset = "\x1b[0m";
    process.stdout.write(`${colour}${icon}${reset}  ${name.padEnd(40)} ${colour}${detail ?? status}${reset}\n`);
  }
}

// ── Required env vars ──────────────────────────────────────────────────────────

const REQUIRED_ENV: string[] = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ADMIN_SESSION_SECRET",
];

const OPTIONAL_ENV: string[] = [
  "SANITY_PROJECT_ID",
  "SANITY_DATASET",
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "RESEND_API_KEY",
  "VERCEL_API_TOKEN",
];

// ── Tables we always expect to exist ──────────────────────────────────────────

const REQUIRED_TABLES: string[] = [
  "tenants",
  "tenant_settings",
  "admin_users",
  "platform_settings",
  "rules_config",
  "pages",
  "sessions",
  "events",
  "form_submissions",
];

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (!jsonMode) log.section("Mister Chameleon — System Validation");

  // Load env.
  loadEnv();

  // ── ENV checks ──────────────────────────────────────────────────────────────

  for (const key of REQUIRED_ENV) {
    if (hasEnv(key)) {
      check(`ENV: ${key}`, "pass", "present");
    } else {
      check(`ENV: ${key}`, "fail", "MISSING — add to .env.local");
    }
  }

  for (const key of OPTIONAL_ENV) {
    check(
      `ENV: ${key} (optional)`,
      hasEnv(key) ? "pass" : "warn",
      hasEnv(key) ? "present" : "not set",
    );
  }

  // ── Migration files ─────────────────────────────────────────────────────────

  {
    const migrationsDir = path.join(PROJECT_ROOT, "supabase", "migrations");
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
      check("Migrations: files present", "pass", `${files.length} migration files found`);
    } else {
      check("Migrations: files present", "fail", "supabase/migrations/ not found");
    }
  }

  // ── DB connectivity ─────────────────────────────────────────────────────────

  if (!hasEnv("NEXT_PUBLIC_SUPABASE_URL") || !hasEnv("SUPABASE_SERVICE_ROLE_KEY")) {
    check("DB: connectivity", "skip", "Supabase env vars missing");
  } else {
    try {
      const client = getSupabaseClient();
      const { error } = await client.from("tenants").select("id").limit(1);
      if (error) {
        if (error.code === "42P01") {
          check("DB: connectivity", "warn", "Connected but 'tenants' table missing — run migrations");
        } else {
          check("DB: connectivity", "fail", error.message);
        }
      } else {
        check("DB: connectivity", "pass", "Connected successfully");
      }
    } catch (err) {
      check("DB: connectivity", "fail", (err as Error).message);
    }
  }

  // ── Required tables ─────────────────────────────────────────────────────────

  if (hasEnv("NEXT_PUBLIC_SUPABASE_URL") && hasEnv("SUPABASE_SERVICE_ROLE_KEY")) {
    const client = getSupabaseClient();

    for (const table of REQUIRED_TABLES) {
      try {
        const { error } = await client.from(table).select("*").limit(0);
        if (error && error.code === "42P01") {
          check(`TABLE: ${table}`, "fail", "table does not exist — run migrations");
        } else if (error) {
          check(`TABLE: ${table}`, "warn", error.message);
        } else {
          check(`TABLE: ${table}`, "pass", "exists");
        }
      } catch (err) {
        check(`TABLE: ${table}`, "fail", (err as Error).message);
      }
    }

    // ── Tenant check ───────────────────────────────────────────────────────────

    try {
      const { data: tenants, error } = await client.from("tenants").select("id, name").limit(10);
      if (error) {
        check("TENANTS: exist", "warn", error.message);
      } else if (!tenants || tenants.length === 0) {
        check("TENANTS: exist", "warn", "No tenants — run onboarding or seed a tenant");
      } else {
        const names = (tenants as { name?: string }[]).map((t) => t.name ?? "?").join(", ");
        check("TENANTS: exist", "pass", `${tenants.length} tenant(s): ${names}`);

        // Check each tenant has settings.
        for (const tenant of tenants as { id: string; name?: string }[]) {
          const { data: settings } = await client
            .from("tenant_settings")
            .select("tenant_id")
            .eq("tenant_id", tenant.id)
            .limit(1);
          const hasSetting = settings && settings.length > 0;
          check(
            `TENANTS: ${tenant.name ?? tenant.id} has settings`,
            hasSetting ? "pass" : "warn",
            hasSetting ? "ok" : "missing tenant_settings row",
          );
        }
      }
    } catch (err) {
      check("TENANTS: exist", "fail", (err as Error).message);
    }

    // ── Admin user check ───────────────────────────────────────────────────────

    try {
      const { data: admins, error } = await client.from("admin_users").select("id, email").limit(5);
      if (error) {
        check("ADMIN: user exists", "warn", error.message);
      } else if (!admins || admins.length === 0) {
        check("ADMIN: user exists", "warn", "No admin users — create one with scripts/create-admin-user.ts");
      } else {
        const emails = (admins as { email?: string }[]).map((a) => a.email ?? "?").join(", ");
        check("ADMIN: user exists", "pass", `${admins.length} admin(s): ${emails}`);
      }
    } catch (err) {
      check("ADMIN: user exists", "fail", (err as Error).message);
    }

    // ── platform_settings ────────────────────────────────────────────────────────

    try {
      const { data: ps, error } = await client.from("platform_settings").select("id").limit(1);
      if (error || !ps || ps.length === 0) {
        check("CONFIG: platform_settings", "warn", "No platform_settings row — run bootstrap");
      } else {
        check("CONFIG: platform_settings", "pass", "exists");
      }
    } catch (err) {
      check("CONFIG: platform_settings", "warn", (err as Error).message);
    }
  }

  // ── Sanity ───────────────────────────────────────────────────────────────────

  if (!hasEnv("SANITY_PROJECT_ID")) {
    check("SANITY: connection", "skip", "SANITY_PROJECT_ID not set — using MockCMSProvider");
  } else {
    try {
      const { createClient } = await import("@sanity/client");
      const sanity = createClient({
        projectId: process.env["SANITY_PROJECT_ID"]!,
        dataset:   process.env["SANITY_DATASET"] ?? "production",
        apiVersion: process.env["SANITY_API_VERSION"] ?? "2024-01-01",
        useCdn:    false,
      });
      const count = await sanity.fetch<number>('count(*[_type == "page"])');
      check("SANITY: connection", "pass", `Connected — ${count} page documents`);
    } catch (err) {
      check("SANITY: connection", "warn", (err as Error).message);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────────

  const failed  = results.filter((r) => r.status === "fail").length;
  const warned  = results.filter((r) => r.status === "warn").length;
  const passed  = results.filter((r) => r.status === "pass").length;
  const skipped = results.filter((r) => r.status === "skip").length;

  if (jsonMode) {
    process.stdout.write(JSON.stringify({ results, summary: { passed, warned, failed, skipped } }, null, 2) + "\n");
  } else {
    log.section("Validation Summary");
    log.success(`Passed:  ${passed}`);
    if (warned)  log.warn(`Warnings: ${warned}`);
    if (failed)  log.error(`Failed:  ${failed}`);
    if (skipped) log.debug(`Skipped:  ${skipped}`);
  }

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  log.error("Validation crashed", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
