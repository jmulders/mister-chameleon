/**
 * Site texts for forms: the form section, the newsletter signup, the apply
 * panel, the floating contact rail and the ROI calculator.
 *
 * Only the platform's own texts live here. A title, label or thank-you message
 * that comes from the CMS or from the tenant's form settings always wins. The
 * Dutch copy of the built-in form types (contact, application, appointment,
 * newsletter) sits next to their definitions in forms/definitions/dutch.ts.
 */

import type { SiteTexts } from "./locale";

export interface FormTexts {
  /** Submit button when the CMS gives no label. */
  submit:       string;
  /** Submit button while the form is being sent. */
  sending:      string;
  /** First, disabled option of a select without its own placeholder. */
  selectOption: string;
  /** Banner above the fields after a failed validation round. */
  errorSummary: (count: number) => string;

  /** The response was not understood, or the server gave no reason. */
  submissionFailed: string;
  networkError:     string;
  /** Thank-you text when neither the CMS, the tenant nor the form has one. */
  defaultSuccess:   string;

  /** Answers of POST /api/forms/[formKey] that the visitor gets to see. */
  server: {
    received:           string;
    /** Something broke on our side (HTTP 500). */
    error:              string;
    tooManySubmissions: string;
    captchaFailed:      string;
  };

  /** Field errors, shown under the field they belong to. */
  validation: {
    required:  (label: string) => string;
    email:     (label: string) => string;
    url:       (label: string) => string;
    minLength: (label: string, min: number) => string;
    maxLength: (label: string, max: number) => string;
    pattern:   (label: string) => string;
  };

  newsletter: {
    formLabel:        string;
    emailLabel:       string;
    emailPlaceholder: string;
    subscribe:        string;
    subscribing:      string;
    invalidEmail:     string;
  };

  applyPanel: {
    heading:        string;
    submit:         string;
    closesToday:    string;
    closesTomorrow: string;
    closesIn:       (days: number) => string;
    noLink:         string;
  };

  floatingContact: {
    railLabel: string;
    call:      string;
    mail:      string;
    whatsapp:  string;
  };

  roi: {
    sectionLabel:   string;
    /** BCP 47 tag for the thousands and decimal separators. */
    numberLocale:   string;
    visitors:       string;
    conversionRate: string;
    contractValue:  string;
    liftScenario:   string;
    lift: { conservative: string; moderate: string; aggressive: string };
    resultsHeading:       string;
    currentConversions:   string;
    projectedConversions: string;
    extraConversions:     string;
    extraPipeline:        string;
    annualLift:           string;
    roiVsPlan:            string;
    perMonth:             (multiple: string) => string;
    cta:                  string;
    note:                 (planPrice: string) => string;
  };
}

export const FORM_TEXTS: SiteTexts<FormTexts> = {
  en: {
    submit:       "Submit",
    sending:      "Sending…",
    selectOption: "Select an option",
    errorSummary: (count) => `Please correct ${count} ${count === 1 ? "error" : "errors"} below.`,

    submissionFailed: "Submission failed. Please try again.",
    networkError:     "Network error. Please check your connection and try again.",
    defaultSuccess:   "Thank you. Your submission has been received.",

    server: {
      received:           "Thank you — your submission has been received.",
      error:              "Server error",
      tooManySubmissions: "Too many submissions. Please try again later.",
      captchaFailed:      "Captcha verification failed. Please try again.",
    },

    validation: {
      required:  (label) => `${label} is required.`,
      email:     (label) => `${label} must be a valid email address.`,
      url:       (label) => `${label} must be a valid URL starting with http:// or https://.`,
      minLength: (label, min) => `${label} must be at least ${min} characters.`,
      maxLength: (label, max) => `${label} must be no more than ${max} characters.`,
      pattern:   (label) => `${label} has an invalid format.`,
    },

    newsletter: {
      formLabel:        "Newsletter signup",
      emailLabel:       "Email address",
      emailPlaceholder: "Enter your email",
      subscribe:        "Subscribe",
      subscribing:      "Subscribing...",
      invalidEmail:     "Please enter a valid email address.",
    },

    applyPanel: {
      heading:        "Apply for this role",
      submit:         "Submit application",
      closesToday:    "Applications close today.",
      closesTomorrow: "Applications close tomorrow.",
      closesIn:       (days) => `Applications close in ${days} days.`,
      noLink:         "No application link configured.",
    },

    floatingContact: {
      railLabel: "Contact",
      call:      "Call us",
      mail:      "Email us",
      whatsapp:  "WhatsApp",
    },

    roi: {
      sectionLabel:   "ROI Calculator",
      numberLocale:   "en-GB",
      visitors:       "Monthly visitors",
      conversionRate: "Current conversion rate",
      contractValue:  "Average contract value",
      liftScenario:   "Lift scenario",
      lift: {
        conservative: "Conservative (25%)",
        moderate:     "Moderate (35%)",
        aggressive:   "Aggressive (50%)",
      },
      resultsHeading:       "Your projected results",
      currentConversions:   "Current monthly conversions",
      projectedConversions: "Projected monthly conversions",
      extraConversions:     "Extra conversions / month",
      extraPipeline:        "Extra pipeline / month",
      annualLift:           "Annual revenue lift",
      roiVsPlan:            "ROI vs Growth plan",
      perMonth:             (multiple) => `${multiple}× / month`,
      cta:                  "Start growing — talk to us",
      note:                 (planPrice) => `Based on Growth plan at ${planPrice}/month • No commitment required`,
    },
  },

  nl: {
    submit:       "Verstuur",
    sending:      "Bezig…",
    selectOption: "Maak een keuze",
    errorSummary: (count) =>
      count === 1
        ? "Er klopt nog 1 veld niet. Kijk hieronder."
        : `Er kloppen nog ${count} velden niet. Kijk hieronder.`,

    submissionFailed: "Versturen is niet gelukt. Probeer het opnieuw.",
    networkError:     "Geen verbinding. Controleer je internet en probeer het opnieuw.",
    defaultSuccess:   "Bedankt. Je gegevens zijn verstuurd.",

    server: {
      received:           "Bedankt. Je gegevens zijn verstuurd.",
      error:              "Er ging iets mis. Probeer het later opnieuw.",
      tooManySubmissions: "Je hebt dit formulier te vaak verstuurd. Probeer het later opnieuw.",
      captchaFailed:      "De controle is niet gelukt. Probeer het opnieuw.",
    },

    validation: {
      required:  (label) => `${label} is verplicht.`,
      email:     () => "Vul een geldig e-mailadres in.",
      url:       () => "Vul een link in die begint met http:// of https://.",
      minLength: (_label, min) => `Vul minstens ${min} tekens in.`,
      maxLength: (_label, max) => `Gebruik hooguit ${max} tekens.`,
      pattern:   () => "Dit klopt nog niet. Controleer wat je hebt ingevuld.",
    },

    newsletter: {
      formLabel:        "Aanmelden voor de nieuwsbrief",
      emailLabel:       "E-mailadres",
      emailPlaceholder: "Je e-mailadres",
      subscribe:        "Aanmelden",
      subscribing:      "Bezig…",
      invalidEmail:     "Vul een geldig e-mailadres in.",
    },

    applyPanel: {
      heading:        "Solliciteer op deze functie",
      submit:         "Verstuur sollicitatie",
      closesToday:    "Solliciteren kan tot en met vandaag.",
      closesTomorrow: "Solliciteren kan tot en met morgen.",
      closesIn:       (days) => `Solliciteren kan nog ${days} dagen.`,
      noLink:         "Er is nog geen sollicitatielink ingesteld.",
    },

    floatingContact: {
      railLabel: "Contact",
      call:      "Bel ons",
      mail:      "Mail ons",
      whatsapp:  "WhatsApp",
    },

    roi: {
      sectionLabel:   "ROI-calculator",
      numberLocale:   "nl-NL",
      visitors:       "Bezoekers per maand",
      conversionRate: "Huidig conversiepercentage",
      contractValue:  "Gemiddelde contractwaarde",
      liftScenario:   "Groeiscenario",
      lift: {
        conservative: "Voorzichtig (25%)",
        moderate:     "Gemiddeld (35%)",
        aggressive:   "Ambitieus (50%)",
      },
      resultsHeading:       "Jouw verwachte resultaat",
      currentConversions:   "Conversies per maand nu",
      projectedConversions: "Verwachte conversies per maand",
      extraConversions:     "Extra conversies per maand",
      extraPipeline:        "Extra pipeline per maand",
      annualLift:           "Extra omzet per jaar",
      roiVsPlan:            "ROI tegenover het Growth-abonnement",
      perMonth:             (multiple) => `${multiple}× per maand`,
      cta:                  "Neem contact op",
      note:                 (planPrice) => `Gerekend met het Growth-abonnement van ${planPrice} per maand • Je zit nergens aan vast`,
    },
  },
};
