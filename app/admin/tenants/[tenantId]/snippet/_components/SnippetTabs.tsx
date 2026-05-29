"use client";

/**
 * SnippetTabs
 *
 * Tab shell for the Snippet Integration page.
 *
 * Tabs:
 *   Install       — site key, script tag, markup guide (SnippetPageClient)
 *   How it works  — end-to-end flow explainer (HowItWorksContent)
 *
 * State is local — no URL change needed; the sub-page
 * /snippet/how-it-works now redirects here instead.
 */

import { useState } from "react";
import { SnippetPageClient } from "./SnippetPageClient";
import { HowItWorksContent } from "./HowItWorksContent";

type Tab = "install" | "how-it-works";

const TABS: { id: Tab; label: string }[] = [
  { id: "install",       label: "Install"       },
  { id: "how-it-works",  label: "How it works"  },
];

interface SnippetTabsProps {
  tenantId:    string;
  siteKey:     string | null;
  enabled:     boolean;
  generatedAt: string | null;
  snippetSrc:  string;
  initialTab?: Tab;
}

export function SnippetTabs({
  tenantId,
  siteKey,
  enabled,
  generatedAt,
  snippetSrc,
  initialTab = "install",
}: SnippetTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  return (
    <div>
      {/* ── Tab bar ──────────────────────────────────────────────────────────── */}
      <div className="mb-6 border-b border-neutral-200">
        <nav className="-mb-px flex gap-1" aria-label="Snippet tabs">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`
                  px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                  ${isActive
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-neutral-500 hover:text-neutral-800 hover:border-neutral-300"
                  }
                `}
                aria-current={isActive ? "page" : undefined}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Tab panels ───────────────────────────────────────────────────────── */}
      {activeTab === "install" && (
        <SnippetPageClient
          tenantId={tenantId}
          siteKey={siteKey}
          enabled={enabled}
          generatedAt={generatedAt}
          snippetSrc={snippetSrc}
        />
      )}

      {activeTab === "how-it-works" && (
        <HowItWorksContent />
      )}
    </div>
  );
}
