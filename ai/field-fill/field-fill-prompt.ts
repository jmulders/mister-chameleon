/**
 * AI Field Fill — Prompt Builder
 *
 * Builds the system prompt and user message for one AI field fill call.
 *
 * ─── Prompt design ────────────────────────────────────────────────────────────
 *
 *   System message:
 *     • Defines the AI's role as a content personalisation assistant
 *     • States the conversion goal, audience, and tone preset
 *     • Enumerates allowed fields with their constraints and current values
 *     • Specifies the exact JSON output schema
 *     • Instructs AI to include a confidence score
 *
 *   User message:
 *     • Visitor context signals ("you are writing for a visitor who…")
 *     • Explicit instruction to rewrite only the listed fields
 *
 * ─── Output contract ──────────────────────────────────────────────────────────
 *
 *   The AI must return ONLY a JSON object matching:
 *
 *     {
 *       "fields": { "<fieldPath>": "<plain text value>", … },
 *       "confidence": 0.87
 *     }
 *
 *   No markdown, no extra keys, no HTML.  The validator enforces this.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   No PII, no session IDs, no internal variant keys appear in the prompt.
 *   matchedContexts and audienceHints are pre-sanitised by the caller.
 */

import type { FieldFillInput } from "./types";

// ── Public types ──────────────────────────────────────────────────────────────

/** The two-message prompt passed to the AI field fill model call. */
export interface FieldFillPrompt {
  systemMessage: string;
  userMessage:   string;
}

// ── Public function ───────────────────────────────────────────────────────────

/**
 * Build the system + user prompt for an AI field fill call.
 *
 * @param input  The fully assembled FieldFillInput for this slot.
 * @returns      A two-message prompt ready for the AI model.
 */
export function buildFieldFillPrompt(input: FieldFillInput): FieldFillPrompt {
  const systemMessage = buildSystemMessage(input);
  const userMessage   = buildUserMessage(input);
  return { systemMessage, userMessage };
}

// ── System message ────────────────────────────────────────────────────────────

function buildSystemMessage(input: FieldFillInput): string {
  const fieldInstructions = buildFieldInstructions(input);

  return `You are a conversion-focused content personalisation assistant for a B2B SaaS homepage.

Your task is to rewrite specific text fields in a ${input.slotType} section to better resonate with the current visitor, without changing the section's structure or purpose.

CONVERSION GOAL: ${input.goal}
TONE: ${input.tonePreset}

${fieldInstructions}

OUTPUT FORMAT — respond with ONLY a JSON object, no markdown, no explanation:
{
  "fields": {
    "<fieldPath>": "<rewritten plain text>",
    ...
  },
  "confidence": <number between 0.0 and 1.0>
}

RULES:
- Only include fields from the allowed list above
- Plain text only — no HTML, no markdown, no special characters except punctuation
- Do not add quotation marks around field values unless they are part of the content
- Do not add fields that are not in the allowed list
- Set confidence to reflect how well your rewrites fit the visitor context (0.0 = guessing, 1.0 = highly confident)
- If you cannot improve a field meaningfully, keep the original value for that field`;
}

function buildFieldInstructions(input: FieldFillInput): string {
  const lines: string[] = ["FIELDS TO REWRITE:"];

  for (const [fieldPath, spec] of Object.entries(input.allowedFields)) {
    const original  = input.fallbackContent[fieldPath] ?? "(no original value)";
    const limits: string[] = [];

    if (spec.maxWords)  limits.push(`max ${spec.maxWords} words`);
    if (spec.maxChars)  limits.push(`max ${spec.maxChars} characters`);
    if (spec.style)     limits.push(`style: ${spec.style}`);

    const constraintStr = limits.length > 0 ? ` [${limits.join(", ")}]` : "";

    lines.push(`  "${fieldPath}"${constraintStr}`);
    lines.push(`    Original: ${original}`);
  }

  return lines.join("\n");
}

// ── User message ──────────────────────────────────────────────────────────────

function buildUserMessage(input: FieldFillInput): string {
  const contextLines = input.matchedContexts.length > 0
    ? input.matchedContexts.map((c) => `  - ${c}`).join("\n")
    : "  - (no specific context signals)";

  const audienceLines = input.audienceHints.length > 0
    ? input.audienceHints.map((h) => `  - ${h}`).join("\n")
    : "  - general B2B audience";

  return `You are writing for a visitor with the following context:
${contextLines}

Audience description:
${audienceLines}

Rewrite the listed fields to speak directly to this visitor's needs and intent. Keep rewrites within the specified constraints. Return only the JSON object.`;
}
