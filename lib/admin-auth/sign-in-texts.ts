/**
 * The texts of the way in: sign in, the two-factor step, forgot password, set a
 * new password, and the email with the reset link.
 *
 * The admin itself is English. These four pages are different: a site links to
 * them from its own menu ("Inloggen" on misterchameleon.nl), so they speak the
 * language of the site the visitor came from. The owner asked for that on
 * 25 Nov 2026, right after the login link went into the menu.
 *
 * Dutch and English, like every other platform text on a site
 * (lib/site-texts). The language comes from getSiteLocale().
 */

import type { SiteTexts } from "@/lib/site-texts/locale";

/** The pages that speak the site's language, and carry it in <html lang>. */
export const SIGN_IN_PATHS = ["/admin/login", "/admin/forgot-password", "/admin/reset-password"] as const;

/** True for a sign-in page, sub-pages such as /admin/login/2fa included. */
export function isSignInPath(pathname: string): boolean {
  return SIGN_IN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export type SignInTexts = {
  // Shared by the four pages.
  email:            string;
  emailPlaceholder: string;
  backToSignIn:     string;
  sessionExpired:   string;

  // Sign in.
  signInHeading:      string;
  password:           string;
  signIn:             string;
  forgotPassword:     string;
  passwordWasReset:   string;
  invalidCredentials: string;
  tooManySignIns:     string;
  accountDisabled:    string;
  serverError:        string;

  // Two-factor step.
  twoFaHeading:      string;
  twoFaIntro:        string;
  twoFaCode:         string;
  twoFaVerify:       string;
  or:                string;
  useABackupCode:    string;
  backupCode:        string;
  backupCodeOnce:    string;
  useBackupCode:     string;
  invalidCode:       string;
  invalidBackupCode: string;
  tooManyAttempts:   string;
  unknownError:      string;

  // Forgot password.
  forgotHeading: string;
  forgotIntro:   string;
  sendLink:      string;
  linkSent:      string;

  // Set a new password.
  resetHeading:           string;
  linkInvalid:            string;
  requestNewLink:         string;
  newPassword:            string;
  newPasswordPlaceholder: string;
  confirmPassword:        string;
  confirmPlaceholder:     string;
  passwordRule:           string;
  setPassword:            string;
  mismatch:               string;
  weak:                   string;
  resetFailed:            string;

  // The email with the reset link.
  mailSubject:  string;
  mailGreeting: (name: string) => string;
  mailRequest:  string;
  mailLinkLead: string;
  mailLinkText: string;
  mailLinkNote: string;
  mailAfter:    string;
  mailIgnore:   string;
};

export const SIGN_IN_TEXTS: SiteTexts<SignInTexts> = {
  nl: {
    email:            "E-mailadres",
    emailPlaceholder: "jij@voorbeeld.nl",
    backToSignIn:     "Terug naar inloggen",
    sessionExpired:   "Je sessie is verlopen. Log opnieuw in.",

    signInHeading:      "Inloggen",
    password:           "Wachtwoord",
    signIn:             "Inloggen",
    forgotPassword:     "Wachtwoord vergeten?",
    passwordWasReset:   "Je wachtwoord is gewijzigd. Log in met je nieuwe wachtwoord.",
    invalidCredentials: "Het e-mailadres of het wachtwoord klopt niet. Probeer het opnieuw.",
    tooManySignIns:     "Te veel inlogpogingen. Wacht tien minuten en probeer het opnieuw.",
    accountDisabled:    "Dit account is uitgeschakeld. Neem contact op met de beheerder van het platform.",
    serverError:        "Er ging iets mis op de server. Probeer het zo opnieuw.",

    twoFaHeading:      "Tweestapsverificatie",
    twoFaIntro:        "Vul de code van zes cijfers in uit je authenticator-app.",
    twoFaCode:         "Code uit de app",
    twoFaVerify:       "Controleren",
    or:                "of",
    useABackupCode:    "Gebruik een back-upcode",
    backupCode:        "Back-upcode",
    backupCodeOnce:    "Elke back-upcode werkt maar één keer.",
    useBackupCode:     "Back-upcode gebruiken",
    invalidCode:       "Die code klopt niet of is verlopen. Probeer het opnieuw.",
    invalidBackupCode: "Die back-upcode is ongeldig of al gebruikt.",
    tooManyAttempts:   "Te veel pogingen. Wacht tien minuten en probeer het opnieuw.",
    unknownError:      "Er ging iets mis.",

    forgotHeading: "Wachtwoord opnieuw instellen",
    forgotIntro:   "Vul het e-mailadres van je account in. Je krijgt een link om je wachtwoord opnieuw in te stellen.",
    sendLink:      "Stuur de link",
    linkSent:      "Bestaat er een account met dat e-mailadres, dan is de link onderweg. De link is 45 minuten geldig.",

    resetHeading:           "Nieuw wachtwoord instellen",
    linkInvalid:            "Deze link is ongeldig of verlopen. Een link werkt één keer en is 45 minuten geldig.",
    requestNewLink:         "Vraag een nieuwe link aan",
    newPassword:            "Nieuw wachtwoord",
    newPasswordPlaceholder: "Minstens 12 tekens",
    confirmPassword:        "Herhaal je nieuwe wachtwoord",
    confirmPlaceholder:     "Vul je nieuwe wachtwoord nog een keer in",
    passwordRule:           "Gebruik minstens 12 tekens, met een hoofdletter, een kleine letter en een cijfer.",
    setPassword:            "Wachtwoord opslaan",
    mismatch:               "De wachtwoorden zijn niet gelijk.",
    weak:                   "Je wachtwoord moet minstens 12 tekens hebben, met een hoofdletter, een kleine letter en een cijfer.",
    resetFailed:            "Er ging iets mis. Probeer het opnieuw.",

    mailSubject:  "Stel je wachtwoord voor Mister Chameleon opnieuw in",
    mailGreeting: (name) => `Hoi ${name},`,
    mailRequest:  "We kregen een verzoek om het wachtwoord van je account bij Mister Chameleon opnieuw in te stellen.",
    mailLinkLead: "Dat doe je hier. De link is 45 minuten geldig en werkt één keer.",
    mailLinkText: "Stel je wachtwoord opnieuw in",
    mailLinkNote: "De link is 45 minuten geldig en werkt één keer.",
    mailAfter:    "Log daarna opnieuw in met je nieuwe wachtwoord. Gebruik je tweestapsverificatie, dan vul je ook die code in.",
    mailIgnore:   "Heb je dit niet aangevraagd? Dan kun je deze mail negeren. Je wachtwoord blijft hetzelfde.",
  },
  en: {
    email:            "Email address",
    emailPlaceholder: "you@example.com",
    backToSignIn:     "Back to sign in",
    sessionExpired:   "Your session has expired. Please sign in again.",

    signInHeading:      "Admin sign in",
    password:           "Password",
    signIn:             "Sign in",
    forgotPassword:     "Forgot password?",
    passwordWasReset:   "Your password has been reset. Sign in with your new password.",
    invalidCredentials: "Incorrect email or password. Please try again.",
    tooManySignIns:     "Too many sign-in attempts. Wait ten minutes and try again.",
    accountDisabled:    "This account has been deactivated. Contact your platform administrator.",
    serverError:        "A server error occurred. Please try again in a moment.",

    twoFaHeading:      "Two-factor authentication",
    twoFaIntro:        "Enter the 6-digit code from your authenticator app.",
    twoFaCode:         "Authenticator code",
    twoFaVerify:       "Verify",
    or:                "or",
    useABackupCode:    "Use a backup code",
    backupCode:        "Backup code",
    backupCodeOnce:    "Each backup code can only be used once.",
    useBackupCode:     "Use backup code",
    invalidCode:       "That code is incorrect or has expired. Please try again.",
    invalidBackupCode: "That backup code is not valid or has already been used.",
    tooManyAttempts:   "Too many attempts. Wait ten minutes and try again.",
    unknownError:      "An error occurred.",

    forgotHeading: "Reset your password",
    forgotIntro:   "Enter your admin email and we will send you a link to reset your password.",
    sendLink:      "Send reset link",
    linkSent:      "If an account exists for that email, a reset link is on its way. The link expires in 45 minutes.",

    resetHeading:           "Set a new password",
    linkInvalid:            "This reset link is invalid or has expired. Reset links are single-use and expire after 45 minutes.",
    requestNewLink:         "Request a new link",
    newPassword:            "New password",
    newPasswordPlaceholder: "At least 12 characters",
    confirmPassword:        "Confirm new password",
    confirmPlaceholder:     "Re-enter your new password",
    passwordRule:           "Use at least 12 characters with an uppercase letter, a lowercase letter, and a digit.",
    setPassword:            "Set new password",
    mismatch:               "The passwords do not match.",
    weak:                   "Password must be at least 12 characters and include an uppercase letter, a lowercase letter, and a digit.",
    resetFailed:            "Something went wrong. Please try again.",

    mailSubject:  "Reset your Mister Chameleon admin password",
    mailGreeting: (name) => `Hi ${name},`,
    mailRequest:  "We received a request to reset your Mister Chameleon admin password.",
    mailLinkLead: "Reset it here (this link expires in 45 minutes and can be used once):",
    mailLinkText: "Reset your password",
    mailLinkNote: "(this link expires in 45 minutes and can be used once).",
    mailAfter:    "After resetting, sign in again with your new password and, if enabled, your two-factor code.",
    mailIgnore:   "If you did not request this, you can safely ignore this email; your password stays unchanged.",
  },
};

// ── Lookups for the codes the actions put in the URL ─────────────────────────

/** The text for `?error=` on /admin/login, or null for no or an unknown code. */
export function signInError(t: SignInTexts, code: string | undefined): string | null {
  switch (code) {
    case "invalid_credentials": return t.invalidCredentials;
    case "too_many_attempts":   return t.tooManySignIns;
    case "account_disabled":    return t.accountDisabled;
    case "session_expired":     return t.sessionExpired;
    case "server_error":        return t.serverError;
    default:                    return null;
  }
}

/** The text for `?error=` on /admin/login/2fa. An unknown code still says something. */
export function twoFaError(t: SignInTexts, code: string | undefined): string | null {
  switch (code) {
    case undefined:
    case "":                    return null;
    case "invalid_code":        return t.invalidCode;
    case "invalid_backup_code": return t.invalidBackupCode;
    case "session_expired":     return t.sessionExpired;
    case "too_many_attempts":   return t.tooManyAttempts;
    default:                    return t.unknownError;
  }
}

/** The text for `?error=` on /admin/reset-password, or null. */
export function resetError(t: SignInTexts, code: string | undefined): string | null {
  switch (code) {
    case "mismatch": return t.mismatch;
    case "weak":     return t.weak;
    case "server":   return t.resetFailed;
    default:         return null;
  }
}

// ── The email with the reset link ────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
  ));
}

/** Subject, plain text and HTML of the reset mail. The name and link are escaped in the HTML. */
export function resetMail(t: SignInTexts, name: string, link: string): { subject: string; text: string; html: string } {
  const text =
    `${t.mailGreeting(name)}\n\n` +
    `${t.mailRequest}\n\n` +
    `${t.mailLinkLead}\n${link}\n\n` +
    `${t.mailAfter}\n\n` +
    `${t.mailIgnore}\n`;
  const html =
    `<p>${escapeHtml(t.mailGreeting(name))}</p>` +
    `<p>${escapeHtml(t.mailRequest)}</p>` +
    `<p><a href="${escapeHtml(link)}">${escapeHtml(t.mailLinkText)}</a> ${escapeHtml(t.mailLinkNote)}</p>` +
    `<p>${escapeHtml(t.mailAfter)}</p>` +
    `<p>${escapeHtml(t.mailIgnore)}</p>`;
  return { subject: t.mailSubject, text, html };
}
