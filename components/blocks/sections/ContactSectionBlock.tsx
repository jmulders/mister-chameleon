/**
 * ContactSectionBlock
 *
 * Renders a `contactSection` page section — contact details (address, phone,
 * email, hours) alongside optional CTAs and a map embed or link.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      ContactSectionBlockData  { heading?, description?, address?,
 *                                        phone?, email?, hours?, mapUrl?, ctas? }
 *   variant   ContactSectionVariant    see below
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   contact_default — stacked contact detail cards on a subtle-bg section (default)
 *   contact_split   — contact details left, map / illustration right
 *   contact_minimal — compact inline contact row; no section background
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --section-subtle-bg     Section background
 *   --section-subtle-border Section border
 *   --card-bg               Detail card background
 *   --card-border           Detail card border colour
 *   --card-radius           Detail card border-radius
 *   --primary               Icon accent colour
 *   --font-heading          Heading font family
 *   --font-heading-weight   Heading font weight
 */

import { Container }          from "@/components/primitives/Container";
import { Section }            from "@/components/primitives/Section";
import { Stack }              from "@/components/primitives/Stack";
import { Text }               from "@/components/primitives/Text";
import { CTAGroup }           from "@/components/molecules";
import { resolveBlockVariant } from "@/page-config/block-variants";
import type { ContactSectionVariant } from "@/page-config/block-variants";
import type { ContactSectionBlockData } from "@/page-config";
import { resolveSurface, type BlockSurface } from "@/lib/surface";

interface ContactSectionBlockProps {
  data:     ContactSectionBlockData;
  variant?: string;
  surface?: BlockSurface;
}

// ── Contact detail icons ───────────────────────────────────────────────────────

function AddressIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

// ── Detail item ───────────────────────────────────────────────────────────────

function DetailItem({
  icon,
  label,
  value,
  href,
}: {
  icon:   React.ReactNode;
  label:  string;
  value:  string;
  href?:  string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="mt-0.5 shrink-0"
        style={{ color: "var(--primary)" }}
      >
        {icon}
      </div>
      <div>
        <Text variant="caption" color="muted" className="uppercase tracking-wider mb-0.5">
          {label}
        </Text>
        {href ? (
          <a
            href={href}
            className="text-sm font-medium hover:underline"
          >
            {value}
          </a>
        ) : (
          <Text variant="body-sm" className="font-medium whitespace-pre-line">
            {value}
          </Text>
        )}
      </div>
    </div>
  );
}

// ── Contact details ────────────────────────────────────────────────────────────

function ContactDetails({ data }: { data: ContactSectionBlockData }) {
  const { address, phone, email, hours, ctas } = data;
  return (
    <Stack gap={5}>
      {address  && <DetailItem icon={<AddressIcon />} label="Address" value={address} />}
      {phone    && <DetailItem icon={<PhoneIcon />}   label="Phone"   value={phone}   href={`tel:${phone.replace(/\s/g, "")}`} />}
      {email    && <DetailItem icon={<EmailIcon />}   label="Email"   value={email}   href={`mailto:${email}`} />}
      {hours    && <DetailItem icon={<ClockIcon />}   label="Hours"   value={hours} />}
      {ctas && ctas.length > 0 && (
        <div className="pt-2">
          <CTAGroup ctas={ctas} size="md" />
        </div>
      )}
    </Stack>
  );
}

// ── Map panel ─────────────────────────────────────────────────────────────────

function MapPanel({ mapUrl }: { mapUrl: string }) {
  // Detect embed URLs (iframes) vs. plain map links
  const isEmbed = mapUrl.includes("google.com/maps/embed") || mapUrl.includes("maps.google.com/maps");

  if (isEmbed) {
    return (
      <div
        className="flex-1 overflow-hidden"
        style={{ borderRadius: "var(--card-radius)", minHeight: "280px" }}
      >
        <iframe
          src={mapUrl}
          title="Map"
          className="h-full w-full border-0"
          style={{ minHeight: "280px" }}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    );
  }

  return (
    <a
      href={mapUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-1 items-center justify-center rounded-xl border p-8 text-sm font-medium transition-colors hover:border-current"
      style={{
        backgroundColor: "var(--section-subtle-bg)",
        borderColor:     "var(--section-subtle-border)",
        borderRadius:    "var(--card-radius)",
        minHeight:       "200px",
      }}
    >
      <span style={{ color: "var(--primary)" }}>View on map →</span>
    </a>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ContactSectionBlock({ data, variant: rawVariant, surface }: ContactSectionBlockProps) {
  const variant = resolveBlockVariant("contactSection", rawVariant) as ContactSectionVariant;
  const { heading, description, mapUrl } = data;

  const sectionHeader = (heading || description) ? (
    <Stack gap={3}>
      {heading && (
        <Text
          variant="h2"
          balance
          style={{ fontFamily: "var(--font-heading)", fontWeight: "var(--font-heading-weight)" }}
        >
          {heading}
        </Text>
      )}
      {description && (
        <Text variant="body" color="muted" className="max-w-xl">
          {description}
        </Text>
      )}
    </Stack>
  ) : null;

  // ── contact_minimal ──────────────────────────────────────────────────────────
  if (variant === "contact_minimal") {
    return (
      <Section spacing="md" style={{ background: resolveSurface(surface) ?? "var(--bg)" }}>
        <Container size="lg">
          <div className="flex flex-wrap items-center gap-6">
            {data.phone && (
              <a
                href={`tel:${data.phone.replace(/\s/g, "")}`}
                className="flex items-center gap-2 text-sm font-medium hover:underline"
              >
                <span style={{ color: "var(--primary)" }}><PhoneIcon /></span>
                {data.phone}
              </a>
            )}
            {data.email && (
              <a
                href={`mailto:${data.email}`}
                className="flex items-center gap-2 text-sm font-medium hover:underline"
              >
                <span style={{ color: "var(--primary)" }}><EmailIcon /></span>
                {data.email}
              </a>
            )}
            {data.address && (
              <span className="flex items-center gap-2 text-sm">
                <span style={{ color: "var(--primary)" }}><AddressIcon /></span>
                {data.address}
              </span>
            )}
          </div>
        </Container>
      </Section>
    );
  }

  // ── contact_split ────────────────────────────────────────────────────────────
  if (variant === "contact_split") {
    return (
      <Section
        spacing="xl"
        className="border-y"
        style={{
          background:        resolveSurface(surface) ?? "var(--section-subtle-bg)",
          borderTopColor:    "var(--section-subtle-border)",
          borderBottomColor: "var(--section-subtle-border)",
        }}
      >
        <Container size="lg">
          <Stack gap={10}>
            {sectionHeader}
            <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-16">
              <div className="flex-1">
                <ContactDetails data={data} />
              </div>
              {mapUrl && (
                <div className="flex-1">
                  <MapPanel mapUrl={mapUrl} />
                </div>
              )}
            </div>
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── contact_default ──────────────────────────────────────────────────────────
  return (
    <Section
      spacing="xl"
      className="border-y"
      style={{
        background:        resolveSurface(surface) ?? "var(--section-subtle-bg)",
        borderTopColor:    "var(--section-subtle-border)",
        borderBottomColor: "var(--section-subtle-border)",
      }}
    >
      <Container size="md">
        <Stack gap={10}>
          {sectionHeader}
          <div
            className="rounded-xl border p-8 sm:p-10"
            style={{
              backgroundColor: "var(--card-bg, white)",
              borderColor:     "var(--card-border)",
              borderRadius:    "var(--card-radius)",
            }}
          >
            <ContactDetails data={data} />
          </div>
          {mapUrl && <MapPanel mapUrl={mapUrl} />}
        </Stack>
      </Container>
    </Section>
  );
}
