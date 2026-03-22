/**
 * Assertion & Validation Helpers
 *
 * Lightweight, zero-dependency utilities for narrowing and validating values
 * at runtime. Used by the experience composer and any future code that needs
 * explicit non-null guarantees.
 *
 * Design principles:
 *   - Pure functions — no side effects, fully testable
 *   - TypeScript-aware — each helper carries a type predicate or assertion
 *   - Minimal surface area — only what the project actually needs
 *   - No throws from type guards; only from assert* functions
 *
 * ─── Functions ───────────────────────────────────────────────────────────────
 *
 *   isDefined(value)        → type guard: value is not undefined
 *   isNonNull(value)        → type guard: value is not null
 *   isPresent(value)        → type guard: value is not null or undefined
 *   assertDefined(v, msg?)  → assertion: throws if undefined
 *   assertNonNull(v, msg?)  → assertion: throws if null
 *   assertPresent(v, msg?)  → assertion: throws if null or undefined
 */

// ── Type Guards ───────────────────────────────────────────────────────────────

/**
 * Type guard: returns true if value is not `undefined`.
 *
 * @example
 * const maybeString: string | undefined = getOptional();
 * if (isDefined(maybeString)) {
 *   // maybeString: string
 * }
 */
export function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

/**
 * Type guard: returns true if value is not `null`.
 *
 * @example
 * const result = await cms.getHeroVariant(key);
 * if (isNonNull(result)) {
 *   // result: HeroBlockData
 * }
 */
export function isNonNull<T>(value: T | null): value is T {
  return value !== null;
}

/**
 * Type guard: returns true if value is neither `null` nor `undefined`.
 *
 * Equivalent to `value != null` (loose inequality), but explicit and typed.
 *
 * @example
 * const items = [null, "a", undefined, "b"];
 * const strings = items.filter(isPresent); // string[]
 */
export function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

// ── Assertion Functions ───────────────────────────────────────────────────────

/**
 * Asserts that value is not `undefined`. Throws if undefined.
 *
 * @param value  The value to check.
 * @param message  Optional error message; defaults to "Expected defined value."
 * @throws {Error} If value is undefined.
 *
 * @example
 * const plan = resolveExperiencePlan();
 * assertDefined(plan, "Experience plan must be defined.");
 * // plan: ExperiencePlan (no longer ExperiencePlan | undefined)
 */
export function assertDefined<T>(
  value: T | undefined,
  message = "Expected defined value.",
): asserts value is T {
  if (value === undefined) {
    throw new Error(message);
  }
}

/**
 * Asserts that value is not `null`. Throws if null.
 *
 * @param value  The value to check.
 * @param message  Optional error message; defaults to "Expected non-null value."
 * @throws {Error} If value is null.
 *
 * @example
 * const hero = await cms.getHeroVariant(key);
 * assertNonNull(hero, `Hero variant "${key}" not found in CMS.`);
 * // hero: HeroBlockData (no longer HeroBlockData | null)
 */
export function assertNonNull<T>(
  value: T | null,
  message = "Expected non-null value.",
): asserts value is T {
  if (value === null) {
    throw new Error(message);
  }
}

/**
 * Asserts that value is neither `null` nor `undefined`. Throws otherwise.
 *
 * @param value  The value to check.
 * @param message  Optional error message; defaults to "Expected present value."
 * @throws {Error} If value is null or undefined.
 *
 * @example
 * const data = maybeData ?? null;
 * assertPresent(data, "Data must be present before rendering.");
 * // data: T (no longer T | null | undefined)
 */
export function assertPresent<T>(
  value: T | null | undefined,
  message = "Expected present value.",
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
}
