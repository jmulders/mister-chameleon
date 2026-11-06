import { cn } from "@/lib/utils";

/**
 * Pass / open indicator for readiness lists: a filled green tick, or a hollow
 * amber circle for what still has to be done (it is not an error).
 */
export function CheckIcon({ passed, className }: { passed: boolean; className?: string }) {
  if (passed) {
    return (
      <span
        aria-hidden
        className={cn("inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-success-600 text-white", className)}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" className="size-2.5">
          <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
        </svg>
      </span>
    );
  }
  return (
    <span aria-hidden className={cn("inline-block size-4 shrink-0 rounded-full border-2 border-warning-500", className)} />
  );
}
