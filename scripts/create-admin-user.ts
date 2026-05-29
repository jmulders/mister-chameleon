#!/usr/bin/env tsx
/**
 * Bootstrap script — create the first admin user.
 *
 * Run with:
 *   npx tsx scripts/create-admin-user.ts
 *
 * The script reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * from the environment (or from .env.local via --env-file if using Node ≥ 20).
 *
 * Example (Node 20+):
 *   node --env-file=.env.local --import=tsx/esm scripts/create-admin-user.ts
 *
 * Or with dotenv-cli:
 *   npx dotenv -e .env.local -- npx tsx scripts/create-admin-user.ts
 *
 * ─── What it does ─────────────────────────────────────────────────────────────
 *
 *   1. Prompts for name, email, and password (hidden input).
 *   2. Validates password strength.
 *   3. Hashes the password with bcrypt (12 rounds).
 *   4. Inserts the row into admin_users via the service-role Supabase client.
 *   5. Prints the created user's ID.
 *
 * ─── Safety ───────────────────────────────────────────────────────────────────
 *
 *   The plaintext password is never logged or stored — only the bcrypt hash.
 */

import { createClient }   from "@supabase/supabase-js";
import bcrypt             from "bcryptjs";
import * as readline      from "readline";

// ── Env ───────────────────────────────────────────────────────────────────────

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "\n[create-admin-user] Missing environment variables.\n" +
      "Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.\n",
  );
  process.exit(1);
}

const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

/**
 * Prompts for a password without echoing characters.
 * Falls back to plain readline if the terminal doesn't support raw mode.
 */
async function promptPassword(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);

    if (process.stdin.isTTY) {
      // Hide input characters
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf8");

      let password = "";
      process.stdin.on("data", function onData(char: string) {
        if (char === "\r" || char === "\n") {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener("data", onData);
          process.stdout.write("\n");
          resolve(password);
        } else if (char === "\u0003") {
          // Ctrl-C
          process.exit(0);
        } else if (char === "\u007f" || char === "\b") {
          // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write("\b \b");
          }
        } else {
          password += char;
          process.stdout.write("*");
        }
      });
    } else {
      // Non-TTY (piped input) — read normally
      const rl = readline.createInterface({ input: process.stdin });
      rl.once("line", (line) => {
        rl.close();
        resolve(line.trim());
      });
    }
  });
}

function validatePasswordStrength(password: string): string | null {
  if (password.length < 12)    return "Password must be at least 12 characters.";
  if (!/[A-Z]/.test(password)) return "Must contain at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Must contain at least one lowercase letter.";
  if (!/\d/.test(password))    return "Must contain at least one digit.";
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout,
  });

  console.log("\n── Create admin user ────────────────────────────────────\n");

  const name  = (await prompt(rl, "Full name:  ")).trim();
  const email = (await prompt(rl, "Email:      ")).trim().toLowerCase();
  rl.close();

  if (!name || !email || !email.includes("@")) {
    console.error("\n[create-admin-user] Name and valid email are required.\n");
    process.exit(1);
  }

  const password = await promptPassword("Password:   ");
  const confirm  = await promptPassword("Confirm:    ");

  if (password !== confirm) {
    console.error("\n[create-admin-user] Passwords do not match.\n");
    process.exit(1);
  }

  const strengthError = validatePasswordStrength(password);
  if (strengthError) {
    console.error(`\n[create-admin-user] ${strengthError}\n`);
    process.exit(1);
  }

  console.log("\nHashing password…");
  const passwordHash = await bcrypt.hash(password, 12);

  console.log("Inserting admin user…");
  const { data, error } = await db
    .from("admin_users")
    .insert({
      email,
      password_hash: passwordHash,
      name,
      // Bootstrap admin is always superadmin — they can access all tenants
      // without rows in admin_user_tenants.
      role: "superadmin",
    })
    .select("id, email, name, role, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      console.error(`\n[create-admin-user] An admin user with email "${email}" already exists.\n`);
    } else {
      console.error(`\n[create-admin-user] Database error: ${error.message}\n`);
    }
    process.exit(1);
  }

  console.log("\n── Admin user created successfully ──────────────────────");
  console.log(`  ID:      ${data.id}`);
  console.log(`  Name:    ${data.name}`);
  console.log(`  Email:   ${data.email}`);
  console.log(`  Role:    ${data.role}`);
  console.log(`  Created: ${data.created_at}`);
  console.log("\nNext steps:");
  console.log("  1. Sign in at /admin/login with the credentials above.");
  console.log("  2. Enable 2FA at /admin/account/security.\n");
}

main().catch((err) => {
  console.error("[create-admin-user] Unexpected error:", err);
  process.exit(1);
});
