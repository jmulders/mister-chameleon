/**
 * Escape text for use inside HTML, in element content or a quoted attribute.
 *
 * For HTML that is built as a string, such as an email body. A value typed by a
 * visitor (a name on a sign-up form) is text, and must not become markup in a
 * mail the platform sends from its own domain.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
