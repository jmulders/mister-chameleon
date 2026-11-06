/** Shown while an admin page streams in: the page shape, not a spinner. */
export default function AdminLoading() {
  return (
    <div className="max-w-6xl animate-pulse space-y-6 p-4 sm:p-8" role="status" aria-label="Loading">
      <div className="space-y-2">
        <div className="h-6 w-48 rounded-md bg-neutral-200" />
        <div className="h-4 w-80 max-w-full rounded-md bg-neutral-100" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl border border-neutral-200 bg-white" />
        ))}
      </div>
      <div className="h-72 rounded-xl border border-neutral-200 bg-white" />
    </div>
  );
}
