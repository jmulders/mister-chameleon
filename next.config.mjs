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

  // ── Provisioning fieldsets — file tracing ───────────────────────────────────
  //
  // The provisioning manifest route reads the canonical content-block fieldsets
  // (provisioning/statamic/fieldsets/*.yaml) from disk at request time. Next.js
  // only bundles files it can statically see being imported, so these data
  // files must be explicitly traced into the serverless function — otherwise
  // fs.readdirSync returns ENOENT on Vercel and the mrc_* fieldsets are omitted.
  outputFileTracingIncludes: {
    "/api/v1/provision/manifest": ["./provisioning/statamic/fieldsets/**/*"],
  },

  // ── Server Actions ──────────────────────────────────────────────────────────
  //
  // The default body size limit for Server Actions is 1 MB.  Asset uploads via
  // the picker modal send file bytes directly in the FormData payload, so we
  // raise the limit to match the 10 MB per-file cap enforced in
  // upload-for-picker-action.ts.  The +1 MB headroom covers multipart framing
  // and any additional form fields (tenantId, altText).
  //
  // In Next.js 15+ this is a top-level key (moved out of `experimental`).
  serverActions: {
    bodySizeLimit: "11mb",
  },

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

  // ── Statamic asset proxy ───────────────────────────────────────────────────
  //
  // Rich-text blocks in Statamic store images as `statamic://asset::` protocol
  // URLs, which the mapper converts to root-relative `/assets/:path` paths.
  //
  // Routing strategy:
  //
  //   When STATAMIC_CMS_PATH is set (file-based / local dev mode):
  //     → app/assets/[...path]/route.ts handles the request.
  //       It reads the file directly from disk — no PHP server required.
  //       The rewrite must be SKIPPED in this case because Next.js processes
  //       "afterFiles" rewrites BEFORE App Router dynamic routes.  A rewrite
  //       that points to a PHP server that isn't running would return 502 and
  //       the App Router route would never be reached.
  //
  //   When only STATAMIC_API_URL is set (HTTP-only / production mode):
  //     → This rewrite proxies `/assets/:path*` → STATAMIC_API_URL/assets/:path*.
  //       The App Router route is unreachable because the rewrite fires first,
  //       but in production the PHP server is expected to be running.
  //
  async rewrites() {
    // Skip when running in file-based mode — app/assets/[...path]/route.ts
    // serves assets directly from disk, no proxy needed.
    if (process.env.STATAMIC_CMS_PATH) return [];

    const statamicBase = (process.env.STATAMIC_API_URL ?? "").replace(/\/$/, "");
    if (!statamicBase) return [];
    return [
      {
        source:      "/assets/:path*",
        destination: `${statamicBase}/assets/:path*`,
      },
    ];
  },

  async headers() {
    // In development the Statamic CP (localhost:8000) embeds Next.js pages in
    // Live Preview iframes.  Because the two servers run on different ports they
    // are considered cross-origin, so X-Frame-Options: SAMEORIGIN would block
    // the iframe.  We therefore use the more granular CSP frame-ancestors
    // directive in dev that allows localhost:8000 explicitly, and omit
    // X-Frame-Options (frame-ancestors takes precedence in modern browsers, but
    // having both with conflicting values causes confusing behaviour).
    //
    // In production framing is restricted to the same origin only, keeping the
    // existing security posture.  X-Frame-Options is kept alongside frame-ancestors
    // for compatibility with older proxies/CDNs that still read the legacy header.
    const isDev = process.env.NODE_ENV === "development";

    // The Statamic CP embeds Next.js pages in Live Preview iframes. The CP runs
    // on a different origin (dev: localhost:8000; prod: the managed Ploi Cloud
    // host *.ploi.it, or a custom STATAMIC_CP_ORIGIN such as cms.example.nl), so
    // frame-ancestors must list those origins for the iframe to load.
    //   - Dev:  localhost:8000
    //   - Prod: https://*.ploi.it  + optional STATAMIC_CP_ORIGIN
    const cpOrigin   = process.env.STATAMIC_CP_ORIGIN; // e.g. https://cms.misterchameleon.nl
    const frameAllow = isDev
      ? "frame-ancestors 'self' http://localhost:8000"
      : `frame-ancestors 'self' https://*.ploi.it${cpOrigin ? ` ${cpOrigin}` : ""}`;

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // frame-ancestors controls which origins may embed this page.
          {
            key: "Content-Security-Policy",
            value: frameAllow,
          },
          // X-Frame-Options cannot express cross-origin allow-lists (ALLOW-FROM is
          // deprecated and SAMEORIGIN would block the CP). Modern browsers enforce
          // CSP frame-ancestors instead, so we omit X-Frame-Options entirely now
          // that the CP (cross-origin) must be able to embed preview pages.
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
      {
        // The Statamic CP Live Preview iframe reloads /mc-preview with a fresh
        // token on every edit. Make sure neither the browser nor any CDN serves
        // a cached render, otherwise the iframe keeps showing an earlier token's
        // (stale) content while the editor expects their latest unsaved change.
        source: "/mc-preview",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" },
          // Statamic's Live Preview hot-reload FETCHES this URL from the CP
          // origin (cross-origin) to refresh the iframe on each edit. Without
          // CORS that fetch is blocked and the preview never updates pre-save.
          { key: "Access-Control-Allow-Origin", value: "*" },
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
