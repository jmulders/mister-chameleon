/**
 * FloatingContactBlock
 *
 * A small set of sticky contact buttons pinned to the side of the viewport —
 * phone, e-mail and WhatsApp — like the floating contact rail on many B2B
 * sites. Placed as a content block (per page) but renders as a `position: fixed`
 * overlay, so its position in the block list doesn't affect page flow.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data  FloatingContactBlockData
 *           phone?     E.164 or local number    → tel: link
 *           email?     address                  → mailto: link
 *           whatsapp?  number (any format)      → https://wa.me/<digits>
 *           side?      "right" | "left"         (default "right")
 *
 * Renders nothing when no channel is configured.
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --btn-bg          Button background (falls back to --primary)
 *   --btn-hover-bg    Hover background  (falls back to --primary-active)
 *   --primary-text    Icon colour on the button
 *   --card-radius     Corner rounding
 *
 * No client JavaScript: these are plain links, so this stays a server
 * component (lighter, no hydration).
 */

import type { CSSProperties, ReactNode } from "react";

export interface FloatingContactBlockData {
  phone?:    string;
  email?:    string;
  whatsapp?: string;
  side?:     "right" | "left";
}

interface ContactItem {
  href:     string;
  label:    string;
  icon:     ReactNode;
  external?: boolean;
}

function buildItems(data: FloatingContactBlockData): ContactItem[] {
  const items: ContactItem[] = [];
  if (data.phone) {
    items.push({ href: `tel:${data.phone.replace(/[^\d+]/g, "")}`, label: "Bel ons", icon: <PhoneIcon /> });
  }
  if (data.email) {
    items.push({ href: `mailto:${data.email}`, label: "Mail ons", icon: <MailIcon /> });
  }
  if (data.whatsapp) {
    const digits = data.whatsapp.replace(/[^\d]/g, "");
    items.push({ href: `https://wa.me/${digits}`, label: "WhatsApp", icon: <WhatsAppIcon />, external: true });
  }
  return items;
}

export function FloatingContactBlock({ data }: { data: FloatingContactBlockData }) {
  const items = buildItems(data);
  if (items.length === 0) return null;

  const side = data.side ?? "right";

  const railStyle: CSSProperties = {
    position:       "fixed",
    top:            "50%",
    [side]:         0,
    transform:      "translateY(-50%)",
    zIndex:         50,
    display:        "flex",
    flexDirection:  "column",
    gap:            2,
    // Round only the outer (viewport-facing) corners.
    ["--fc-radius" as string]: "var(--card-radius, 10px)",
  };

  const buttonStyle: CSSProperties = {
    display:         "flex",
    alignItems:      "center",
    justifyContent:  "center",
    width:           52,
    height:          52,
    background:      "var(--btn-bg, var(--primary, #1a2b88))",
    color:           "var(--primary-text, #fff)",
    boxShadow:       "0 2px 8px rgba(0,0,0,0.18)",
    transition:      "background 0.15s",
  };

  return (
    <aside aria-label="Contact" style={railStyle}>
      {items.map((item, i) => {
        const corner = side === "right" ? "Left" : "Right";
        const style: CSSProperties = {
          ...buttonStyle,
          [`borderTop${corner}Radius`]:    i === 0 ? "var(--fc-radius)" : undefined,
          [`borderBottom${corner}Radius`]: i === items.length - 1 ? "var(--fc-radius)" : undefined,
        };
        return (
          <a
            key={item.label}
            href={item.href}
            aria-label={item.label}
            title={item.label}
            style={style}
            {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {item.icon}
          </a>
        );
      })}
    </aside>
  );
}

// ── Icons (inline, currentColor) ────────────────────────────────────────────

function PhoneIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 0 1 8.413 3.488 11.82 11.82 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.978-1.207zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413z" />
    </svg>
  );
}
