/**
 * Demo Flows
 *
 * Predefined event sequences that simulate real visitor behavior step-by-step.
 * Each flow fires real tracking events so the full pipeline is exercised:
 *   page_view → scoring → updateBehaviorState → new journey state
 *
 * ─── How flows work ───────────────────────────────────────────────────────────
 *
 *   1. `runDemoFlow(flow)` iterates through the steps array.
 *   2. Each step calls `trackEvent()` with the specified event type + payload.
 *   3. Between steps, `delay` ms passes (controlled by setTimeout).
 *   4. Progress is emitted via an `onProgress` callback so the UI can animate.
 *   5. After all steps, `onComplete` fires.
 *
 * ─── Safety ──────────────────────────────────────────────────────────────────
 *
 *   These flows call the real tracking pipeline in dev/preview mode only.
 *   They will create real events in the DB for the current session.
 *   This is intentional — it lets you test the full pipeline end-to-end.
 *
 *   Events are clearly tagged with `metadata.demo_flow: true` so they can
 *   be filtered in analytics if needed.
 */

// ── Step types ────────────────────────────────────────────────────────────────

export type DemoEventType =
  | "page_view"
  | "cta_click"
  | "form_start"
  | "form_submit"
  | "download";

export interface DemoFlowStep {
  /** Event type to fire. */
  eventType:  DemoEventType;
  /** Optional event_value (e.g. CTA id, button label). */
  eventValue?: string;
  /** Optional page path override (defaults to current pathname). */
  pagePath?:   string;
  /** Optional page category. */
  pageCategory?: string;
  /** Optional interest-profile keywords for this page view. */
  pageKeywords?: string[];
  /** Human-readable label shown in the progress UI. */
  label:       string;
  /** Milliseconds to wait BEFORE this step fires. Default 0. */
  delay?:      number;
}

export interface DemoFlow {
  key:         string;
  label:       string;
  description: string;
  icon:        string;
  /** Expected final funnel stage after running all steps. */
  expectedStage: string;
  steps:       DemoFlowStep[];
}

// ── Flow definitions ──────────────────────────────────────────────────────────

export const DEMO_FLOWS: Record<string, DemoFlow> = {

  intent_buildup: {
    key:           "intent_buildup",
    label:         "Intent Build-up",
    description:   "Simulates a genuine buyer journey: home → about → services → pricing → CTA click → form start.",
    icon:          "📈",
    expectedStage: "high_intent",
    steps: [
      { eventType: "page_view",  pagePath: "/",          pageCategory: "homepage",  pageKeywords: ["personalisation", "adaptive", "website", "conversion", "platform", "features"],                              label: "Landing on homepage",        delay: 0    },
      { eventType: "page_view",  pagePath: "/about",     pageCategory: "about",     pageKeywords: ["team", "cultuur", "culture", "merk", "employer brand", "about"],                                             label: "Exploring About page",       delay: 1200 },
      { eventType: "page_view",  pagePath: "/services",  pageCategory: "services",  pageKeywords: ["diensten", "services", "use-case", "oplossing", "solution"],                                                 label: "Browsing Services",          delay: 1000 },
      { eventType: "page_view",  pagePath: "/cases",     pageCategory: "cases",     pageKeywords: ["cases", "trust", "klanten", "case study", "reviews"],                                                        label: "Reading Case Studies",       delay: 1200 },
      { eventType: "page_view",  pagePath: "/pricing",   pageCategory: "pricing",   pageKeywords: ["pricing", "plan", "cost", "prijs", "abonnement", "budget", "price", "tarieven"],                             label: "Checking Pricing",           delay: 900  },
      { eventType: "cta_click",  eventValue: "main_cta",                                                                                                                                                         label: "Clicking main CTA",          delay: 1500 },
      { eventType: "form_start",                                                                                                                                                                                  label: "Starting the contact form",  delay: 1000 },
    ],
  },

  fake_intent: {
    key:           "fake_intent",
    label:         "Fake Intent (Spam Clicks)",
    description:   "Rapid-fire pricing visits with no diversity. Demonstrates how friction scoring suppresses confidence.",
    icon:          "🤖",
    expectedStage: "consideration",
    steps: [
      { eventType: "page_view", pagePath: "/pricing", pageCategory: "pricing", pageKeywords: ["pricing", "plan", "cost", "prijs", "abonnement", "budget", "price", "tarieven"], label: "Pricing visit #1", delay: 0   },
      { eventType: "page_view", pagePath: "/pricing", pageCategory: "pricing", pageKeywords: ["pricing", "plan", "cost", "prijs", "abonnement", "budget", "price", "tarieven"], label: "Pricing visit #2", delay: 300 },
      { eventType: "page_view", pagePath: "/pricing", pageCategory: "pricing", pageKeywords: ["pricing", "plan", "cost", "prijs", "abonnement", "budget", "price", "tarieven"], label: "Pricing visit #3", delay: 300 },
      { eventType: "page_view", pagePath: "/pricing", pageCategory: "pricing", pageKeywords: ["pricing", "plan", "cost", "prijs", "abonnement", "budget", "price", "tarieven"], label: "Pricing visit #4", delay: 300 },
      { eventType: "page_view", pagePath: "/pricing", pageCategory: "pricing", pageKeywords: ["pricing", "plan", "cost", "prijs", "abonnement", "budget", "price", "tarieven"], label: "Pricing visit #5", delay: 300 },
      { eventType: "page_view", pagePath: "/pricing", pageCategory: "pricing", pageKeywords: ["pricing", "plan", "cost", "prijs", "abonnement", "budget", "price", "tarieven"], label: "Pricing visit #6 — friction building", delay: 300 },
    ],
  },

  post_conversion: {
    key:           "post_conversion",
    label:         "Post-Conversion",
    description:   "Completes the full journey ending in form submission. Triggers customer mode.",
    icon:          "🎉",
    expectedStage: "customer",
    steps: [
      { eventType: "page_view",   pagePath: "/",        pageCategory: "homepage", pageKeywords: ["personalisation", "adaptive", "website", "conversion", "platform"],                             label: "Homepage visit",          delay: 0    },
      { eventType: "page_view",   pagePath: "/pricing",  pageCategory: "pricing", pageKeywords: ["pricing", "plan", "cost", "prijs", "abonnement", "budget", "price", "tarieven"],                label: "Checking Pricing",        delay: 800  },
      { eventType: "cta_click",   eventValue: "demo_cta",                                                                                                                                          label: "Clicking demo CTA",       delay: 1000 },
      { eventType: "form_start",                                                                                                                                                                    label: "Starting form",           delay: 600  },
      { eventType: "form_submit",                                                                                                                                                                   label: "Submitting form ✓",       delay: 2000 },
    ],
  },

  expansion_opportunity: {
    key:           "expansion_opportunity",
    label:         "Expansion Opportunity",
    description:   "Customer returning to the pricing page — classic expansion/upgrade signal.",
    icon:          "🚀",
    expectedStage: "high_intent",
    steps: [
      { eventType: "page_view", pagePath: "/",          pageCategory: "homepage",  pageKeywords: ["personalisation", "adaptive", "website", "platform"],                                         label: "Return visit to homepage",      delay: 0    },
      { eventType: "page_view", pagePath: "/pricing",   pageCategory: "pricing",   pageKeywords: ["pricing", "plan", "cost", "prijs", "abonnement", "budget", "price", "tarieven"],               label: "Back to Pricing",               delay: 900  },
      { eventType: "page_view", pagePath: "/cases",     pageCategory: "cases",     pageKeywords: ["cases", "trust", "klanten", "case study", "reviews"],                                          label: "Checking Case Studies",         delay: 1000 },
      { eventType: "page_view", pagePath: "/pricing",   pageCategory: "pricing",   pageKeywords: ["pricing", "plan", "cost", "prijs", "abonnement", "budget", "price", "tarieven"],               label: "Pricing again — strong signal", delay: 800  },
      { eventType: "cta_click", eventValue: "upgrade_cta",                                                                                                                                        label: "Clicking upgrade CTA",          delay: 1200 },
    ],
  },

  churn_risk: {
    key:           "churn_risk",
    label:         "Churn Risk",
    description:   "Low-engagement session with no progression — visitor seems stuck or confused.",
    icon:          "📉",
    expectedStage: "consideration",
    steps: [
      { eventType: "page_view", pagePath: "/",         pageCategory: "homepage", pageKeywords: ["personalisation", "adaptive", "website", "platform"],   label: "Homepage (brief visit)", delay: 0    },
      { eventType: "page_view", pagePath: "/pricing",  pageCategory: "pricing",  pageKeywords: ["pricing", "plan", "cost", "prijs", "abonnement"],        label: "Pricing — quick exit",  delay: 500  },
      { eventType: "page_view", pagePath: "/",         pageCategory: "homepage", pageKeywords: ["personalisation", "adaptive", "website", "platform"],   label: "Back to homepage",      delay: 400  },
      { eventType: "page_view", pagePath: "/about",    pageCategory: "about",    pageKeywords: ["team", "cultuur", "about"],                             label: "About — no engagement", delay: 600  },
    ],
  },
};

// ── Ordered list for UI ───────────────────────────────────────────────────────

export const DEMO_FLOW_LIST: DemoFlow[] = [
  DEMO_FLOWS.intent_buildup,
  DEMO_FLOWS.fake_intent,
  DEMO_FLOWS.post_conversion,
  DEMO_FLOWS.expansion_opportunity,
  DEMO_FLOWS.churn_risk,
];

// ── Runner ────────────────────────────────────────────────────────────────────

export interface DemoFlowProgress {
  stepIndex:   number;
  totalSteps:  number;
  label:       string;
  done:        boolean;
}

export type ProgressCallback = (progress: DemoFlowProgress) => void;

/**
 * Runs a demo flow by firing real tracking events step-by-step.
 *
 * @param flow         The flow to run.
 * @param trackEvent   The tracking function (imported from @/tracking).
 * @param onProgress   Called before each step with progress info.
 * @param onComplete   Called when all steps are done.
 * @returns            A cancel function that aborts remaining steps.
 */
export function runDemoFlow(
  flow:        DemoFlow,
  trackEvent:  (type: string, payload?: Record<string, unknown>) => void,
  onProgress?: ProgressCallback,
  onComplete?: () => void,
): () => void {
  let cancelled = false;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  async function runStep(index: number, accumulatedDelay: number): Promise<void> {
    if (cancelled || index >= flow.steps.length) {
      if (!cancelled && onComplete) onComplete();
      return;
    }

    const step = flow.steps[index]!;
    const delay = step.delay ?? 0;

    timeout = setTimeout(() => {
      if (cancelled) return;

      onProgress?.({
        stepIndex:  index,
        totalSteps: flow.steps.length,
        label:      step.label,
        done:       false,
      });

      trackEvent(step.eventType, {
        page_path:     step.pagePath    ?? (typeof window !== "undefined" ? window.location.pathname : "/"),
        page_category: step.pageCategory,
        event_value:   step.eventValue,
        page_keywords: step.pageKeywords ?? [],
        demo_flow:     flow.key,
        demo_step:     index,
      });

      if (index === flow.steps.length - 1) {
        onProgress?.({
          stepIndex:  index,
          totalSteps: flow.steps.length,
          label:      step.label,
          done:       true,
        });
        if (onComplete) onComplete();
      } else {
        void runStep(index + 1, 0);
      }
    }, delay);
  }

  void runStep(0, 0);

  return () => {
    cancelled = true;
    if (timeout !== null) clearTimeout(timeout);
  };
}
