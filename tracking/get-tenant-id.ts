/**
 * getTenantId — client-side tenant ID resolver
 *
 * Reads the active tenant ID from the `__mc_tenant__` inline JSON script element
 * that `app/page.tsx` (and any other page that needs client-side tenant context)
 * injects into the SSR HTML.
 *
 * ─── Why a script element? ─────────────────────────────────────────────────────
 *
 *   Client Components that fire tracking events (PageTracker, TrackedCTAButton)
 *   are rendered inside the slot tree, several layers away from where the active
 *   tenant is known at the server level. Threading `tenantId` down through every
 *   intermediate component (TemplateRenderer → CTABlock → TrackedCTAButton) would
 *   add prop pollution throughout the platform architecture.
 *
 *   The inline script element is the established pattern for embedding small,
 *   server-known values into the client bundle without a Context provider.
 *   It is set once per SSR pass and is available synchronously in useEffect
 *   (the element is part of the initial HTML — no hydration race).
 *
 * ─── Security note ────────────────────────────────────────────────────────────
 *
 *   The tenant ID is a non-secret slug (e.g. "workengine"). It is never a key,
 *   token, or credential. Exposing it client-side is intentional and safe.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   // In a tracking helper (called from useEffect or onClick):
 *   const tenantId = getTenantId();   // "workengine" | undefined
 *
 * ─── Injected by ──────────────────────────────────────────────────────────────
 *
 *   app/page.tsx:
 *     <script
 *       id="__mc_tenant__"
 *       type="application/json"
 *       dangerouslySetInnerHTML={{ __html: JSON.stringify({ tenantId }) }}
 *     />
 */

/**
 * Returns the active tenant ID from the `__mc_tenant__` script element,
 * or `undefined` if the element is absent or unparseable.
 *
 * Safe to call in SSR contexts — returns `undefined` when `document` is not
 * available (the server never needs this helper; it has tenantId directly).
 */
export function getTenantId(): string | undefined {
  if (typeof document === "undefined") return undefined;

  try {
    const el = document.getElementById("__mc_tenant__");
    if (!el) return undefined;

    const data = JSON.parse(el.textContent ?? "{}") as Record<string, unknown>;
    return typeof data.tenantId === "string" ? data.tenantId : undefined;
  } catch {
    return undefined;
  }
}
