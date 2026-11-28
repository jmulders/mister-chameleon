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
  /** The confirmation mail could not be sent, so the signup cannot go on. */
  mailDown:        string;
  // ── The page behind the link in the confirmation mail ──────────────────────
  /** The browser tab of the confirmation page, whatever the outcome. */
  confirmPageTitle: string;
  confirmedTitle:  string;
  confirmedBody:   string;
  alreadyTitle:    string;
  alreadyBody:     string;
  expiredTitle:    string;
  expiredBody:     string;
  invalidTitle:    string;
  invalidBody:     string;
  failedTitle:     string;
  failedBody:      string;
  logIn:           string;
  signUpAgain:     string;
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
    mailDown:        "We konden je geen bevestigingsmail sturen. Probeer het later opnieuw, of mail ons.",
    confirmPageTitle: "Je proefperiode",
    confirmedTitle:  "Je proefperiode is begonnen",
    confirmedBody:   "Je e-mailadres is bevestigd en je account staat klaar. Log in met het e-mailadres en het wachtwoord waarmee je je aanmeldde.",
    alreadyTitle:    "Je account staat al klaar",
    alreadyBody:     "Deze link is al gebruikt. Je kunt gewoon inloggen.",
    expiredTitle:    "Deze link is verlopen",
    expiredBody:     "De link in de mail werkt 48 uur. Meld je opnieuw aan, dan krijg je een nieuwe.",
    invalidTitle:    "Deze link werkt niet",
    invalidBody:     "De link is niet compleet of niet van ons. Kopieer hem opnieuw uit de mail, of meld je opnieuw aan.",
    failedTitle:     "Je account kon niet worden aangemaakt",
    failedBody:      "Bestaat er al een account met dit e-mailadres? Log dan in. Lukt het niet, mail ons dan en we helpen je verder.",
    logIn:           "Log in",
    signUpAgain:     "Meld je opnieuw aan",
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
    mailDown:        "We could not send you a confirmation mail. Please try again later, or mail us.",
    confirmPageTitle: "Your trial",
    confirmedTitle:  "Your trial has started",
    confirmedBody:   "Your e-mail address is confirmed and your account is ready. Log in with the e-mail address and the password you signed up with.",
    alreadyTitle:    "Your account is ready",
    alreadyBody:     "This link was used before. You can simply log in.",
    expiredTitle:    "This link has expired",
    expiredBody:     "The link in the mail works for 48 hours. Sign up again and you get a new one.",
    invalidTitle:    "This link does not work",
    invalidBody:     "The link is incomplete or not ours. Copy it again from the mail, or sign up again.",
    failedTitle:     "Your account could not be created",
    failedBody:      "Is there already an account with this e-mail address? Then log in. If that does not help, mail us and we will sort it out.",
    logIn:           "Log in",
    signUpAgain:     "Sign up again",
  },
};
