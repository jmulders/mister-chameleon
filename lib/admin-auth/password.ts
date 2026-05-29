/**
 * Admin password hashing and verification.
 * Node.js only — never import in middleware or Client Components.
 */
import "server-only";

import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

/** Hashes a plaintext password with bcrypt. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** Returns true when the plaintext password matches the stored bcrypt hash. */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Validates password strength for the create/change-password flow.
 * Returns an error string, or null when the password passes all checks.
 */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 12)        return "Password must be at least 12 characters.";
  if (!/[A-Z]/.test(password))     return "Password must contain at least one uppercase letter.";
  if (!/[a-z]/.test(password))     return "Password must contain at least one lowercase letter.";
  if (!/\d/.test(password))        return "Password must contain at least one digit.";
  return null;
}
