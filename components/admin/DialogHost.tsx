"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/**
 * Own confirm and notice dialogs instead of the browser's window.confirm and
 * alert. Call confirmDialog() from any handler; <DialogHost /> is mounted once in
 * the /admin and /dashboard layouts.
 *
 * Built on the native <dialog>, which brings the focus trap, Escape and the
 * backdrop. The safe choice has focus: Cancel on a destructive confirm, so a
 * stray Enter never deletes anything.
 */

interface DialogRequest {
  message:      string;
  confirmLabel: string;
  danger:       boolean;
  /** A notice has one button and nothing to decide. */
  notice:       boolean;
  resolve:      (ok: boolean) => void;
}

let current: DialogRequest | null = null;
const queue: DialogRequest[] = [];
const listeners = new Set<() => void>();

function publish() {
  listeners.forEach((l) => l());
}

function open(request: Omit<DialogRequest, "resolve">): Promise<boolean> {
  return new Promise((resolve) => {
    const next = { ...request, resolve };
    if (current) queue.push(next);
    else { current = next; publish(); }
  });
}

function settle(ok: boolean) {
  current?.resolve(ok);
  current = queue.shift() ?? null;
  publish();
}

export function confirmDialog(
  message: string,
  { confirmLabel = "Confirm", danger = false }: { confirmLabel?: string; danger?: boolean } = {},
): Promise<boolean> {
  return open({ message, confirmLabel, danger, notice: false });
}

export function noticeDialog(message: string): Promise<boolean> {
  return open({ message, confirmLabel: "OK", danger: false, notice: true });
}

export function DialogHost() {
  const request = useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => current,
    () => null,
  );
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (request && !dialog.open) dialog.showModal();
    if (!request && dialog.open) dialog.close();
  }, [request]);

  return (
    <dialog
      ref={ref}
      aria-label={request?.notice ? "Notice" : "Confirm"}
      // Escape: the browser fires cancel, which counts as "no".
      onCancel={(e) => { e.preventDefault(); settle(false); }}
      // A click on the backdrop lands on the dialog element itself.
      onClick={(e) => { if (e.target === ref.current) settle(false); }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-neutral-200 bg-white p-0 shadow-xl backdrop:bg-slate-950/50"
    >
      {request && (
        <div className="p-6">
          <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-800">{request.message}</p>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            {!request.notice && (
              <button
                type="button"
                autoFocus={request.danger}
                onClick={() => settle(false)}
                className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              autoFocus={!request.danger}
              onClick={() => settle(true)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                request.danger
                  ? "bg-error-600 hover:bg-error-700 focus-visible:ring-error-500"
                  : "bg-brand-600 hover:bg-brand-700 focus-visible:ring-brand-500",
              )}
            >
              {request.confirmLabel}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
