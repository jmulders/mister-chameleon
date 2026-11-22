/**
 * useAddressAutofill
 *
 * For a form with a postcode field and a house-number field: as soon as both
 * are filled in, look the address up and
 *   - fill in the street and the town, when the form has fields for them;
 *   - show the address under the house number, when it has not;
 *   - say so under the house number when the combination does not exist.
 *
 * A form without those two fields gets nothing from this hook.
 *
 * The fields are found by their keys (lib/forms/address-lookup.ts), so this
 * works for the built-in forms and for a form a tenant defined in the CMS.
 * The inputs are uncontrolled, like the rest of the form: values are read from
 * and written to the DOM, and the visitor can still change what was filled in.
 *
 * When the address register does not answer, nothing is shown and the form
 * works as it did without this hook.
 */

"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { addressFieldKeys, type AddressLookupResult } from "@/lib/forms/address-lookup";
import { normalizeHouseNumber, normalizePostcode } from "@/context/form-location-context";

/** Wait this long after the last keystroke before asking. */
const DEBOUNCE_MS = 350;

export interface AddressAutofill {
  /** Error per field key, shown like a validation error. */
  errors: Record<string, string>;
  /** Hint per field key, shown under the field. */
  hints:  Record<string, string>;
}

const NOTHING: AddressAutofill = { errors: {}, hints: {} };

function input(form: HTMLFormElement, key: string | undefined): HTMLInputElement | null {
  if (!key) return null;
  const el = form.elements.namedItem(key);
  return el instanceof HTMLInputElement ? el : null;
}

export function useAddressAutofill(
  formRef: RefObject<HTMLFormElement | null>,
  fieldKeys: readonly string[],
  notFoundText: string,
): AddressAutofill {
  const keysSignature = fieldKeys.join("|");
  const keys = useMemo(() => addressFieldKeys(keysSignature ? keysSignature.split("|") : []), [keysSignature]);
  const [state, setState] = useState<AddressAutofill>(NOTHING);

  // What this hook last wrote into the street and town fields, so a later
  // "not found" clears only its own work and never what the visitor typed.
  const filled = useRef<{ street: string; city: string } | null>(null);

  useEffect(() => {
    const form = formRef.current;
    if (!form || !keys) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let latest = 0;
    let asked = "";

    const clearOwnFill = () => {
      const was = filled.current;
      if (!was) return;
      const street = input(form, keys.street);
      const city   = input(form, keys.city);
      if (street && street.value === was.street) street.value = "";
      if (city && city.value === was.city) city.value = "";
      filled.current = null;
    };

    const lookup = async () => {
      const postcode    = normalizePostcode(input(form, keys.postcode)?.value);
      const houseNumber = normalizeHouseNumber(input(form, keys.houseNumber)?.value);
      if (!postcode || !houseNumber) {
        asked = "";
        setState(NOTHING);
        return;
      }
      const question = `${postcode}|${houseNumber}`;
      if (question === asked) return;
      asked = question;
      const mine = ++latest;

      let result: AddressLookupResult;
      try {
        const res = await fetch("/api/forms/address", {
          method:  "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body:    JSON.stringify({ postcode, houseNumber }),
        });
        result = res.ok ? ((await res.json()) as AddressLookupResult) : { status: "error" };
      } catch {
        result = { status: "error" };
      }
      // A newer question was asked while this one was on its way.
      if (mine !== latest) return;

      if (result.status === "ok") {
        const street = input(form, keys.street);
        const city   = input(form, keys.city);
        if (street) street.value = result.street;
        if (city)   city.value   = result.city;
        filled.current = { street: result.street, city: result.city };
        // With fields for it the answer is on screen already. Without, show it.
        const shown = street && city ? null : `${result.street} ${result.houseNumber}, ${result.city}`;
        setState({ errors: {}, hints: shown ? { [keys.houseNumber]: shown } : {} });
        return;
      }
      if (result.status === "not_found") {
        clearOwnFill();
        setState({ errors: { [keys.houseNumber]: notFoundText }, hints: {} });
        return;
      }
      // "error" or "invalid": say nothing, and ask again on the next change.
      asked = "";
      setState(NOTHING);
    };

    const onChange = (event: Event) => {
      const name = (event.target as HTMLInputElement | null)?.name;
      if (name !== keys.postcode && name !== keys.houseNumber) return;
      clearTimeout(timer);
      timer = setTimeout(() => { void lookup(); }, event.type === "change" ? 0 : DEBOUNCE_MS);
    };

    form.addEventListener("input", onChange);
    form.addEventListener("change", onChange);
    return () => {
      clearTimeout(timer);
      latest++;
      form.removeEventListener("input", onChange);
      form.removeEventListener("change", onChange);
    };
  }, [formRef, keys, notFoundText]);

  return state;
}
