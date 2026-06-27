"use server";

/**
 * Tenant Workspace › ABM — Server Actions
 *
 * Manage account-based-marketing personalized-URL leads (the `abm_leads` table):
 * CRUD + a Sales Navigator CSV import. See docs/abm-personalized-urls.md.
 */

import { revalidatePath }          from "next/cache";
import { randomBytes }             from "node:crypto";
import { getRequiredAdminSession } from "@/lib/admin-auth/authorization";
import {
  listAbmLeads,
  upsertAbmLead,
  deleteAbmLead,
  type AbmLead,
  type AbmLeadProfile,
  type AbmLeadStatus,
}                                  from "@/lib/abm/abm-store";

/** Short, URL-safe, unguessable identifier (~8 chars). */
function genIdentifier(): string {
  return randomBytes(6).toString("base64url");
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function listAbmLeadsAction(tenantId: string): Promise<AbmLead[]> {
  await getRequiredAdminSession();
  return listAbmLeads(tenantId);
}

// ── Save ──────────────────────────────────────────────────────────────────────

export interface SaveAbmLeadInput {
  id?:          string;
  identifier?:  string;
  vanityPath?:  string;
  targetPath:   string;
  profile:      AbmLeadProfile;
  segmentHint?: string;
  status?:      AbmLeadStatus;
  expiresAt?:   string | null;
}

export async function saveAbmLeadAction(
  tenantId: string,
  input:    SaveAbmLeadInput,
): Promise<{ ok: true; lead: AbmLead } | { ok: false; error: string }> {
  await getRequiredAdminSession();

  const target = input.targetPath.trim() || "/";
  if (!target.startsWith("/")) return { ok: false, error: "Target page must start with /." };

  // Normalize the vanity path to always carry a leading slash, so the [slug]
  // route (which looks it up as `/${slug}`) matches regardless of how it was typed.
  const vanityRaw  = input.vanityPath?.trim();
  const vanityPath = vanityRaw ? (vanityRaw.startsWith("/") ? vanityRaw : `/${vanityRaw}`) : null;

  const lead = await upsertAbmLead({
    id:          input.id,
    tenantId,
    identifier:  input.identifier?.trim() || genIdentifier(),
    vanityPath,
    targetPath:  target,
    profile:     input.profile,
    segmentHint: input.segmentHint?.trim() || null,
    status:      input.status ?? "active",
    expiresAt:   input.expiresAt || null,
  });
  if (!lead) return { ok: false, error: "Save failed." };

  revalidatePath(`/admin/tenants/${tenantId}/abm`);
  return { ok: true, lead };
}

export async function deleteAbmLeadAction(
  tenantId: string,
  id:       string,
): Promise<{ ok: boolean }> {
  await getRequiredAdminSession();
  const ok = await deleteAbmLead(id);
  revalidatePath(`/admin/tenants/${tenantId}/abm`);
  return { ok };
}

// ── CSV import (Sales Navigator) ────────────────────────────────────────────────

export interface ImportResult {
  created: number;
  errors:  string[];
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false;
      } else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^﻿/, "").trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  return lines.slice(1).filter((l) => l.trim()).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (cells[i] ?? "").trim(); });
    return row;
  });
}

/** Read the first matching header (case-insensitive). */
function pick(row: Record<string, string>, ...candidates: string[]): string | undefined {
  for (const c of candidates) {
    const v = row[c.toLowerCase()];
    if (v) return v;
  }
  return undefined;
}

/**
 * Import leads from pasted CSV (Sales Navigator export or similar). Auto-detects
 * common column names; generates an identifier per row; assigns the shared
 * targetPath. One bad row never aborts the batch.
 */
export async function importAbmLeadsCsvAction(
  tenantId:   string,
  csv:        string,
  targetPath: string,
): Promise<ImportResult> {
  await getRequiredAdminSession();

  const target = targetPath.trim() || "/";
  const rows   = parseCsv(csv);
  const errors: string[] = [];
  let created = 0;

  for (const [idx, row] of rows.entries()) {
    const firstName = pick(row, "first name", "firstname", "voornaam");
    const lastName  = pick(row, "last name", "lastname", "achternaam");
    const company   = pick(row, "company", "company name", "bedrijf", "account name");
    const role      = pick(row, "title", "position", "job title", "role", "functie");
    const industry  = pick(row, "industry", "branche");
    const size      = pick(row, "company size", "employees", "headcount", "bedrijfsgrootte");
    const linkedin  = pick(row, "profile url", "linkedin", "linkedin url", "person linkedin url");

    if (!firstName && !company) {
      errors.push(`Row ${idx + 2}: no first name or company — skipped.`);
      continue;
    }

    const profile: AbmLeadProfile = {
      ...(firstName ? { firstName } : {}),
      ...(firstName || lastName ? { name: [firstName, lastName].filter(Boolean).join(" ") } : {}),
      ...(company  ? { company }  : {}),
      ...(role     ? { role }     : {}),
      ...(industry ? { industry } : {}),
      ...(size     ? { companySize: size } : {}),
      ...(linkedin ? { linkedinUrl: linkedin } : {}),
    };

    const lead = await upsertAbmLead({
      tenantId,
      identifier: genIdentifier(),
      targetPath: target.startsWith("/") ? target : "/",
      profile,
      status:     "active",
    });
    if (lead) created++;
    else errors.push(`Row ${idx + 2}: save failed.`);
  }

  revalidatePath(`/admin/tenants/${tenantId}/abm`);
  return { created, errors };
}
