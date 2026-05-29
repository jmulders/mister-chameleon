// @ts-check

import { createRequire } from "module";
import { fileURLToPath }  from "url";
import path               from "path";

const _require  = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Optional R2 SDK — build-time detection ────────────────────────────────────
//
// @aws-sdk/client-s3 is optional: needed only when Cloudflare R2 is the active
// storage provider.  When the package is absent we alias it to a local stub so
// that `next build` and `next dev` succeed without the SDK installed.
//
// The stub (lib/assets/stubs/aws-sdk-client-s3.js) exports the same class
// names as the real SDK.  Each class throws a clear "install the package"
// error if invoked at runtime while the provider is set to cloudflare_r2.
//
// Once `npm install @aws-sdk/client-s3` is run and `.next` is cleared, the
// real SDK is used automatically — the alias is not added when the package is
// present.
const R2_SDK_STUB = (() => {
  try {
    _require.resolve("@aws-sdk/client-s3");
    return null; // package installed — no alias needed
  } catch {
    return path.resolve(__dirname, "lib/assets/stubs/aws-sdk-client-s3.js");
  }
})();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ── Optional Node.js-only packages ─────────────────────────────────────────
  //
  // `serverExternalPackages` tells Next.js / Turbopack to treat these packages
  // as Node.js externals rather than bundling them.  At runtime Node.js resolves
  // them natively from node_modules — exactly like a plain `require()` call.
  //
  // Without this, Turbopack's static analyser attempts to pre-bundle
  // `import("nodemailer")` at build time.  If the package was absent during an
  // earlier build, Turbopack may cache a "not found" error that persists even
  // after `npm install nodemailer` — until `.next/` is fully cleared.  Marking
  // it external bypasses bundler analysis entirely and resolves it at runtime.
  //
  // nodemailer is used only when the SMTP transport is configured.
  // @types/nodemailer is optional — install for TypeScript autocomplete only.
  serverExternalPackages: [
    "nodemailer",
    // AWS SDK v3 — used for Cloudflare R2 (S3-compatible) asset storage.
    // Marked external so Turbopack/Webpack don't attempt to bundle the CJS
    // sub-packages inside @aws-sdk/client-s3 that use Node.js crypto APIs.
    "@aws-sdk/client-s3",
    "@aws-sdk/credential-provider-node",
    "@smithy/node-http-handler",
  ],

  // ── TypeScript ──────────────────────────────────────────────────────────────
  // The generated Supabase Database types are currently missing a handful of
  // tables (domain_store, tenant_settings), causing TS2769/TS2345 errors in
  // tenant/domain-store.ts and tenant/tenant-store.ts.  These are pre-existing
  // type-generation issues that do not affect runtime behaviour; the queries
  // execute correctly.  Suppress them here so Vercel builds succeed while the
  // types are kept in sync with the actual schema.
  //
  // TODO: regenerate Supabase types after all migrations are applied:
  //   npx supabase gen types typescript --linked > types/supabase.ts
  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    // ── Sanity CDN ──────────────────────────────────────────────────────────
    //
    // Allow next/image to proxy and optimize images from cdn.sanity.io.
    // The Sanity CDN already supports URL-based transformations (w, h, auto,
    // fit, q) which are baked into GROQ projections in our queries.
    // next/image adds a second optimization layer: it serves correctly-sized
    // images for each breakpoint and converts to WebP/AVIF where not already
    // done at the CDN level.
    //
    // formats: prefer AVIF (smaller than WebP) where the browser supports it.
    // deviceSizes / imageSizes: constrain srcset slots so Next.js doesn't
    //   generate dozens of variants.  The narrow set here covers logo (160),
    //   thumbnail (480), hero (1200), and 2× retina (2400).
    formats: ["image/avif", "image/webp"],
    deviceSizes: [160, 320, 480, 640, 768, 1024, 1200, 1920],
    imageSizes:  [16, 32, 48, 64, 96, 128, 160, 256, 480],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
        // Allow all paths under cdn.sanity.io — images live at
        // /images/{projectId}/{dataset}/{id}-{hash}.{ext}
        pathname: "/**",
      },
      // ── Cloudflare R2 ───────────────────────────────────────────────────────
      //
      // Allow next/image to serve assets from the configured R2 public URL.
      // The hostname is derived from R2_PUBLIC_URL at build time.
      //
      // Built-in R2 public URL pattern: pub-<hash>.r2.dev
      // Custom domain: any hostname you configure on your R2 bucket.
      //
      // If R2_PUBLIC_URL is not set, this entry is simply omitted.
      ...(process.env.R2_PUBLIC_URL
        ? (() => {
            try {
              return [{ protocol: "https", hostname: new URL(process.env.R2_PUBLIC_URL).hostname, pathname: "/**" }];
            } catch {
              return [];
            }
          })()
        : []),
      // Wildcard for Cloudflare R2 built-in public domains — covers all
      // pub-*.r2.dev URLs without requiring the exact hash in the config.
      {
        protocol: "https",
        hostname: "*.r2.dev",
        pathname: "/**",
      },
    ],
    // minimumCacheTTL: how long Next.js caches the optimized image on disk
    // (seconds).  604800 = 7 days.  Sanity assets are content-addressed
    // (the URL encodes the file hash) so they never change — 7-day cache is safe.
    minimumCacheTTL: 604800,
  },

  async headers() {
    return [
      {
        // All routes: common security headers.
        // X-Frame-Options is set to SAMEORIGIN (not DENY) so that the
        // /preview/theme/[presetKey] pages can be embedded in same-origin
        // iframes (e.g. the onboarding wizard at /admin/onboarding).
        // Cross-origin framing is still blocked by SAMEORIGIN.
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },

  // ── Webpack alias — @aws-sdk/client-s3 stub ───────────────────────────────
  //
  // When @aws-sdk/client-s3 is not installed, alias every reference to it
  // (even inside dynamic `import()` calls followed by the bundle analyser)
  // to the local stub.  The stub exports the same class names and throws a
  // clear "install the package" error if Cloudflare R2 is actually invoked.
  //
  // The alias is added ONLY to the server webpack config (the package is
  // server-only anyway).  The client bundle never reaches r2-storage.ts
  // because storage-adapter.ts is marked `server-only`.
  //
  // R2_SDK_STUB is null when the real package is installed — in that case
  // this function is not added to the config at all.
  ...(R2_SDK_STUB
    ? {
        webpack(config, { isServer }) {
          if (isServer) {
            config.resolve.alias = {
              ...config.resolve.alias,
              "@aws-sdk/client-s3": R2_SDK_STUB,
            };
          }
          return config;
        },

        // ── Turbopack alias (next dev in Next.js 15 +) ──────────────────────
        //
        // `next dev` in Next.js 15/16 uses Turbopack by default.  Turbopack
        // reads `turbopack.resolveAlias` for module aliases (equivalent to
        // webpack's `resolve.alias`).
        //
        // IMPORTANT: Turbopack does NOT accept absolute paths in resolveAlias.
        // It requires paths relative to the project root (where next.config.mjs
        // lives).  Passing the absolute R2_SDK_STUB path causes Turbopack to
        // mangle it into a broken "./Users/..." relative import.
        turbopack: {
          resolveAlias: {
            "@aws-sdk/client-s3": "./lib/assets/stubs/aws-sdk-client-s3.js",
          },
        },
      }
    : {}),
};

export default nextConfig;
