/**
 * Class name utility — `cn()`
 *
 * A zero-dependency helper that merges conditional class names into
 * a single string.  Falsy values (false, null, undefined, "") are dropped.
 *
 * Usage:
 *   cn("base-class", isActive && "active", variant === "primary" && "bg-brand-500")
 *   // → "base-class active bg-brand-500"
 *
 * When tailwind-merge is installed later, swap the body to:
 *   import { twMerge } from "tailwind-merge";
 *   import { clsx } from "clsx";
 *   export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
 */

type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  return inputs
    .flat(Infinity as 1)
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .join(" ");
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
