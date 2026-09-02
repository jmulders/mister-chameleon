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
 *   {?var}…{/var}      render the enclosed part only when `var` has a non-empty
 *                      value (raw -> valueMap, no fallback); otherwise drop it all.
 *   \{                 a literal brace.
 * Unknown / hand-typed braces are left exactly as written (never mangled).
 * When a bare {token} strips to nothing, the surrounding whitespace is tidied
 * (double space collapsed, dangling space before punctuation trimmed).
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
  // EP-Online RAW energy label: licence-gated for visitor display. Denylisted by
  // default so it is never a copy token; re-allowed at render only when the tenant
  // flag epLabelDisplayAllowed is on (see resolveRaw + substituteContextTokens opts).
  // The BAND (locationEnergyLabelBand) is NOT denylisted → always available.
  "locationEnergyLabel",
]);

/** The one denylisted key that a per-tenant flag can re-enable for display. */
const EP_LABEL_RAW_KEY = "locationEnergyLabel";

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
  /**
   * Whether the variable has a non-empty fallback. When false, an empty/missing
   * value renders blank unless the author uses an inline `{token|default}`. The
   * editors surface a non-blocking warning for false.
   */
  hasFallback: boolean;
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
    hasFallback: typeof v.fallback === "string" && v.fallback.trim() !== "",
  }));
}

/**
 * The variables used as a BARE `{token}` in `value` that have no fallback.
 *
 * An inline `{token|default}` supplies its own fallback, so it does NOT warn —
 * only a bare `{token}` (and never an escaped `\{token}`) counts. Powers the
 * editor's non-blocking "no fallback set" warning.
 */
export function variablesNeedingFallbackWarning(
  value: string,
  variables: readonly VariableEntry[],
): VariableEntry[] {
  if (!value) return [];
  return variables.filter((v) => {
    if (v.hasFallback) return false;
    const esc = v.token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<!\\\\)\\{${esc}\\}`).test(value);
  });
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
function resolveRaw(
  source: CopyVariable["source"],
  ctx: RuleEvaluationContext,
  allowRawEpLabel = false,
): string | undefined {
  if (source.kind === "builtin") {
    // The EP-Online raw label is denylisted; a tenant with epLabelDisplayAllowed
    // may still display it (licence cleared). No other denylisted key is re-enabled.
    const allowed = BUILTIN_SOURCE_SET.has(source.key)
      || (allowRawEpLabel && source.key === EP_LABEL_RAW_KEY);
    if (!allowed) return undefined;
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
 * The value a variable would present WITHOUT any fallback: raw -> valueMap,
 * markup-neutralized. `undefined` when the source is missing. Used by the
 * conditional-segment test: a segment renders iff its variable has a non-empty
 * present value (so a fallback never makes a segment appear).
 */
function presentValue(entry: CopyVariable, ctx: RuleEvaluationContext, allowRawEpLabel = false): string | undefined {
  const raw = resolveRaw(entry.source, ctx, allowRawEpLabel);
  if (raw === undefined) return undefined;
  return neutralizeMarkup(applyValueMap(raw, entry.valueMap));
}

/** Sentinel emitted where a bare token strips to nothing (no fallback/default),
 *  so the whitespace cleanup can tidy exactly those spots and nothing else. */
const STRIP = "\u0000";

const TOKEN_RE = /\\\{|\{([a-zA-Z0-9_-]+)(?:\|([^}]*))?\}/g;
// Conditional segment: {?var} … {/var}. Non-greedy body, backreferenced close.
// The negative lookbehind keeps an escaped \{?…} literal (mirrors \{).
const SEGMENT_RE = /(?<!\\)\{\?([a-zA-Z0-9_-]+)\}([\s\S]*?)\{\/\1\}/g;

/**
 * Substitute copy-variable tokens in `src` against `ctx` using `registry`.
 *
 * Supports:
 *   {token}            resolve, or strip to nothing (with whitespace cleanup).
 *   {token|default}    resolve, or use `default` when the value is empty/missing.
 *   {?var}…{/var}      render the enclosed part only when `var` has a non-empty
 *                      present value (raw -> valueMap, no fallback); otherwise the
 *                      whole segment (markers + inner text) is dropped. Tokens
 *                      inside a rendered segment substitute normally.
 *   \{                 a literal brace (also keeps \{?… literal).
 *
 * Tokens not in the registry (or hand-typed braces) are left literal.
 */
export interface SubstituteOptions {
  /** Tenant licence gate: allow the EP-Online RAW energy label as a display token. */
  epLabelDisplayAllowed?: boolean;
}

export function substituteContextTokens(
  src: string | null | undefined,
  ctx: RuleEvaluationContext,
  registry: readonly CopyVariable[],
  opts: SubstituteOptions = {},
): string {
  if (!src) return "";
  const allowRawEpLabel = opts.epLabelDisplayAllowed ?? false;

  const byToken = new Map<string, CopyVariable>();
  for (const v of registry) byToken.set(v.token, v);

  // ── 1. Conditional segments (recursive, so nested segments resolve too) ──────
  const segmentPresent = (key: string): boolean => {
    const entry = byToken.get(key);
    if (!entry) return false;            // unknown variable → treat as empty
    const v = presentValue(entry, ctx, allowRawEpLabel);
    return v !== undefined && v !== "";
  };
  const processSegments = (text: string): string =>
    text.replace(SEGMENT_RE, (_m, key: string, inner: string) =>
      segmentPresent(key) ? processSegments(inner) : "");

  // ── 2. Tokens (emit the strip sentinel where a bare token has nothing) ───────
  const withTokens = processSegments(src).replace(
    TOKEN_RE,
    (match, key: string | undefined, def: string | undefined) => {
      if (match === "\\{") return "{";
      if (key === undefined) return match;
      const entry = byToken.get(key);
      if (!entry) return match; // unknown / hand-typed braces: leave literal
      const raw = resolveRaw(entry.source, ctx, allowRawEpLabel);
      if (raw !== undefined) return neutralizeMarkup(applyValueMap(raw, entry.valueMap));
      const fb = def !== undefined ? def : entry.fallback;
      if (fb !== undefined) return neutralizeMarkup(fb);
      return STRIP; // pure strip → cleaned below
    },
  );

  // ── 3. Whitespace cleanup around stripped tokens only ────────────────────────
  // A sentinel with a space on BOTH sides collapses to one space; otherwise it
  // (and one adjacent space, e.g. before punctuation or at an edge) is removed.
  // Pre-existing whitespace elsewhere is untouched.
  return withTokens
    .replace(/( ?)\u0000+( ?)/g, (_m, before: string, after: string) => (before && after ? " " : ""))
    .replace(/\u0000/g, "");
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
  opts: SubstituteOptions = {},
): T {
  if (!data || typeof data !== "object") return data;
  const sub = (s: unknown) => (typeof s === "string" ? substituteContextTokens(s, ctx, registry, opts) : s);

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
