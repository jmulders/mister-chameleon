"use client";

import { useTransition } from "react";
import { logoutAction }  from "@/app/admin/login/actions";

/**
 * LogoutButton
 *
 * Calls the logoutAction Server Action which clears the mc_admin_token cookie
 * and redirects to /admin/login.  Uses a form so no JS is needed for the
 * redirect — degrades gracefully if JS is disabled.
 */
export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={logoutAction}
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => logoutAction());
      }}
    >
      <button
        type="submit"
        disabled={isPending}
        className="text-xs text-neutral-400 hover:text-red-600 transition-colors disabled:opacity-50"
      >
        {isPending ? "Signing out…" : "Sign out"}
      </button>
    </form>
  );
}
