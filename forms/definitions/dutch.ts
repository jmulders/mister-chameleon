/**
 * Dutch copy for the built-in form types.
 *
 * The definitions in this folder are written in English and stay the single
 * source for the structure of a form: which fields, which validation, where the
 * mail goes. This file only carries the Dutch words for what a visitor reads:
 * title, intro, labels, placeholders, hints, the thank-you text and the
 * confirmation mail. The notification to the tenant's own inbox is not
 * translated.
 *
 * `localizeFormDefinition` lays that copy over a definition. A field that has no
 * Dutch entry keeps its English text, so a new field never disappears. Anything
 * the CMS or the tenant's form settings provide is applied later and still wins.
 *
 * `locatie-test` is written in Dutch already and has no entry here.
 */

import type { FormDefinition, FormField, FormKey } from "@/forms/types";
import type { SiteLocale } from "@/lib/site-texts/locale";

interface FieldCopy {
  readonly label:        string;
  readonly placeholder?: string;
  readonly helpText?:    string;
  /** Option value → label, for a select. */
  readonly options?:     Readonly<Record<string, string>>;
}

interface FormCopy {
  readonly title:          string;
  readonly description:    string;
  readonly fields:         Readonly<Record<string, FieldCopy>>;
  readonly successMessage: string;
  readonly confirmation:   { readonly subject: string; readonly body: string };
}

const NAME_FIELD:  FieldCopy = { label: "Je naam",     placeholder: "Jan de Vries" };
const EMAIL_FIELD: FieldCopy = { label: "E-mailadres", placeholder: "jan@voorbeeld.nl" };
const PHONE_HELP = "Optioneel. Zet bij een buitenlands nummer de landcode ervoor.";

const DUTCH_FORM_COPY: Partial<Record<FormKey, FormCopy>> = {
  contact: {
    title:       "Neem contact op",
    description: "Stuur ons een bericht. Je krijgt binnen één werkdag antwoord.",
    fields: {
      name:    NAME_FIELD,
      email:   EMAIL_FIELD,
      message: { label: "Bericht", placeholder: "Waarmee kunnen we je helpen?" },
    },
    successMessage: "Bedankt voor je bericht. We nemen snel contact met je op.",
    confirmation: {
      subject: "We hebben je bericht ontvangen",
      body:
        "Hallo {{name}},\n\n" +
        "Bedankt voor je bericht. We hebben het ontvangen en reageren binnen één werkdag.\n\n" +
        "Groet,\nHet team",
    },
  },

  application: {
    title:       "Solliciteer",
    description: "Vul het formulier in. We bekijken je sollicitatie zo snel mogelijk.",
    fields: {
      name:  { label: "Voor- en achternaam", placeholder: "Jan de Vries" },
      email: EMAIL_FIELD,
      phone: { label: "Telefoonnummer", placeholder: "+31 6 00 00 00 00", helpText: PHONE_HELP },
      position: {
        label:       "Functie waarop je solliciteert",
        placeholder: "Bijvoorbeeld Senior Frontend Developer",
      },
      coverLetter: {
        label:       "Motivatie",
        placeholder: "Vertel wie je bent, wat je ervaring is en waarom je bij ons past…",
      },
      linkedinUrl: {
        label:       "LinkedIn-profiel",
        placeholder: "https://linkedin.com/in/jouw-naam",
        helpText:    "Optioneel. Deel je LinkedIn als je wilt dat we meekijken.",
      },
      portfolioUrl: {
        label:       "Portfolio of eigen website",
        placeholder: "https://jouwsite.nl",
        helpText:    "Optioneel. Een link naar je werk, je GitHub-profiel of je eigen site.",
      },
    },
    successMessage: "Bedankt voor je sollicitatie. We nemen contact op als we een match zien.",
    confirmation: {
      subject: "We hebben je sollicitatie ontvangen",
      body:
        "Hallo {{name}},\n\n" +
        "Bedankt voor je sollicitatie op de functie {{position}}. We hebben hem ontvangen " +
        "en nemen contact op als we een match zien.\n\n" +
        "Groet,\nHet team",
    },
  },

  appointment: {
    title:       "Plan een kennismaking",
    description: "Vertel kort wie je bent. Dan nemen we contact op om een moment te plannen.",
    fields: {
      name:    NAME_FIELD,
      email:   EMAIL_FIELD,
      phone:   { label: "Telefoonnummer", placeholder: "+31 6 00 00 00 00", helpText: PHONE_HELP },
      company: { label: "Bedrijf of organisatie", placeholder: "Voorbeeld BV" },
      preferredTime: {
        label: "Welk dagdeel past je het best?",
        options: {
          "":        "Geen voorkeur",
          morning:   "Ochtend (09:00 tot 12:00)",
          afternoon: "Middag (12:00 tot 17:00)",
          evening:   "Begin van de avond (17:00 tot 19:00)",
        },
      },
      message: {
        label:       "Wil je ons vooraf iets laten weten?",
        placeholder: "Vertel kort over je situatie of wat je zoekt…",
      },
    },
    successMessage: "Bedankt. We nemen binnen één werkdag contact op om een moment te plannen.",
    confirmation: {
      subject: "We hebben je aanvraag ontvangen",
      body:
        "Hallo {{name}},\n\n" +
        "Bedankt voor je aanvraag voor een kennismaking. We nemen binnen één werkdag " +
        "contact op om een moment te kiezen.\n\n" +
        "Groet,\nHet team",
    },
  },

  newsletter: {
    title:       "Meld je aan voor onze nieuwsbrief",
    description: "Ontvang ons laatste nieuws in je inbox. Geen spam. Afmelden kan altijd.",
    fields: {
      email: EMAIL_FIELD,
    },
    successMessage: "Bedankt voor je aanmelding. Kijk in je inbox om te bevestigen.",
    confirmation: {
      subject: "Welkom bij onze nieuwsbrief",
      body:
        "Hallo,\n\n" +
        "Bedankt voor je aanmelding. Je ontvangt binnenkort ons nieuws.\n\n" +
        "Groet,\nHet team",
    },
  },
};

function localizeField(field: FormField, copy: FieldCopy | undefined): FormField {
  if (!copy) return field;
  const texts = {
    label:       copy.label,
    placeholder: copy.placeholder ?? field.placeholder,
    helpText:    copy.helpText    ?? field.helpText,
  };
  if (field.type === "select") {
    return {
      ...field,
      ...texts,
      options: field.options.map((option) => ({
        value: option.value,
        label: copy.options?.[option.value] ?? option.label,
      })),
    };
  }
  return { ...field, ...texts };
}

/**
 * The definition with its visitor-facing texts in the given language.
 * English, and any form without Dutch copy, comes back untouched.
 */
export function localizeFormDefinition(def: FormDefinition, locale: SiteLocale): FormDefinition {
  const copy = locale === "nl" ? DUTCH_FORM_COPY[def.key] : undefined;
  if (!copy) return def;

  const confirmation = def.emailRouting?.confirmation;

  return {
    ...def,
    title:       copy.title,
    description: copy.description,
    fields:      def.fields.map((field) => localizeField(field, copy.fields[field.key])),
    action:      { ...def.action, successMessage: copy.successMessage },
    emailRouting: def.emailRouting && {
      ...def.emailRouting,
      confirmation: confirmation && { ...confirmation, ...copy.confirmation },
    },
  };
}
