/**
 * AI Copy Generator — draft form and email variant copy from a short brief.
 *
 * Companion to ai/variant-generator.ts (which drafts hero/proof/cta blocks).
 * This module points the model at the two newest variant surfaces: contextual
 * forms and adaptive emails. It only produces a validated DRAFT — the human
 * review gate is the editor, which pre-fills the fields and lets the operator
 * edit before saving.
 *
 * Same provider and env as the block generator (ANTHROPIC_API_KEY / CLAUDE_MODEL).
 */

import "server-only";

import type { VariantTone } from "@/ai/variant-meta";

export interface CopyBrief {
  /** Free-text audience, or filled from a segment / persona. */
  audience:   string;
  tone?:      VariantTone;
  /** Tenant brand voice / do's and don'ts, injected into the system prompt. */
  brandNote?: string;
}

export interface FormCopy {
  title:          string;
  intro:          string;
  submitLabel:    string;
  successMessage: string;
}

export interface EmailCopy {
  subject:   string;
  preheader: string;
}

type CopyResult<T> = { ok: true; copy: T } | { ok: false; error: string };

// ── Model call (mirrors ai/variant-generator.ts) ─────────────────────────────

async function callModelJson(system: string, user: string): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: "AI is not configured (ANTHROPIC_API_KEY missing)." };
  const model = process.env.CLAUDE_MODEL ?? "claude-3-5-haiku-20241022";

  let text: string;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 700, system, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) return { ok: false, error: `Model API error ${res.status}.` };
    const json = await res.json() as { content?: Array<{ text?: string }> };
    text = json.content?.[0]?.text ?? "";
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Model call failed." };
  }

  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end   = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return { ok: false, error: "Model did not return JSON." };
  try {
    return { ok: true, value: JSON.parse(cleaned.slice(start, end + 1)) };
  } catch {
    return { ok: false, error: "Could not parse model JSON." };
  }
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function briefLines(brief: CopyBrief): string {
  return [
    `Audience: ${brief.audience}`,
    brief.tone      ? `Tone: ${brief.tone}` : "",
    brief.brandNote ? `Brand voice: ${brief.brandNote}` : "",
  ].filter(Boolean).join("\n");
}

// ── Form copy ─────────────────────────────────────────────────────────────────

export async function generateFormCopy(
  brief: CopyBrief & { formType: string },
): Promise<CopyResult<FormCopy>> {
  const system = [
    `You write copy for ONE ${brief.formType} web form on a B2B website.`,
    "Return ONLY a strict JSON object, no prose, no markdown fences, of the shape:",
    `{ "title": string, "intro": string, "submitLabel": string, "successMessage": string }`,
    "title is a short heading. intro is one benefit-led sentence. submitLabel is 1-3 words.",
    "successMessage is the confirmation shown after submitting. Keep it concise and on-brand.",
  ].join("\n");

  const res = await callModelJson(system, briefLines(brief));
  if (!res.ok) return res;
  const d = res.value as Record<string, unknown>;
  const copy: FormCopy = {
    title:          str(d.title),
    intro:          str(d.intro),
    submitLabel:    str(d.submitLabel),
    successMessage: str(d.successMessage),
  };
  if (!copy.title && !copy.intro) return { ok: false, error: "Model returned empty copy." };
  return { ok: true, copy };
}

// ── Email copy ────────────────────────────────────────────────────────────────

export async function generateEmailCopy(
  brief: CopyBrief & { templateLabel: string },
): Promise<CopyResult<EmailCopy>> {
  const system = [
    `You write ONE subject line and inbox preview for a B2B follow-up email (${brief.templateLabel}).`,
    "Return ONLY a strict JSON object, no prose, no markdown fences, of the shape:",
    `{ "subject": string, "preheader": string }`,
    "You may use the placeholders {name} and {company}. Keep the subject under about 55 characters.",
    "Avoid clickbait. Sound like a person, on-brand.",
  ].join("\n");

  const res = await callModelJson(system, briefLines(brief));
  if (!res.ok) return res;
  const d = res.value as Record<string, unknown>;
  const copy: EmailCopy = { subject: str(d.subject), preheader: str(d.preheader) };
  if (!copy.subject) return { ok: false, error: "Model returned empty copy." };
  return { ok: true, copy };
}
