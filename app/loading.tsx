export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="h-9 w-64 animate-pulse rounded-lg bg-foreground/5" />
      <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded bg-foreground/5" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="h-44 animate-pulse rounded-2xl border border-line bg-surface p-5"
          >
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-lg bg-foreground/5" />
              <div className="h-10 w-10 rounded-full bg-foreground/5" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3.5 w-3/4 rounded bg-foreground/5" />
                <div className="h-3 w-1/3 rounded bg-foreground/5" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-3 w-full rounded bg-foreground/5" />
              <div className="h-3 w-5/6 rounded bg-foreground/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
