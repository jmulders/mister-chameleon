/**
 * What a visitor reads when starting a trial goes wrong.
 *
 * The two trial routes answer with `{ error }`, and the checkout form shows
 * that text as it is. So these are site texts, not log lines.
 */

import type { SiteTexts } from "./locale";

export type TrialTexts = {
  invalidRequest:  string;
  nameRequired:    string;
  emailRequired:   string;
  companyRequired: string;
  invalidPlan:     string;
  /** The country is not one of the codes the form offers. */
  countryInvalid:  string;
  /** A VAT number that is none, or that belongs to another country. */
  vatNumberInvalid: string;
  accountExists:   string;
  tryAgain:        string;
  paymentDown:     string;
  paymentError:    string;
  accountFailed:   string;
};

export const TRIAL_TEXTS: SiteTexts<TrialTexts> = {
  nl: {
    invalidRequest:  "Er ging iets mis met het formulier. Laad de pagina opnieuw en probeer het nog eens.",
    nameRequired:    "Vul je naam in.",
    emailRequired:   "Vul een geldig e-mailadres in.",
    companyRequired: "Vul je bedrijfsnaam in.",
    invalidPlan:     "Dit pakket bestaat niet. Kies een pakket op de prijspagina.",
    countryInvalid:  "Kies een land.",
    vatNumberInvalid: "Dit btw-nummer klopt niet of hoort niet bij het land dat je koos. Het begint met twee letters, bijvoorbeeld NL123456789B01.",
    accountExists:   "Er bestaat al een account met dit e-mailadres. Log in met dat account.",
    tryAgain:        "Er ging iets mis. Probeer het opnieuw.",
    paymentDown:     "Betalen lukt op dit moment niet. Mail ons, dan helpen we je verder.",
    paymentError:    "Het betaalscherm kon niet worden geopend. Probeer het opnieuw.",
    accountFailed:   "Je account kon niet worden aangemaakt. Probeer het opnieuw.",
  },
  en: {
    invalidRequest:  "Invalid JSON body",
    nameRequired:    "Full name is required.",
    emailRequired:   "A valid email address is required.",
    companyRequired: "Company name is required.",
    invalidPlan:     "Invalid plan.",
    countryInvalid:  "Choose a country.",
    vatNumberInvalid: "This VAT number is not valid or does not belong to the country you chose. It starts with two letters, for example NL123456789B01.",
    accountExists:   "An account with this email address already exists. Please sign in instead.",
    tryAgain:        "Server error. Please try again.",
    paymentDown:     "Payment provider not configured. Contact support.",
    paymentError:    "Payment provider error. Please try again.",
    accountFailed:   "Failed to create account. Please try again.",
  },
};
