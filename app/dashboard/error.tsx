"use client";

import { RouteError } from "@/components/admin/RouteError";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} homeHref="/dashboard" />;
}
