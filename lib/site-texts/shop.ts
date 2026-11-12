/**
 * Site texts for the shop flow: cart, checkout and the page after payment.
 *
 * Used by app/(site)/cart, app/(site)/checkout, the CartSummaryBlock and
 * CheckoutBlock, and the add-to-cart buttons on the pricing page.
 *
 * `en` is what these screens always said. `nl` is the same in Dutch. A text
 * with a variable part is a small function, so the word order can differ per
 * language. A sentence with a link in the middle is cut in pieces around the
 * link.
 *
 * What stays the same in both languages and is therefore not in here: plan
 * names (Starter, Growth, Pro / Agency), the names of the credit bundles, and
 * the number of credits (always written the Dutch way, as before).
 */

import type { SiteTexts } from "./locale";

export type ShopTexts = {
  // ── Amounts ────────────────────────────────────────────────────────────────
  /** An amount in cents. Whole euros without decimals. */
  money:        (cents: number) => string;
  /** An amount in cents, rounded to whole euros. */
  moneyWhole:   (cents: number) => string;
  /** A formatted price with "per month" behind it, short. */
  pricePerMonth: (price: string) => string;

  // ── Page titles (browser tab) ──────────────────────────────────────────────
  metaCartTitle:     string;
  metaCheckoutTitle: string;
  metaSuccessTitle:  string;

  // ── Shared by several screens ──────────────────────────────────────────────
  viewPricing:       string;
  yourOrder:         string;
  orderSummary:      string;
  planLabel:         (name: string) => string;
  freeTrial14:       string;
  afterTrial:        string;
  dueToday:          string;
  proceedToCheckout: string;
  backToPricing:     string;
  /** What a plan includes, per plan id. */
  planFeatures:      Record<string, string[]>;

  // ── Add-to-cart buttons (pricing page) ─────────────────────────────────────
  planButton:  string;
  addToCart:   string;

  // ── Cart page ──────────────────────────────────────────────────────────────
  cartEmptyTitle:     string;
  cartEmptyBody:      string;
  cartHeading:        string;
  planEyebrow:        string;
  /** `period` is what the cart stored with the plan, "/month". */
  periodAfterTrial:   (period: string) => string;
  removePlan:         string;
  bundleEyebrow:      (credits: string) => string;
  bundleEachNote:     (price: string) => string;
  addCreditsHeading:  string;
  addToOrder:         string;
  planChargesNote:    (price: string) => string;
  bundlesInvoicedSeparately: string;
  cartTrust:          string[];
  qtyRemove:          string;
  qtyDecrease:        string;
  qtyIncrease:        string;

  // ── Checkout: the form ─────────────────────────────────────────────────────
  checkoutEmptyTitle: string;
  checkoutEmptyBody:  string;
  createAccount:      string;
  startingTrial:      (planName: string) => string;
  accountDetails:     string;
  trialCardNote:      string;
  fullName:           string;
  fullNamePlaceholder: string;
  companyName:        string;
  companyPlaceholder: string;
  workEmail:          string;
  emailPlaceholder:   string;
  password:           string;
  errNameRequired:    string;
  errEmailRequired:   string;
  errEmailInvalid:    string;
  errCompanyRequired: string;
  errPasswordShort:   string;
  errPasswordUpper:   string;
  errPasswordLower:   string;
  errPasswordNumber:  string;
  errGeneric:         string;
  errNetwork:         string;
  redirectingToStripe: string;
  submitStartTrial:   string;
  submitCompleteOrder: string;
  /** "By creating an account you agree to our [terms] and [privacy]." */
  legalBefore:        string;
  legalTerms:         string;
  legalBetween:       string;
  legalPrivacy:       string;
  legalAfter:         string;
  checkoutTrust:      string[];
  creditsInvoicedSeparately: string;
  editCart:           string;

  // ── Checkout block (signup form without payment) ───────────────────────────
  pwCheckLength:      string;
  pwCheckUpper:       string;
  pwCheckLower:       string;
  pwCheckNumber:      string;
  accountReady:       string;
  /** Followed by the e-mail address in bold and `confirmationSentAfter`. */
  confirmationSentTo: string;
  confirmationSentAfter: string;
  trialStartedNote:   string;
  creatingAccount:    string;
  submitStartYourTrial: string;
  checkoutBlockTrust: string[];

  // ── Cart summary block ─────────────────────────────────────────────────────
  mostPopular:        string;
  perMonthAfterTrial: string;
  includedInTrial:    string;
  trialDaysBold:      (days: number) => string;
  noCardCancelAnyTime: string;
  noPlanSelected:     string;
  creditBundles:      string;
  creditsAndQty:      (credits: string, quantity: number) => string;
  trustSecureSignup:  string;
  trustNoCard:        string;
  trustLiveFast:      string;

  // ── After payment ──────────────────────────────────────────────────────────
  paymentConfirmed:   string;
  thanksTrialStarted: string;
  settingUpAccount:   string;
  stepPayment:        string;
  stepAccount:        string;
  stepEmail:          string;
  goToDashboard:      string;
  redirectingIn:      (seconds: number) => string;
  needHelp:           string;
  /** "If you don't receive ... or [contact our support team]." */
  helpBefore:         string;
  helpLink:           string;
  helpAfter:          string;
};

export const SHOP_TEXTS: SiteTexts<ShopTexts> = {
  // ════════════════════════════════════════════════════════════════════════════
  en: {
    money: (cents) => {
      if (cents % 100 === 0) return `€${cents / 100}`;
      return `€${(cents / 100).toFixed(2)}`;
    },
    moneyWhole:    (cents) => `€${(cents / 100).toFixed(0)}`,
    pricePerMonth: (price) => `${price}/mo`,

    metaCartTitle:     "Your cart — Mister Chameleon",
    metaCheckoutTitle: "Checkout — Mister Chameleon",
    metaSuccessTitle:  "Payment confirmed — Mister Chameleon",

    viewPricing:       "View pricing",
    yourOrder:         "Your order",
    orderSummary:      "Order summary",
    planLabel:         (name) => `${name} plan`,
    freeTrial14:       "14-day free trial",
    afterTrial:        "after trial",
    dueToday:          "Due today",
    proceedToCheckout: "Proceed to checkout",
    backToPricing:     "Back to pricing",
    // Same content as the price list on /prijzen, which follows billing/plans.ts.
    planFeatures: {
      starter: [
        "25,000 personalised sessions/month",
        "Unlimited rules, segments and A/B tests",
        "Measured against a control group",
      ],
      growth: [
        "150,000 personalised sessions/month",
        "Everything in Starter",
        "Full analytics dashboard",
        "AI-assisted variant decisions",
        "Company recognition and CRM link",
      ],
      pro: [
        "500,000 personalised sessions/month",
        "Everything in Growth",
        "Several sites in one environment",
        "Priority support",
      ],
    },

    planButton: "Start free trial",
    addToCart:  "Add to cart",

    cartEmptyTitle:    "Your cart is empty",
    cartEmptyBody:     "Head back to pricing to pick a plan or add credit bundles.",
    cartHeading:       "Your order",
    planEyebrow:       "Subscription plan — 14-day free trial",
    periodAfterTrial:  (period) => `${period} after trial`,
    removePlan:        "Remove plan",
    bundleEyebrow:     (credits) => `Credit bundle — ${credits} credits`,
    bundleEachNote:    (price) => `${price} each · credits never expire`,
    addCreditsHeading: "Add Chameleon Credits (optional)",
    addToOrder:        "+ Add to order",
    planChargesNote:   (price) => `Plan charges (${price}/mo) begin after your 14-day free trial.`,
    bundlesInvoicedSeparately: "Credit bundles are invoiced separately.",
    cartTrust: [
      "🔒 Secure — 256-bit SSL",
      "💳 No charge for 14 days",
      "🚀 Start today",
      "✖ Cancel any time",
    ],
    qtyRemove:   "Remove",
    qtyDecrease: "Decrease",
    qtyIncrease: "Increase",

    checkoutEmptyTitle:  "Nothing to check out yet",
    checkoutEmptyBody:   "Pick a plan or credit bundle on the pricing page first.",
    createAccount:       "Create your account",
    startingTrial:       (planName) => `Starting your ${planName} trial`,
    accountDetails:      "Account details",
    trialCardNote:       "14-day free trial. You'll add a card now but won't be charged until the trial ends.",
    fullName:            "Full name",
    fullNamePlaceholder: "Jane Smith",
    companyName:         "Company name",
    companyPlaceholder:  "Acme Inc.",
    workEmail:           "Work email",
    emailPlaceholder:    "you@company.com",
    password:            "Password",
    errNameRequired:     "Full name is required.",
    errEmailRequired:    "Email is required.",
    errEmailInvalid:     "Enter a valid email address.",
    errCompanyRequired:  "Company name is required.",
    errPasswordShort:    "Password must be at least 12 characters.",
    errPasswordUpper:    "Password needs an uppercase letter.",
    errPasswordLower:    "Password needs a lowercase letter.",
    errPasswordNumber:   "Password needs a number.",
    errGeneric:          "Something went wrong. Please try again.",
    errNetwork:          "Network error. Please check your connection and try again.",
    redirectingToStripe: "Redirecting to Stripe…",
    submitStartTrial:    "Start free trial",
    submitCompleteOrder: "Complete order",
    legalBefore:         "By creating an account you agree to our",
    legalTerms:          "Terms of Service",
    legalBetween:        "and",
    legalPrivacy:        "Privacy Policy",
    legalAfter:          ".",
    checkoutTrust: ["🔒 256-bit SSL", "💳 Secure Stripe checkout", "✓ 14-day free trial"],
    creditsInvoicedSeparately: "Credits (invoiced separately)",
    editCart:            "← Edit cart",

    pwCheckLength:         "12+ characters",
    pwCheckUpper:          "Uppercase letter",
    pwCheckLower:          "Lowercase letter",
    pwCheckNumber:         "Number",
    accountReady:          "Your account is ready",
    confirmationSentTo:    "We sent a confirmation email to",
    confirmationSentAfter: ".",
    trialStartedNote:      "Your 14-day free trial has started. You can cancel any time, and nothing is charged before it ends.",
    creatingAccount:       "Creating your account…",
    submitStartYourTrial:  "Start your free trial",
    checkoutBlockTrust: ["🔒 256-bit SSL", "💳 No charge for 14 days", "✓ 14-day free trial"],

    mostPopular:         "Most popular",
    perMonthAfterTrial:  "/month after trial",
    includedInTrial:     "Included in your trial",
    trialDaysBold:       (days) => `${days}-day free trial.`,
    noCardCancelAnyTime: "No charge for 14 days. Cancel any time.",
    noPlanSelected:      "No plan selected.",
    creditBundles:       "Credit bundles",
    creditsAndQty:       (credits, quantity) => `${credits} credits · qty ${quantity}`,
    trustSecureSignup:   "Secure signup",
    trustNoCard:         "No charge for 14 days",
    trustLiveFast:       "Start today",

    paymentConfirmed:   "Payment confirmed!",
    thanksTrialStarted: "Thank you — your 14-day free trial has started.",
    settingUpAccount:   "We're setting up your account now and will send a welcome email with login instructions within a few minutes.",
    stepPayment:        "Payment confirmed",
    stepAccount:        "Account being created",
    stepEmail:          "Welcome email on its way",
    goToDashboard:      "Go to your dashboard",
    redirectingIn:      (seconds) => `Redirecting automatically in ${seconds}s…`,
    needHelp:           "Need help?",
    helpBefore:         "If you don't receive a welcome email within 5 minutes, please check your spam folder or",
    helpLink:           "contact our support team",
    helpAfter:          ".",
  },

  // ════════════════════════════════════════════════════════════════════════════
  nl: {
    money: (cents) => {
      const whole = cents % 100 === 0;
      return `€ ${(cents / 100).toLocaleString("nl-NL", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
    },
    moneyWhole:    (cents) => `€ ${Number((cents / 100).toFixed(0)).toLocaleString("nl-NL")}`,
    pricePerMonth: (price) => `${price} per maand`,

    metaCartTitle:     "Je winkelwagen | Mister Chameleon",
    metaCheckoutTitle: "Afrekenen | Mister Chameleon",
    metaSuccessTitle:  "Betaling gelukt | Mister Chameleon",

    viewPricing:       "Bekijk de prijzen",
    yourOrder:         "Je bestelling",
    orderSummary:      "Je bestelling",
    planLabel:         (name) => `Pakket ${name}`,
    freeTrial14:       "14 dagen gratis proberen",
    afterTrial:        "na de proefperiode",
    dueToday:          "Vandaag te betalen",
    proceedToCheckout: "Afrekenen",
    backToPricing:     "Verder winkelen",
    planFeatures: {
      starter: [
        "25.000 gepersonaliseerde bezoeken per maand",
        "Onbeperkt regels, doelgroepen en A/B-tests",
        "Meten met een controlegroep",
      ],
      growth: [
        "150.000 gepersonaliseerde bezoeken per maand",
        "Alles uit Starter",
        "Het volledige dashboard",
        "AI die meedenkt",
        "Bedrijven herkennen en je CRM koppelen",
      ],
      pro: [
        "500.000 gepersonaliseerde bezoeken per maand",
        "Alles uit Growth",
        "Meerdere sites in één omgeving",
        "Voorrang bij support",
      ],
    },

    planButton: "Probeer 14 dagen gratis",
    addToCart:  "In winkelwagen",

    cartEmptyTitle:    "Je winkelwagen is leeg",
    cartEmptyBody:     "Kies eerst een pakket of een bundel credits op de prijspagina.",
    cartHeading:       "Je winkelwagen",
    planEyebrow:       "Pakket · 14 dagen gratis",
    // The cart keeps "/month" with the plan, whatever the language was when
    // the visitor picked it. Anything else is shown as stored.
    periodAfterTrial:  (period) => `${period === "/month" ? "per maand" : period} na de proefperiode`,
    removePlan:        "Verwijder pakket",
    bundleEyebrow:     (credits) => `Bundel van ${credits} credits`,
    bundleEachNote:    (price) => `${price} per stuk · credits verlopen niet`,
    addCreditsHeading: "Voeg Chameleon Credits toe (optioneel)",
    addToOrder:        "+ Voeg toe aan je bestelling",
    planChargesNote:   (price) => `Je betaalt ${price} per maand zodra je proefperiode van 14 dagen voorbij is.`,
    bundlesInvoicedSeparately: "Voor bundels credits krijg je een aparte factuur.",
    cartTrust: [
      "🔒 Veilig met 256-bit SSL",
      "💳 Je betaalt pas na 14 dagen",
      "🚀 Vandaag nog beginnen",
      "✖ Stop wanneer je wilt",
    ],
    qtyRemove:   "Verwijder",
    qtyDecrease: "Minder",
    qtyIncrease: "Meer",

    checkoutEmptyTitle:  "Er valt nog niets af te rekenen",
    checkoutEmptyBody:   "Kies eerst een pakket of een bundel credits op de prijspagina.",
    createAccount:       "Maak je account aan",
    startingTrial:       (planName) => `Start je proefperiode met ${planName}`,
    accountDetails:      "Je gegevens",
    trialCardNote:       "14 dagen gratis proberen. Je vult nu je kaart in, maar je betaalt pas als de proefperiode voorbij is.",
    fullName:            "Volledige naam",
    fullNamePlaceholder: "Jan Jansen",
    companyName:         "Bedrijfsnaam",
    companyPlaceholder:  "Jouw bedrijf B.V.",
    workEmail:           "Zakelijk e-mailadres",
    emailPlaceholder:    "jij@bedrijf.nl",
    password:            "Wachtwoord",
    errNameRequired:     "Vul je naam in.",
    errEmailRequired:    "Vul je e-mailadres in.",
    errEmailInvalid:     "Vul een geldig e-mailadres in.",
    errCompanyRequired:  "Vul je bedrijfsnaam in.",
    errPasswordShort:    "Je wachtwoord moet minstens 12 tekens hebben.",
    errPasswordUpper:    "Je wachtwoord heeft een hoofdletter nodig.",
    errPasswordLower:    "Je wachtwoord heeft een kleine letter nodig.",
    errPasswordNumber:   "Je wachtwoord heeft een cijfer nodig.",
    errGeneric:          "Er ging iets mis. Probeer het opnieuw.",
    errNetwork:          "Geen verbinding. Controleer je internet en probeer het opnieuw.",
    redirectingToStripe: "Je gaat naar Stripe…",
    submitStartTrial:    "Start je gratis proefperiode",
    submitCompleteOrder: "Bestelling afronden",
    legalBefore:         "Als je een account maakt, ga je akkoord met onze",
    legalTerms:          "algemene voorwaarden",
    legalBetween:        "en ons",
    legalPrivacy:        "privacyverklaring",
    legalAfter:          ".",
    checkoutTrust: ["🔒 256-bit SSL", "💳 Veilig betalen via Stripe", "✓ 14 dagen gratis proberen"],
    creditsInvoicedSeparately: "Credits (aparte factuur)",
    editCart:            "← Winkelwagen aanpassen",

    pwCheckLength:         "12 tekens of meer",
    pwCheckUpper:          "Hoofdletter",
    pwCheckLower:          "Kleine letter",
    pwCheckNumber:         "Cijfer",
    accountReady:          "Je account staat klaar",
    confirmationSentTo:    "We hebben een bevestiging gemaild naar",
    confirmationSentAfter: ".",
    trialStartedNote:      "Je gratis proefperiode van 14 dagen is begonnen. Je kunt altijd stoppen en je betaalt pas na die 14 dagen.",
    creatingAccount:       "Je account wordt aangemaakt…",
    submitStartYourTrial:  "Start je gratis proefperiode",
    checkoutBlockTrust: ["🔒 256-bit SSL", "💳 Je betaalt pas na 14 dagen", "✓ 14 dagen gratis proberen"],

    mostPopular:         "Meest gekozen",
    perMonthAfterTrial:  "per maand na de proefperiode",
    includedInTrial:     "Dit zit in je proefperiode",
    trialDaysBold:       (days) => `${days} dagen gratis proberen.`,
    noCardCancelAnyTime: "Je betaalt pas na 14 dagen. Je kunt altijd stoppen.",
    noPlanSelected:      "Je hebt nog geen pakket gekozen.",
    creditBundles:       "Bundels credits",
    creditsAndQty:       (credits, quantity) => `${credits} credits · aantal ${quantity}`,
    trustSecureSignup:   "Veilig aanmelden",
    trustNoCard:         "Je betaalt pas na 14 dagen",
    trustLiveFast:       "Vandaag nog beginnen",

    paymentConfirmed:   "Je betaling is gelukt!",
    thanksTrialStarted: "Bedankt. Je gratis proefperiode van 14 dagen is begonnen.",
    settingUpAccount:   "We maken nu je account aan. Binnen een paar minuten krijg je een welkomstmail met uitleg over het inloggen.",
    stepPayment:        "Betaling gelukt",
    stepAccount:        "Account wordt aangemaakt",
    stepEmail:          "Welkomstmail is onderweg",
    goToDashboard:      "Naar je dashboard",
    redirectingIn:      (seconds) => `Je gaat over ${seconds} seconden vanzelf door…`,
    needHelp:           "Hulp nodig?",
    helpBefore:         "Heb je na 5 minuten nog geen welkomstmail? Kijk dan in je spammap of",
    helpLink:           "neem contact op met support",
    helpAfter:          ".",
  },
};
