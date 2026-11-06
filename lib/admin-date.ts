/**
 * Fixed locale and time zone for dates and numbers in the admin and dashboard.
 *
 * toLocaleString(undefined) renders with the server's locale and zone on the
 * server (en-US, UTC) and the visitor's in the browser ("May 11, 01:26 PM"
 * against "11 mei, 13:26"). In a client component that is a hydration failure
 * that throws the whole tree away; in a server component it shows UTC times.
 * Numbers have the same problem ("1,000" against "1.000").
 */
export const ADMIN_LOCALE = "en-GB";
export const ADMIN_TIME_ZONE   = "Europe/Amsterdam";
