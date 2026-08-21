/**
 * Context token substitution for body copy.
 *
 * Replaces `{key}` / `{key|default}` tokens in authored copy with the visitor's
 * decision-context value, as a pure pre-pass run BEFORE the inline-markup
 * compiler (renderInlineMarkup). Because it runs before the escape-first
 * compiler, resolved values are HTML-escaped by that compiler; on top of that we
 * neutralize inline-markup significant characters (`* [ ] \`) here so a spoofed
 * value cannot inject markup.
 *
 * Catalogue: the insertable variables are a curated subset of CONTEXT_VARIABLES
 * (context/registry.ts) that resolve to a clean display string, plus the tenant's
 * string-typed customAttributes. Built-in values resolve via the field registry;
 * custom values resolve from ctx.customAttributes.
 *
 * Syntax:
 *   {key}            resolve to the context value (or strip when empty).
 *   {key|default}    resolve, or use `default` when the value is empty/missing.
 *   \{               a literal brace.
 * Unknown / hand-typed braces are left exactly as written (never mangled).
 */

import { FIELD_REGISTRY } from "@/decision/rules/field-registry";
import type { RuleEvaluationContext } from "@/decision/rules/field-registry";
import { CONTEXT_VARIABLE_MAP } from "@/context/registry";
import type { CustomAttributeDeclaration } from "@/tenant/types";

/**
 * Built-in insertable variable keys: present in both CONTEXT_VARIABLES and
 * FIELD_REGISTRY and resolving to a clean, human-readable display string.
 */
export const BUILTIN_TOKEN_KEYS = [
  "companyName", "companyIndustry", "city", "region", "countryCode",
  "currentCity", "currentCountry", "utmCampaign", "utmTerm", "primaryInterest", "weatherSummary",
] as const;

const BUILTIN_SET: ReadonlySet<string> = new Set(BUILTIN_TOKEN_KEYS);

/** One entry in the "insert variable" catalogue. */
export interface VariableEntry {
  /** The token key inserted as `{token}`. */
  token: string;
  /** Human-readable label for the menu. */
  label: string;
  source: "built-in" | "custom";
}

/**
 * Build the unified insertable-variable catalogue: the curated built-in subset
 * of CONTEXT_VARIABLES plus the tenant's string-typed custom attributes.
 */
export function buildVariableCatalogue(
  customAttributes?: readonly CustomAttributeDeclaration[] | null,
): VariableEntry[] {
  const builtins: VariableEntry[] = [];
  for (const key of BUILTIN_TOKEN_KEYS) {
    const def = CONTEXT_VARIABLE_MAP[key];
    if (def) builtins.push({ token: def.key, label: def.label, source: "built-in" });
  }

  const custom: VariableEntry[] = (customAttributes ?? [])
    .filter((a) => a.type === "string")
    .map((a) => ({ token: a.name, label: a.label ?? a.name, source: "custom" as const }));

  return [...builtins, ...custom];
}

/** Strip inline-markup significant characters from a resolved value. */
function neutralizeMarkup(v: string): string {
  return v.replace(/[\\*[\]]/g, "");
}

/** Resolve a known token to its display value, or undefined when empty/missing. */
function resolveToken(key: string, ctx: RuleEvaluationContext): string | undefined {
  if (BUILTIN_SET.has(key)) {
    const def = FIELD_REGISTRY[key as keyof typeof FIELD_REGISTRY];
    const raw = def?.resolve?.(ctx);
    if (raw === null || raw === undefined || raw === "") return undefined;
    return String(raw);
  }
  const cv = ctx.customAttributes?.[key];
  if (cv === null || cv === undefined || cv === "") return undefined;
  return String(cv);
}

const TOKEN_RE = /\\\{|\{([a-zA-Z0-9_-]+)(?:\|([^}]*))?\}/g;

/**
 * Substitute context tokens in `src` against `ctx`.
 *
 * @param customKeys  The tenant's declared custom-attribute names, so a declared
 *                    attribute with an empty value is still treated as a known
 *                    token (stripped / defaulted, never shown raw). Defaults to
 *                    the keys present on ctx.customAttributes.
 */
export function substituteContextTokens(
  src: string | null | undefined,
  ctx: RuleEvaluationContext,
  customKeys?: Iterable<string>,
): string {
  if (!src) return "";

  const known = new Set<string>(BUILTIN_SET);
  for (const k of customKeys ?? Object.keys(ctx.customAttributes ?? {})) known.add(k);

  return src.replace(TOKEN_RE, (match, key: string | undefined, def: string | undefined) => {
    if (match === "\\{") return "{";
    if (key === undefined) return match;
    if (!known.has(key)) return match; // unknown / hand-typed braces: leave literal

    const value = resolveToken(key, ctx);
    if (value === undefined) return def !== undefined ? neutralizeMarkup(def) : "";
    return neutralizeMarkup(value);
  });
}

/**
 * Apply token substitution to the descriptive copy fields of a block's data
 * (subtitle, text, and items[].text / items[].body) before it is rendered.
 *
 * Runs at the data level so the inline-markup compiler and the block components
 * stay context-free. Returns a shallow copy; non-string fields are untouched.
 */
export function substituteBlockCopy<T>(
  data: T,
  ctx: RuleEvaluationContext,
  customKeys?: Iterable<string>,
): T {
  if (!data || typeof data !== "object") return data;
  const sub = (s: unknown) => (typeof s === "string" ? substituteContextTokens(s, ctx, customKeys) : s);

  const out = { ...(data as Record<string, unknown>) };
  if (typeof out.subtitle === "string") out.subtitle = sub(out.subtitle);
  if (typeof out.text === "string") out.text = sub(out.text);
  if (Array.isArray(out.items)) {
    out.items = out.items.map((it) => {
      if (!it || typeof it !== "object") return it;
      const item = { ...(it as Record<string, unknown>) };
      if (typeof item.text === "string") item.text = sub(item.text);
      if (typeof item.body === "string") item.body = sub(item.body);
      return item;
    });
  }
  return out as T;
}
