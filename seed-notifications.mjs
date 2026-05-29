/**
 * One-off script — seed 4 notification variants for mister-chameleon.
 * Plain ESM, no TypeScript, no esbuild.
 */
import { createClient } from "@sanity/client";

const client = createClient({
  projectId:  "in3s2m2m",
  dataset:    "production",
  apiVersion: "2024-01-01",
  token:      "skQ7LySrJTNDjXD3qGqdba0GUlTTRwhYnsoZN6jr4FWlOwNElRJ8maVis7hPTR43l2fImwl921gkOHwXwrKooqNNYGMwz0RVHNNE7DjTLVK91aqKxPCTI2iCKuW2FESRGt7srY8AiuYsQ61GFORPRtrLKeb67YrBtK8GEs9poAMsxnOKcbcZ",
  useCdn:     false,
});

const TENANT = "mister-chameleon";

const docs = [
  {
    _id:           `${TENANT}_notification_default`,
    _type:         "notificationVariant",
    tenantId:      TENANT,
    key:           "notification_default",
    isActive:      true,
    message:       "👋 See how Mister Chameleon adapts your website to every visitor — no code needed.",
    severity:      "info",
    ctaLabel:      "See how it works",
    ctaHref:       "/how-it-works",
    position:      "top",
    dismissible:   true,
    autoDismissMs: 0,
  },
  {
    _id:           `${TENANT}_notification_offer`,
    _type:         "notificationVariant",
    tenantId:      TENANT,
    key:           "notification_offer",
    isActive:      true,
    message:       "🎉 Start free — no credit card required. Set up your first personalised experience in under 10 minutes.",
    severity:      "promo",
    ctaLabel:      "Start for free",
    ctaHref:       "/signup",
    position:      "top",
    dismissible:   true,
    autoDismissMs: 0,
  },
  {
    _id:           `${TENANT}_notification_urgency`,
    _type:         "notificationVariant",
    tenantId:      TENANT,
    key:           "notification_urgency",
    isActive:      true,
    message:       "⚡ Demo slots this week are filling up. Most teams see results within their first session.",
    severity:      "warning",
    ctaLabel:      "Book a slot now",
    ctaHref:       "/demo",
    position:      "top",
    dismissible:   true,
    autoDismissMs: 0,
  },
  {
    _id:           `${TENANT}_notification_returning`,
    _type:         "notificationVariant",
    tenantId:      TENANT,
    key:           "notification_returning",
    isActive:      true,
    message:       "Welcome back! Ready to see Mister Chameleon on your own website?",
    severity:      "success",
    ctaLabel:      "Book a personalised demo",
    ctaHref:       "/demo",
    position:      "bottom-right",
    dismissible:   true,
    autoDismissMs: 8000,
  },
];

console.log("\n🦎  Seeding notification variants for mister-chameleon\n");

for (const doc of docs) {
  try {
    await client.createOrReplace(doc);
    try { await client.delete(`drafts.${doc._id}`); } catch { /* no draft */ }
    console.log(`   ✅  ${doc._id}  (${doc.key})`);
  } catch (err) {
    console.error(`   ❌  ${doc._id} — ${err.message}`);
  }
}

console.log("\n🦎  Done.\n");
