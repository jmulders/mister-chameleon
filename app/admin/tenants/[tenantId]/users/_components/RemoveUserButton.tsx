"use client";

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
        onClick={(e) => {
          if (!confirm(`Remove ${userName} from this tenant?`)) e.preventDefault();
        }}
      >
        Remove
      </button>
    </form>
  );
}
