/**
 * Minimal type stubs for packages that must be installed before first use.
 *
 * Install with:
 *   npm install jose otplib qrcode bcryptjs
 *   npm install -D @types/qrcode @types/bcryptjs
 *
 * These stubs satisfy the TypeScript compiler while the packages are not yet
 * present in node_modules.  Once installed, the real type declarations from
 * the packages (and @types/*) take precedence automatically — these stubs
 * can then be deleted.
 */

// ── jose ──────────────────────────────────────────────────────────────────────

declare module "jose" {
  export interface JWTPayload {
    [key: string]: unknown;
    iss?: string;
    sub?: string;
    aud?: string | string[];
    jti?: string;
    nbf?: number;
    exp?: number;
    iat?: number;
  }

  export class SignJWT {
    constructor(payload: JWTPayload);
    setProtectedHeader(header: { alg: string }): this;
    setIssuedAt(input?: number | Date): this;
    setExpirationTime(input: string | number): this;
    sign(key: Uint8Array): Promise<string>;
  }

  export function jwtVerify(
    jwt: string,
    key: Uint8Array,
    options?: Record<string, unknown>,
  ): Promise<{ payload: JWTPayload; protectedHeader: Record<string, unknown> }>;
}

// ── otplib ────────────────────────────────────────────────────────────────────

declare module "otplib" {
  interface AuthenticatorOptions {
    window?: number;
    digits?: number;
    step?: number;
  }

  interface Authenticator {
    options: AuthenticatorOptions;
    generateSecret(bytes?: number): string;
    keyuri(user: string, service: string, secret: string): string;
    verify(opts: { token: string; secret: string }): boolean;
    generate(secret: string): string;
  }

  export const authenticator: Authenticator;
}

// ── qrcode ────────────────────────────────────────────────────────────────────

declare module "qrcode" {
  interface QRCodeOptions {
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    margin?: number;
    width?: number;
    color?: { dark?: string; light?: string };
  }

  export function toDataURL(text: string, options?: QRCodeOptions): Promise<string>;
  export function toString(text: string, options?: QRCodeOptions): Promise<string>;
}

// ── bcryptjs ──────────────────────────────────────────────────────────────────

declare module "bcryptjs" {
  export function hash(data: string, saltOrRounds: string | number): Promise<string>;
  export function compare(data: string, encrypted: string): Promise<boolean>;
  export function genSalt(rounds?: number): Promise<string>;
  export function hashSync(data: string, saltOrRounds: string | number): string;
  export function compareSync(data: string, encrypted: string): boolean;
}
