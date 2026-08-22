/**
 * Context token substitution for body copy, driven by a managed copy-variable
 * registry (TenantSettings.copyVariables).
 *
 * Each insertable {token} maps to a source (a curated built-in FIELD_REGISTRY
 * field, or a declared custom attribute) plus an optional value map (raw ->
 * display) and a fallback. Substitution runs as a pure pre-pass BEFORE the
 * escape-first inline-markup compiler (renderInlineMarkup): resolved / mapped /
 * fallback values are HTML-escaped by that compiler, and on top of that we
 * neutralize inline-markup significant characters (`* [ ] \`) here so neither a
 * spoofed context value nor an operator-authored map/fallback can inject markup.
 *
 * When a tenant has no managed registry the platform uses an implicit default:
 * the curated built-ins plus the tenant's string-typed custom attributes, so
 * existing tenants keep working with zero configuration.
 *
 * Syntax:
 *   {token}            resolve to the mapped context value (or strip when empty).
 *   {token|default}    resolve, or use `default` when the value is empty/missing.
 *   \{                 a literal brace.
 * Unknown / hand-typed braces are left exactly as written (never mangled).
 */

import { FIELD_REGISTRY } from "@/decision/rules/field-registry";
import type { RuleEvaluationContext } from "@/decision/rules/field-registry";
import type { CustomAttributeDeclaration, CopyVariable, CopyVariableMapping } from "@/tenant/types";

/** FIELD_REGISTRY kinds that resolve to a scalar, display-friendly value. */
const SCALAR_SOURCE_KINDS: ReadonlySet<string> = new Set([
  "categorical", "nullable_string", "number", "boolean",
]);

/**
 * FIELD_REGISTRY keys excluded as copy-variable sources despite a scalar kind:
 * PII / exact location, opaque or internal IDs, and segment-id collections.
 * These never make sensible visible copy and must not be insertable.
 */
export const SOURCE_DENYLIST: ReadonlySet<string> = new Set([
  "latitude", "longitude",       // exact coordinates (precise location / PII)
  "audienceSegmentIds",          // segment IDs (opaque, collection-backed)
  "tenantId", "crmContactId",    // internal / CRM identifiers
  "leadinfoCocNumber",           // company registration number (opaque ID)
  "templateKey",                 // internal routing key, not visitor-facing copy
]);

/**
 * Built-in source keys allowed for a copy variable: every FIELD_REGISTRY field
 * with a scalar kind (categorical / nullable_string / number / boolean), minus
 * the denylist. Labels come from FIELD_REGISTRY[key].label. Any future non-scalar
 * kind is excluded automatically.
 */
export const BUILTIN_SOURCE_KEYS: readonly string[] =
  Object.entries(FIELD_REGISTRY)
    .filter(([key, def]) =>
      SCALAR_SOURCE_KINDS.has((def as { kind?: string }).kind ?? "") && !SOURCE_DENYLIST.has(key),
    )
    .map(([key]) => key);

const BUILTIN_SOURCE_SET: ReadonlySet<string> = new Set(BUILTIN_SOURCE_KEYS);

/**
 * Default insertable built-ins when a tenant has no managed registry: the
 * original curated set, one-to-one (token === source key), no value maps.
 */
const DEFAULT_BUILTIN_TOKENS = [
  "companyName", "companyIndustry", "city", "region", "countryCode",
  "currentCity", "currentCountry", "utmCampaign", "utmTerm", "primaryInterest", "weatherSummary",
] as const;

/** Human-readable label for a built-in source key (from the field registry). */
export function builtinSourceLabel(key: string): string {
  return FIELD_REGISTRY[key as keyof typeof FIELD_REGISTRY]?.label ?? key;
}

/** One entry in the "insert variable" catalogue. */
export interface VariableEntry {
  /** The token key inserted as `{token}`. */
  token: string;
  /** Human-readable label for the menu. */
  label: string;
  source: "built-in" | "custom";
}

/**
 * The default copy-variable registry: the curated built-ins plus the tenant's
 * string-typed custom attributes. Used when no managed registry is stored, and
 * as the seed the Variables page materializes into editable entries.
 */
export function defaultCopyVariables(
  customAttributes?: readonly CustomAttributeDeclaration[] | null,
): CopyVariable[] {
  const builtins: CopyVariable[] = DEFAULT_BUILTIN_TOKENS.map((key) => ({
    token: key,
    label: builtinSourceLabel(key),
    source: { kind: "builtin", key },
  }));
  const custom: CopyVariable[] = (customAttributes ?? [])
    .filter((a) => a.type === "string")
    .map((a) => ({ token: a.name, label: a.label ?? a.name, source: { kind: "custom", name: a.name } as const }));
  return [...builtins, ...custom];
}

/**
 * The effective registry for a tenant: the managed registry when it has entries,
 * otherwise the implicit default (curated built-ins + string custom attributes).
 */
export function effectiveCopyVariables(
  managed: readonly CopyVariable[] | null | undefined,
  customAttributes?: readonly CustomAttributeDeclaration[] | null,
): CopyVariable[] {
  if (managed && managed.length > 0) return [...managed];
  return defaultCopyVariables(customAttributes);
}

/** Build the "insert variable" catalogue (dropdown) from an effective registry. */
export function buildVariableCatalogue(registry: readonly CopyVariable[]): VariableEntry[] {
  return registry.map((v) => ({
    token: v.token,
    label: v.label ?? v.token,
    source: v.source.kind === "builtin" ? "built-in" : "custom",
  }));
}

/** Strip inline-markup significant characters from a resolved/mapped value. */
function neutralizeMarkup(v: string): string {
  return v.replace(/[\\*[\]]/g, "");
}

/** Coerce a resolved raw value to a non-empty display string, or undefined. */
function coerceRaw(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "boolean") return v ? "true" : "false";
  const s = String(v);
  return s === "" ? undefined : s;
}

/** Resolve the raw (unmapped) value for a variable's source, or undefined. */
function resolveRaw(source: CopyVariable["source"], ctx: RuleEvaluationContext): string | undefined {
  if (source.kind === "builtin") {
    if (!BUILTIN_SOURCE_SET.has(source.key)) return undefined;
    const def = FIELD_REGISTRY[source.key as keyof typeof FIELD_REGISTRY];
    return coerceRaw(def?.resolve?.(ctx));
  }
  return coerceRaw(ctx.customAttributes?.[source.name]);
}

/** Apply the value map: exact `from` match, else the `*` default, else raw. */
function applyValueMap(raw: string, valueMap?: readonly CopyVariableMapping[]): string {
  if (!valueMap || valueMap.length === 0) return raw;
  const exact = valueMap.find((m) => m.from === raw);
  if (exact) return exact.to;
  const star = valueMap.find((m) => m.from === "*");
  if (star) return star.to;
  return raw;
}

/**
 * Resolve a variable to its final display string:
 * raw -> valueMap (exact -> `*` default) when present, else
 * (empty/missing) inline `{token|default}` -> entry fallback -> strip.
 * Markup is neutralized on every branch.
 */
function resolveDisplay(
  entry: CopyVariable,
  ctx: RuleEvaluationContext,
  inlineDefault: string | undefined,
): string {
  const raw = resolveRaw(entry.source, ctx);
  if (raw !== undefined) return neutralizeMarkup(applyValueMap(raw, entry.valueMap));
  const fallback = inlineDefault !== undefined ? inlineDefault : entry.fallback;
  return fallback !== undefined ? neutralizeMarkup(fallback) : "";
}

const TOKEN_RE = /\\\{|\{([a-zA-Z0-9_-]+)(?:\|([^}]*))?\}/g;

/**
 * Substitute copy-variable tokens in `src` against `ctx` using `registry`.
 * Tokens not in the registry (or hand-typed braces) are left literal.
 */
export function substituteContextTokens(
  src: string | null | undefined,
  ctx: RuleEvaluationContext,
  registry: readonly CopyVariable[],
): string {
  if (!src) return "";

  const byToken = new Map<string, CopyVariable>();
  for (const v of registry) byToken.set(v.token, v);

  return src.replace(TOKEN_RE, (match, key: string | undefined, def: string | undefined) => {
    if (match === "\\{") return "{";
    if (key === undefined) return match;
    const entry = byToken.get(key);
    if (!entry) return match; // unknown / hand-typed braces: leave literal
    return resolveDisplay(entry, ctx, def);
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
  registry: readonly CopyVariable[],
): T {
  if (!data || typeof data !== "object") return data;
  const sub = (s: unknown) => (typeof s === "string" ? substituteContextTokens(s, ctx, registry) : s);

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
