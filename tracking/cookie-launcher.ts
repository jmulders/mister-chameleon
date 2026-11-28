/**
 * tracking/cookie-launcher.ts
 *
 * When the small "Cookie settings" pill in the bottom-left corner is on screen.
 *
 * The pill used to stay for good, also after the visitor had chosen. On a phone
 * it then lies over the page for the rest of the visit, for a choice that is
 * already made. It now leaves once the visitor has answered, as long as the
 * page itself still links to the cookie page: that link is the way back to the
 * settings. A page without such a link keeps the pill, so a visitor can always
 * change or withdraw a choice.
 */

/** A link to the cookie page, with or without a locale prefix or trailing slash. */
export const COOKIE_PAGE_LINK = 'a[href$="/cookies"], a[href$="/cookies/"]';

/**
 * Marks the consent banner and the settings window (written out as
 * `data-consent-ui=""` in both). A link inside them does not count as the
 * page's own link: the banner is gone after the choice.
 */
export const CONSENT_UI_ATTRIBUTE = "data-consent-ui";

export interface CookieLauncherState {
  /** The visitor answered the consent prompt (accepted, declined or customised). */
  responded: boolean;
  /** The page has its own link to the cookie page, for instance in the footer. */
  pageLinksToCookies: boolean;
}

/** The pill shows until the visitor has chosen and the page offers the way back. */
export function cookieLauncherShown(state: CookieLauncherState): boolean {
  return !(state.responded && state.pageLinksToCookies);
}

/** Whether the document has its own link to the cookie page. False on the server. */
export function pageLinksToCookies(): boolean {
  if (typeof document === "undefined") return false;
  for (const link of document.querySelectorAll(COOKIE_PAGE_LINK)) {
    if (!link.closest(`[${CONSENT_UI_ATTRIBUTE}]`)) return true;
  }
  return false;
}

/**
 * useSyncExternalStore subscribe adapter for pageLinksToCookies: a footer can
 * arrive after hydration (streamed) or change with a client-side navigation.
 */
export function subscribePageLinks(onStoreChange: () => void): () => void {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}
