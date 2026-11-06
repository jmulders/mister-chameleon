"use client";

import { confirmDialog } from "@/components/admin/DialogHost";
import { removeUserFromTenantAction } from "../actions";

export function RemoveUserButton({
  userId,
  tenantId,
  userName,
}: {
  userId:   string;
  tenantId: string;
  userName: string;
}) {
  return (
    <form action={removeUserFromTenantAction}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="userId"   value={userId} />
      <button
        type="submit"
        className="text-xs text-red-400 hover:text-red-600 transition-colors"
        onClick={async (e) => {
          // The dialog is asynchronous, so hold the submit back and send it after a yes.
          e.preventDefault();
          const form = e.currentTarget.form;
          if (await confirmDialog(`Remove ${userName} from this tenant?`, { confirmLabel: "Remove", danger: true })) {
            form?.requestSubmit();
          }
        }}
      >
        Remove
      </button>
    </form>
  );
}
