# Content-Security-Policy

## Waar het zit
Eén bron van waarheid: `lib/security/csp.ts` bouwt de policy, `proxy.ts` (de Next
16 middleware) genereert per request een nonce en zet de header. `next.config.mjs`
zet **geen** CSP meer (twee CSP-headers combineert de browser tot de strengste —
dat zou de nonce-policy stilzwijgend breken).

## Report-only → afgedwongen (de flip)
De flip is één env-var, bewust een aparte, gemarkeerde stap:

- **default (niets gezet)** → `Content-Security-Policy-Report-Only`: de browser
  logt violations in de console maar blokkeert niets. Veilig te shippen.
- **`CSP_ENFORCE=true`** (of `1`/`yes`) → `Content-Security-Policy`: afgedwongen.

Ship report-only, bekijk de console op een echte pagina + de Scenario/Leadinfo-flow,
en zet daarna pas `CSP_ENFORCE=true` (in Vercel env). Terugdraaien = de var weghalen.

## Allowances (waarom)
- **script-src**: `'self'` + per-request **nonce** (Next-hydration + de GTM inline
  snippet) + `www.googletagmanager.com` (GTM) + `cdn.leadinfo.net` (ping.js) +
  `code.jquery.com` (Leadinfo's ping.js laadt jQuery — gevonden via report-only
  verificatie). Geen kale `'unsafe-inline'`. **Dev** relaxt naar
  `'unsafe-inline' 'unsafe-eval'` (Turbopack HMR + React dev-eval) — nooit in prod.
- **font-src**: `'self' data:` — next/font is self-hosted onder `/_next`
  (voorheen `font-src 'none'`, wat die fonts blokkeerde).
- **style-src**: `'self' 'unsafe-inline'` — Next + de layout emitten inline
  `<style>`; stijl is geen script-executievector.
- **connect-src**: `'self'` (incl. `POST /api/enrichment/leadinfo`) + Leadinfo
  (`*.leadinfo.net`, `api.leadinfo.com`) + GA/GTM + Supabase (REST + realtime wss).
- **img-src**: `'self' data: blob: https:` — next/image proxyt remote images
  same-origin; tracking-pixels + CMS/CDN-images laden over https.
- **frame-src**: `'self' https://www.googletagmanager.com` (de GTM `<noscript>`-iframe).
- **frame-ancestors**: de Statamic-CP-origins (dev `localhost:8000`; prod
  `*.ploi.it` + `STATAMIC_CP_ORIGIN`) voor Live Preview.
- **object-src 'none'**, **base-uri 'self'**, **form-action 'self'**,
  **upgrade-insecure-requests** (prod).

## Nonce-mechaniek
`proxy.ts` genereert `btoa(crypto.randomUUID())`, zet 'm op de request-headers als
`x-nonce` (de root-layout leest 'm voor de GTM-snippet) én in de request
`Content-Security-Policy`-header (Next leest die om zijn eigen scripts te noncen),
en zet de browser-facing header op de response. De nonce wisselt per request, dus
gematchte routes renderen dynamisch — deze site personaliseert toch al per request.

## Verificatie
Geverifieerd op een echte pagina (`/?tenant=statamic`, met GTM + Leadinfo) in beide
modi: geen CSP-violations voor fonts/GTM/Leadinfo; fonts laden van `/_next` +
`/__nextjs_font` (`font-src 'self'`); Next-scripts + GTM-snippet genonced. Test:
`tests/security/csp.test.ts`.
