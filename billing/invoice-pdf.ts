/**
 * An invoice as a PDF, written by hand.
 *
 * One A4 page of text and three lines needs no library: a PDF is a handful of
 * numbered objects and a table that says where each one starts. The two fonts
 * used, Helvetica and Helvetica-Bold, are among the fourteen every PDF reader
 * has built in, so nothing is embedded.
 *
 * Two things a hand-written PDF must get right, and the tests pin both:
 *
 *   - Text is written in Windows-1252, the encoding the fonts are declared
 *     with. That is what makes the euro sign and letters like é come out.
 *   - Amounts are right-aligned, which takes the width of each character. The
 *     widths below are Helvetica's own, for the characters an amount is made
 *     of. Both fonts share them.
 *
 * Pure: the same invoice gives the same bytes.
 */

export interface InvoiceParty {
  name:        string | null;
  addressLine: string | null;
  postalCode:  string | null;
  city:        string | null;
  country:     string | null;
  vatNumber:   string | null;
}

export interface InvoiceForPdf {
  number:       string;
  /** ISO timestamp. */
  issuedAt:     string;
  paidAt:       string | null;
  description:  string;
  netCents:     number;
  vatCents:     number;
  grossCents:   number;
  vatRateBp:    number;
  /** The sentence a rate of nothing needs, or null. */
  vatNote:      string | null;
  customer:     InvoiceParty;
  seller:       InvoiceParty & { kvk: string; email: string; website: string };
}

// ── Text ──────────────────────────────────────────────────────────────────────

/** The few characters Windows-1252 keeps outside Latin-1 that an invoice uses. */
const CP1252_EXTRA: Record<string, number> = { "€": 0x80, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "–": 0x96, "—": 0x97, "…": 0x85 };

/** A string as Windows-1252 bytes. What the encoding cannot write becomes "?". */
export function cp1252(text: string): number[] {
  const bytes: number[] = [];
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (CP1252_EXTRA[ch] !== undefined)                  bytes.push(CP1252_EXTRA[ch]!);
    else if (code < 0x80 || (code >= 0xa0 && code <= 0xff)) bytes.push(code);
    else                                                 bytes.push(0x3f);
  }
  return bytes;
}

const hex = (text: string) => `<${cp1252(text).map((b) => b.toString(16).padStart(2, "0")).join("")}>`;

/** Helvetica's widths, in thousandths of the font size, for what an amount is made of. */
const WIDTHS: Record<string, number> = {
  "0": 556, "1": 556, "2": 556, "3": 556, "4": 556, "5": 556, "6": 556, "7": 556, "8": 556, "9": 556,
  " ": 278, ".": 278, ",": 278, "-": 333, "€": 556, "%": 889,
};

/** The width of a string of amount characters at a font size, in points. */
export function amountWidth(text: string, size: number): number {
  let units = 0;
  for (const ch of text) units += WIDTHS[ch] ?? 556;
  return (units * size) / 1000;
}

/** Cents as a Dutch amount: "€ 1.234,56". */
export function euro(cents: number): string {
  const sign  = cents < 0 ? "-" : "";
  const abs   = Math.abs(cents);
  const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `€ ${sign}${whole},${String(abs % 100).padStart(2, "0")}`;
}

/** An ISO timestamp as a Dutch date in Dutch time: "27-11-2026". */
export function dutchDate(iso: string): string {
  const parts = new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}-${get("month")}-${get("year")}`;
}

/** "21%" or "0%". */
function rate(bp: number): string {
  const pct = bp / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(".", ",")}%`;
}

/** Break a line that is too long for its column, on spaces. */
export function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && (line + " " + word).length > maxChars) { lines.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

// ── The page ──────────────────────────────────────────────────────────────────

const PAGE_W = 595;   // A4, in points
const PAGE_H = 842;
const LEFT   = 56;
const RIGHT  = PAGE_W - 56;

/** A country code as its Dutch name: "NL" is "Nederland". The code itself when unknown. */
export function countryName(code: string | null): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(["nl"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** The lines of an address block, without the empty ones. */
function partyLines(p: InvoiceParty): string[] {
  const place = [p.postalCode, p.city].filter(Boolean).join(" ");
  return [p.name, p.addressLine, [place, countryName(p.country)].filter(Boolean).join(", "), p.vatNumber ? `Btw-nummer ${p.vatNumber}` : null]
    .filter((line): line is string => typeof line === "string" && line.trim() !== "");
}

export function invoicePdf(invoice: InvoiceForPdf): Uint8Array {
  const ops: string[] = [];
  const text  = (x: number, y: number, s: string, size = 10, bold = false) => { ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td ${hex(s)} Tj ET`); };
  const right = (x: number, y: number, s: string, size = 10, bold = false) => text(x - amountWidth(s, size), y, s, size, bold);
  const rule  = (y: number, x1 = LEFT, x2 = RIGHT) => { ops.push(`0.8 G 0.6 w ${x1} ${y} m ${x2} ${y} l S 0 G`); };

  // Seller, top left. Title, top right.
  let y = PAGE_H - 64;
  text(LEFT, y, invoice.seller.name ?? "", 14, true);
  text(RIGHT - 70, y, "Factuur", 20, true);
  y -= 18;
  for (const line of [
    invoice.seller.addressLine,
    [invoice.seller.postalCode, invoice.seller.city].filter(Boolean).join(" "),
    `KvK ${invoice.seller.kvk}`,
    `Btw-nummer ${invoice.seller.vatNumber ?? ""}`,
    invoice.seller.email,
    invoice.seller.website,
  ]) { if (line) { text(LEFT, y, line, 9); y -= 12; } }

  // Customer left, the invoice's own facts right.
  y -= 22;
  const top = y;
  text(LEFT, y, "Factuur aan", 9, true);
  y -= 14;
  const lines = partyLines(invoice.customer);
  for (const line of lines.length ? lines : ["(geen factuurgegevens ingevuld)"]) { text(LEFT, y, line, 10); y -= 13; }

  let fy = top;
  for (const [label, value] of [
    ["Factuurnummer", invoice.number],
    ["Factuurdatum",  dutchDate(invoice.issuedAt)],
  ] as const) {
    text(350, fy, label, 9, true);
    text(440, fy, value, 10);
    fy -= 14;
  }

  // The line, and the sum under it.
  y = Math.min(y, fy) - 26;
  text(LEFT, y, "Omschrijving", 9, true);
  right(RIGHT, y, "Bedrag", 9, true);
  y -= 6; rule(y); y -= 16;
  const described = wrap(invoice.description, 70);
  described.forEach((line, i) => {
    text(LEFT, y, line, 10);
    if (i === 0) right(RIGHT, y, euro(invoice.netCents), 10);
    y -= 13;
  });
  y -= 3; rule(y); y -= 18;

  for (const [label, cents, bold] of [
    ["Subtotaal", invoice.netCents, false],
    [`Btw ${rate(invoice.vatRateBp)}`, invoice.vatCents, false],
    ["Totaal", invoice.grossCents, true],
  ] as const) {
    if (bold) { rule(y + 11, 350); y -= 4; }
    text(350, y, label, bold ? 11 : 10, bold);
    right(RIGHT, y, euro(cents), bold ? 11 : 10, bold);
    y -= 16;
  }

  y -= 14;
  if (invoice.vatNote) { for (const line of wrap(invoice.vatNote, 95)) { text(LEFT, y, line, 9); y -= 12; } y -= 6; }
  text(LEFT, y, invoice.paidAt
    ? `Voldaan op ${dutchDate(invoice.paidAt)}.`
    : "Het bedrag wordt met je machtiging van je rekening afgeschreven. Je hoeft niets over te maken.", 9);

  // ── Assemble ────────────────────────────────────────────────────────────────
  const content = ops.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  // Everything written is ASCII (text is in hex), so a character is a byte and
  // the offsets in the table are simply string lengths.
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i);
  return bytes;
}
