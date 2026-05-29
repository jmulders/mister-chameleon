/**
 * DeletePageButton
 *
 * Client component that renders a "Delete" link for a single page row in the
 * tenant pages list.  Calls deletePageAction, which enforces tenant scoping
 * so a button on one tenant's page can never delete another tenant's page.
 *
 * UX:
 *   • window.confirm guard — requires explicit user confirmation before calling
 *     the server action, preventing accidental deletions from a misclick.
 *   • useTransition — disables the button while the deletion is in flight so
 *     the user can't trigger a double-delete.
 *   • alert on failure — surfaces the error message from deletePageAction when
 *     the deletion fails (page not found, wrong tenant, DB error, etc.).
 *
 * This component contains no sensitive state and only calls a single server
 * action, making it safe to render in any Server Component that passes the
 * correct tenantId/pageId from route params.
 */

"use client";

import { useTransition } from "react";
import { deletePageAction } from "../actions";

interface DeletePageButtonProps {
  /** The tenant that owns this page (from route params — server-supplied). */
  tenantId:  string;
  /** The stable page UUID. */
  pageId:    string;
  /** Human-readable title shown in the confirmation dialog. */
  pageTitle: string;
}

export function DeletePageButton({
  tenantId,
  pageId,
  pageTitle,
}: DeletePageButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    // Explicit confirmation — the dialog names the page so the operator can
    // verify they are deleting the intended entry before proceeding.
    if (
      !window.confirm(
        `Delete "${pageTitle}"?\n\nThis cannot be undone. The page will be permanently removed from the tenant.`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await deletePageAction(tenantId, pageId);
      if (!result.ok) {
        // Surface the server-side error message so the operator knows why the
        // deletion failed (e.g. page not found, already deleted, etc.).
        window.alert(`Failed to delete page: ${result.error}`);
      }
      // On success the server action calls revalidatePath, which triggers a
      // Server Component re-render and removes the deleted row from the list.
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label={`Delete ${pageTitle}`}
      className={[
        "text-xs transition-colors",
        isPending
          ? "cursor-not-allowed text-neutral-300"
          : "text-red-400 hover:text-red-600",
      ].join(" ")}
    >
      {isPending ? "Deleting…" : "Delete"}
    </button>
  );
}
