/**
 * The mail a visitor gets when a trial starts.
 *
 * It is written in the language of the site the visitor signed up on. It makes
 * one promise about money, the same one the price page and the checkout make:
 * nothing is charged before the trial is over. It does not say that no card is
 * needed, because the checkout asks for one.
 */
import { escapeHtml } from "@/lib/html-escape";
import type { SiteLocale } from "@/lib/site-texts/locale";

export interface TrialWelcomeMailInput {
  name:      string;
  planLabel: string;
  trialEnds: Date;
  /** Link to the admin, without a trailing slash. */
  adminUrl:  string;
}

export interface TrialWelcomeMail {
  subject: string;
  text:    string;
  html:    string;
}

interface Wording {
  dateLocale: string;
  subject:    (plan: string) => string;
  greeting:   (name: string) => string;
  /** The sentence is split so the mail can set the middle part in bold. */
  active:     { before: string; strong: (plan: string) => string; after: string };
  endsLabel:  string;
  payment:    string;
  loginLine:  string;
  button:     string;
  questions:  string;
  signoff:    string;
}

const WORDING: Record<SiteLocale, Wording> = {
  nl: {
    dateLocale: "nl-NL",
    subject:    (plan) => `Welkom bij Mister Chameleon. Je proefperiode met ${plan} is begonnen`,
    greeting:   (name) => `Hallo ${name},`,
    active:     { before: "Je ", strong: (plan) => `gratis proefperiode van 14 dagen met ${plan}`, after: " is begonnen." },
    endsLabel:  "Je proefperiode loopt tot",
    payment:    "Je betaalt pas na 14 dagen. Tot die dag kun je stoppen.",
    loginLine:  "Log in en zet je eerste regel aan.",
    button:     "Naar je account",
    questions:  "Heb je een vraag? Beantwoord deze mail, dan helpen we je verder.",
    signoff:    "Het team van Mister Chameleon",
  },
  en: {
    dateLocale: "en-GB",
    subject:    (plan) => `Welcome to Mister Chameleon. Your ${plan} trial has started`,
    greeting:   (name) => `Hi ${name},`,
    active:     { before: "Your ", strong: (plan) => `14-day free trial on the ${plan} plan`, after: " is now active." },
    endsLabel:  "Your trial runs until",
    payment:    "You pay nothing until the 14 days are over. You can cancel any time before that.",
    loginLine:  "Log in and switch on your first rule.",
    button:     "Go to your account",
    questions:  "Questions? Reply to this email and we will help you.",
    signoff:    "The Mister Chameleon team",
  },
};

export function buildTrialWelcomeMail(locale: SiteLocale, input: TrialWelcomeMailInput): TrialWelcomeMail {
  const w    = WORDING[locale];
  const ends = input.trialEnds.toLocaleDateString(w.dateLocale, { day: "numeric", month: "long", year: "numeric" });
  const link = `${input.adminUrl}/admin`;

  const text = [
    w.greeting(input.name),
    "",
    `${w.active.before}${w.active.strong(input.planLabel)}${w.active.after}`,
    "",
    `${w.endsLabel} ${ends}.`,
    w.payment,
    "",
    w.loginLine,
    link,
    "",
    w.questions,
    "",
    w.signoff,
  ].join("\n");

  const html = `
    <p>${escapeHtml(w.greeting(input.name))}</p>
    <p>${escapeHtml(w.active.before)}<strong>${escapeHtml(w.active.strong(input.planLabel))}</strong>${escapeHtml(w.active.after)}</p>
    <ul>
      <li><strong>${escapeHtml(w.endsLabel)}</strong> ${escapeHtml(ends)}</li>
      <li>${escapeHtml(w.payment)}</li>
    </ul>
    <p>${escapeHtml(w.loginLine)}</p>
    <p>
      <a href="${escapeHtml(link)}"
         style="display:inline-block;background:#4f46e5;color:white;padding:0.75rem 1.5rem;border-radius:0.5rem;text-decoration:none;font-weight:600;">
        ${escapeHtml(w.button)}
      </a>
    </p>
    <p style="color:#6b7280;font-size:0.875rem;">${escapeHtml(w.questions)}</p>
    <p style="color:#6b7280;font-size:0.875rem;">${escapeHtml(w.signoff)}</p>
  `.trim();

  return { subject: w.subject(input.planLabel), text, html };
}
