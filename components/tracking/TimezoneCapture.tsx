"use client";

/**
 * TimezoneCapture
 *
 * Writes the visitor's OWN IANA timezone to the non-httpOnly `mc_tz` cookie on
 * first render, so time-based rules (currentHour, timeOfDay, isWeekend) are
 * accurate PER VISITOR from the next server render onward.
 *
 * The server-side read chain already exists (build-decision-context reads mc_tz
 * with precedence: visitor mc_tz > tenant.timezone > UTC); only this client-side
 * capture was missing (the fuller ClientContextCollector is not mounted). This is
 * the minimal, single-purpose writer — no network call, no other signals.
 *
 * Fails open: on any error the cookie is simply not set and the server falls back
 * to the tenant timezone (then UTC).
 */

import { useEffect } from "react";
import { TIMEZONE_COOKIE } from "@/context/client-context";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export function TimezoneCapture() {
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!tz) return;
      document.cookie =
        `${TIMEZONE_COOKIE}=${encodeURIComponent(tz)}; path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax`;
    } catch {
      // Fail open — server falls back to tenant timezone, then UTC.
    }
  }, []);

  return null;
}
