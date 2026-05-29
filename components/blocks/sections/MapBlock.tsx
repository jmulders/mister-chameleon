/**
 * MapBlock
 *
 * Renders a `mapBlock` page section — a Google Maps embed alongside office
 * address and contact details.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      MapBlockData   { heading?, address?, city?, country?,
 *                              email?, phone?, embedUrl? }
 *   variant   string         "default" (only variant for now)
 *
 * ─── Layout ──────────────────────────────────────────────────────────────────
 *
 *   Desktop: left 2/3 = Google Maps iframe, right 1/3 = address + contact
 *   Mobile:  stacked — map first, then contact details
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --text              Body text colour
 *   --text-muted        Secondary / muted text colour
 *   --bg-subtle         Section background
 *   --card-border       Border colour for the info panel
 */

import type React          from "react";
import { Container }        from "@/components/primitives/Container";
import { Section }          from "@/components/primitives/Section";
import type { MapBlockData } from "@/page-config";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_EMBED_URL =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d39036.34844027267!2d4.880151!3d52.373082!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47c609c7f8d7d3bb%3A0x1fafca0e7d63ed40!2sKeizersgracht%20125%2C%201015%20CJ%20Amsterdam%2C%20Netherlands!5e0!3m2!1sen!2snl!4v1234567890";

const DEFAULT_ADDRESS = "Keizersgracht 125, 1015 CJ Amsterdam, Netherlands";
const DEFAULT_EMAIL   = "hello@misterchameleon.io";
const DEFAULT_PHONE   = "+31 20 123 4567";

// ─── Props ────────────────────────────────────────────────────────────────────

interface MapBlockProps {
  data:     MapBlockData;
  variant?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MapBlock({ data }: MapBlockProps) {
  const embedUrl = data.embedUrl ?? DEFAULT_EMBED_URL;

  const address = data.address
    ? [data.address, data.city, data.country].filter(Boolean).join(", ")
    : DEFAULT_ADDRESS;

  const email = data.email ?? DEFAULT_EMAIL;
  const phone = data.phone ?? DEFAULT_PHONE;

  return (
    <Section>
      <Container>
        {data.heading && (
          <h2
            style={{
              fontFamily:   "var(--font-heading, inherit)",
              fontWeight:   "var(--font-heading-weight, 700)" as React.CSSProperties["fontWeight"],
              fontSize:     "clamp(1.5rem, 3vw, 2.25rem)",
              color:        "var(--text)",
              marginBottom: "2rem",
              lineHeight:   1.2,
            }}
          >
            {data.heading}
          </h2>
        )}

        {/* Two-column layout — map (2/3) + details (1/3) */}
        <div
          style={{
            display:             "grid",
            gridTemplateColumns: "2fr 1fr",
            gap:                 "2rem",
            alignItems:          "stretch",
          }}
          className="map-block-grid"
        >
          {/* Map iframe */}
          <div
            style={{
              borderRadius: "var(--card-radius, 0.75rem)",
              overflow:     "hidden",
              height:       "420px",
              border:       "1px solid var(--card-border, #e5e7eb)",
              flexShrink:   0,
            }}
          >
            <iframe
              src={embedUrl}
              width="100%"
              height="420"
              style={{ border: 0, display: "block" }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Office location map"
            />
          </div>

          {/* Contact details panel */}
          <div
            style={{
              display:       "flex",
              flexDirection: "column",
              gap:           "1.5rem",
              padding:       "2rem",
              background:    "var(--bg-subtle, #f9fafb)",
              borderRadius:  "var(--card-radius, 0.75rem)",
              border:        "1px solid var(--card-border, #e5e7eb)",
            }}
          >
            {/* Address */}
            <div>
              <p
                style={{
                  fontWeight:   600,
                  fontSize:     "0.75rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color:         "var(--text-muted, #6b7280)",
                  marginBottom:  "0.375rem",
                }}
              >
                Address
              </p>
              <address
                style={{
                  fontStyle:  "normal",
                  color:      "var(--text, #111827)",
                  fontSize:   "0.9375rem",
                  lineHeight: 1.6,
                }}
              >
                {address}
              </address>
            </div>

            {/* Email */}
            <div>
              <p
                style={{
                  fontWeight:   600,
                  fontSize:     "0.75rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color:         "var(--text-muted, #6b7280)",
                  marginBottom:  "0.375rem",
                }}
              >
                Email
              </p>
              <a
                href={`mailto:${email}`}
                style={{
                  color:          "var(--primary, #4f46e5)",
                  textDecoration: "none",
                  fontSize:       "0.9375rem",
                }}
              >
                {email}
              </a>
            </div>

            {/* Phone */}
            <div>
              <p
                style={{
                  fontWeight:   600,
                  fontSize:     "0.75rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color:         "var(--text-muted, #6b7280)",
                  marginBottom:  "0.375rem",
                }}
              >
                Phone
              </p>
              <a
                href={`tel:${phone.replace(/\s/g, "")}`}
                style={{
                  color:          "var(--text, #111827)",
                  textDecoration: "none",
                  fontSize:       "0.9375rem",
                }}
              >
                {phone}
              </a>
            </div>
          </div>
        </div>

        {/* Responsive styles — stack on mobile */}
        <style>{`
          @media (max-width: 767px) {
            .map-block-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </Container>
    </Section>
  );
}
