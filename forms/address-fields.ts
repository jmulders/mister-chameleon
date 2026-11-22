/**
 * Address fields a tenant adds to a form.
 *
 * The built-in forms (contact, application, appointment) are the same for every
 * tenant. A tenant that wants to know where a visitor is located can add a
 * postcode and a house-number field to one of its forms, without that form
 * changing for anyone else. The setting lives in the per-form override
 * (`addressFields`, see tenant/types.ts) and is honoured like the layout:
 * whether or not the override's master toggle is on.
 *
 * The two fields get the keys the address lookup looks for, so the form fills
 * in the address by itself and checks it (lib/forms/address-lookup.ts).
 *
 * Pure: no I/O.
 */

import type { FormField } from "./types";
import type { SiteLocale } from "@/lib/site-texts/locale";
import { addressFieldKeys } from "@/lib/forms/address-lookup";

export type AddressFieldsMode = "optional" | "required";

/** Reads the stored setting. Anything else than the two modes means "off". */
export function parseAddressFieldsMode(raw: unknown): AddressFieldsMode | undefined {
  return raw === "optional" || raw === "required" ? raw : undefined;
}

const COPY: Record<"en" | "nl", { postcode: string; houseNumber: string }> = {
  en: { postcode: "Postcode", houseNumber: "House number" },
  nl: { postcode: "Postcode", houseNumber: "Huisnummer" },
};

/**
 * Returns the form's fields with a postcode and a house-number field added.
 *
 * They go in front of the first textarea (the message), so the short fields
 * stay together, or at the end when the form has none. A form that already has
 * both a postcode and a house-number field is returned as it is.
 */
export function withAddressFields(
  fields: readonly FormField[],
  mode: AddressFieldsMode | undefined,
  locale: SiteLocale = "en",
): readonly FormField[] {
  if (!mode) return fields;
  if (addressFieldKeys(fields.map((f) => f.key))) return fields;

  const copy = locale === "nl" ? COPY.nl : COPY.en;
  const required = mode === "required";
  const taken = new Set(fields.map((f) => f.key));
  const extra: FormField[] = [];
  if (!taken.has("postcode")) {
    extra.push({
      key: "postcode", type: "text", label: copy.postcode, placeholder: "1234 AB",
      validation: { required, maxLength: 12 },
    });
  }
  if (!taken.has("huisnummer")) {
    extra.push({
      key: "huisnummer", type: "text", label: copy.houseNumber, placeholder: "12",
      validation: { required, maxLength: 10 },
    });
  }

  const at = fields.findIndex((f) => f.type === "textarea");
  return at === -1 ? [...fields, ...extra] : [...fields.slice(0, at), ...extra, ...fields.slice(at)];
}
