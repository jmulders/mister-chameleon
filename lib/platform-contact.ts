/**
 * The platform's own address and site, in one place.
 *
 * Fallback senders, "powered by" links and the links in welcome mails pointed
 * at mister-chameleon.com, misterchameleon.com and mister-chameleon.io. None of
 * those domains belongs to Mister Chameleon: a new customer following the link
 * in a welcome mail landed on someone else's site. The only domain in use is
 * misterchameleon.nl.
 */

export const PLATFORM_EMAIL = "info@misterchameleon.nl";

/** Sender used when no MAIL_FROM_ADDRESS is configured. */
export const PLATFORM_FROM = `Mister Chameleon <${PLATFORM_EMAIL}>`;

/** The public marketing site. For links in mails to the admin, use the request host instead. */
export const PLATFORM_SITE_URL = "https://www.misterchameleon.nl";
