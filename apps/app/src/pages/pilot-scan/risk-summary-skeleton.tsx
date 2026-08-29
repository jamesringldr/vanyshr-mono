/**
 * Skeleton screen shown while pilot scan results are loading from the database.
 */
export function RiskSummarySkeleton() {
  return (
    <div
      className="flex min-h-screen w-full flex-col items-center bg-[#0B1B2B] px-6 pb-12 pt-12 font-ubuntu"
      role="main"
      aria-label="Loading risk summary"
    >
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <div className="h-6 w-24 rounded-full bg-[#1A2E42] animate-pulse" />
        <div className="mt-4 h-8 w-32 rounded bg-[#1A2E42] animate-pulse" />
        <div className="mt-2 h-4 w-40 rounded bg-[#1A2E42] animate-pulse" />
      </div>

      <div className="relative mt-8 flex w-full max-w-md items-center justify-center">
        <div className="relative aspect-square w-full max-w-[340px]">
          <div className="h-full w-full rounded-lg bg-gradient-to-br from-[#1A2E42] to-[#0f1f2e] animate-pulse" />
        </div>
      </div>

      <section className="mt-10 w-full max-w-sm" aria-label="Your areas">
        <div className="mb-3 px-0.5">
          <div className="h-4 w-20 rounded bg-[#1A2E42] animate-pulse" />
          <div className="mt-0.5 h-3 w-24 rounded bg-[#1A2E42] animate-pulse" />
        </div>

        <ul className="flex flex-col gap-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i}>
              <div className="flex items-center gap-3 rounded-2xl bg-[#1A2E42] px-4 py-3.5 animate-pulse">
                <div className="h-9 w-9 rounded-full bg-[#0f1f2e]" />
                <div className="min-w-0 flex-1">
                  <div className="h-4 w-24 rounded bg-[#0f1f2e]" />
                  <div className="mt-2 h-3 w-32 rounded bg-[#0f1f2e]" />
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="h-5 w-1.5 rounded-sm bg-[#0f1f2e]" />
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10 flex w-full max-w-sm justify-center">
        <div className="h-14 w-14 rounded-full bg-[#1A2E42] animate-pulse" />
      </div>
    </div>
  );
}
