"use client";

/**
 * IpOverrideTester
 *
 * Interactive form for testing the enrichment pipeline with a synthetic
 * visitor IP address — without leaving the dashboard or editing the URL
 * manually.
 *
 * How it works:
 *   • The user types any IPv4 or IPv6 address into the input.
 *   • The component opens the homepage at /?_ip=<address>&_ip_override=1
 *     in a new tab, triggering the enrichment pipeline for that IP.
 *   • The resulting enrichment data is visible in the EnrichmentDebugPanel
 *     at the bottom of that homepage tab.
 *
 * Safety gate:
 *   The override is silently ignored by the server unless NODE_ENV is
 *   "development" or ENABLE_DEBUG_IP_OVERRIDE=true is set.
 */

import { useState, type FormEvent } from "react";

// ── Preset IPs for quick testing ──────────────────────────────────────────────

const PRESET_IPS = [
  { label: "Google DNS (US)",         ip: "8.8.8.8"      },
  { label: "Cloudflare (US)",         ip: "1.1.1.1"      },
  { label: "SURF Netherlands (NL)",   ip: "145.0.0.1"    },
  { label: "Deutsche Telekom (DE)",   ip: "80.248.0.1"   },
  { label: "BT Group (GB)",           ip: "109.145.0.1"  },
  { label: "Localhost (no lookup)",   ip: "127.0.0.1"    },
] as const;

// ── Validation ────────────────────────────────────────────────────────────────

function isValidIp(value: string): boolean {
  if (!value.trim()) return false;
  // IPv4
  const v4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (v4.test(value)) {
    return value.split(".").every((seg) => parseInt(seg, 10) <= 255);
  }
  // IPv6 (coarse check — accepts any colon-hex pattern)
  const v6 = /^[0-9a-fA-F:]+$/;
  return v6.test(value) && value.includes(":");
}

// ── Component ─────────────────────────────────────────────────────────────────

export function IpOverrideTester() {
  const [ip, setIp]           = useState("");
  const [error, setError]     = useState<string | null>(null);
  const [launched, setLaunched] = useState(false);

  function handlePreset(preset: string) {
    setIp(preset);
    setError(null);
    setLaunched(false);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = ip.trim();

    if (!trimmed) {
      setError("Enter an IP address.");
      return;
    }
    if (!isValidIp(trimmed)) {
      setError("That doesn't look like a valid IPv4 or IPv6 address.");
      return;
    }

    setError(null);
    const url = `/?_ip=${encodeURIComponent(trimmed)}&_ip_override=1`;
    window.open(url, "_blank", "noopener,noreferrer");
    setLaunched(true);
  }

  const valid  = isValidIp(ip.trim());
  const hasIp  = ip.trim().length > 0;

  return (
    <div className="flex flex-col gap-4">

      {/* Preset buttons */}
      <div>
        <p className="mb-2 text-xs font-medium text-neutral-500 uppercase tracking-wide">
          Quick presets
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESET_IPS.map(({ label, ip: preset }) => (
            <button
              key={preset}
              type="button"
              onClick={() => handlePreset(preset)}
              className="rounded border border-neutral-200 bg-white px-2.5 py-1 text-xs font-mono text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50 transition-colors"
            >
              {preset}
              <span className="ml-1.5 text-neutral-400 font-sans not-italic">
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Manual input form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label
            htmlFor="debug-ip-input"
            className="mb-1.5 block text-xs font-medium text-neutral-700"
          >
            IP address to test
          </label>
          <div className="flex gap-2">
            <input
              id="debug-ip-input"
              type="text"
              value={ip}
              onChange={(e) => {
                setIp(e.target.value);
                setError(null);
                setLaunched(false);
              }}
              placeholder="e.g. 8.8.8.8  or  2001:4860:4860::8888"
              spellCheck={false}
              autoComplete="off"
              className={[
                "flex-1 rounded-md border px-3 py-2 font-mono text-sm",
                "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500",
                error
                  ? "border-red-400 bg-red-50"
                  : "border-neutral-300 bg-white",
              ].join(" ")}
            />
            <button
              type="submit"
              disabled={!hasIp}
              className={[
                "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                hasIp && valid
                  ? "bg-brand-700 text-white hover:bg-brand-800"
                  : hasIp && !valid
                    ? "bg-neutral-200 text-neutral-500 cursor-not-allowed"
                    : "bg-neutral-100 text-neutral-400 cursor-not-allowed",
              ].join(" ")}
            >
              Open →
            </button>
          </div>

          {error && (
            <p className="mt-1.5 text-xs text-red-600">{error}</p>
          )}
        </div>

        {/* Preview URL */}
        {hasIp && valid && (
          <p className="text-xs text-neutral-400 font-mono break-all">
            Opens:{" "}
            <span className="text-neutral-600">
              /?_ip={ip.trim()}&amp;_ip_override=1
            </span>
          </p>
        )}

        {/* Confirmation */}
        {launched && (
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
            Opened homepage with IP override in a new tab. Scroll to the{" "}
            <strong>Enrichment debug panel</strong> at the bottom of that page.
          </div>
        )}
      </form>

    </div>
  );
}
