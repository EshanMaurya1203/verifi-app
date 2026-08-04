export function AnalyticsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Summary Cards Skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-xl border border-white/10 bg-[#161616] p-5">
            <div className="h-3 w-24 rounded bg-white/10" />
            <div className="mt-4 h-7 w-16 rounded bg-white/10" />
            <div className="mt-2 h-3 w-32 rounded bg-white/5" />
          </div>
        ))}
      </div>

      {/* Funnel Skeleton */}
      <div className="rounded-xl border border-white/10 bg-[#161616] p-6">
        <div className="h-4 w-36 rounded bg-white/10" />
        <div className="mt-2 h-3 w-64 rounded bg-white/5" />
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-36 rounded-lg border border-white/5 bg-white/[0.02] p-4">
              <div className="h-3 w-16 rounded bg-white/10" />
              <div className="mt-2 h-4 w-28 rounded bg-white/10" />
              <div className="mt-4 h-6 w-12 rounded bg-white/10" />
            </div>
          ))}
        </div>
      </div>

      {/* Failure Breakdown Skeleton */}
      <div className="rounded-xl border border-white/10 bg-[#161616] p-6">
        <div className="h-4 w-40 rounded bg-white/10" />
        <div className="mt-2 h-3 w-56 rounded bg-white/5" />
        <div className="mt-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-full rounded bg-white/5" />
          ))}
        </div>
      </div>

      {/* Draft Recovery Skeleton */}
      <div className="rounded-xl border border-white/10 bg-[#161616] p-6">
        <div className="h-4 w-44 rounded bg-white/10" />
        <div className="mt-2 h-3 w-60 rounded bg-white/5" />
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-lg border border-white/5 bg-white/[0.02] p-4">
              <div className="h-3 w-20 rounded bg-white/10" />
              <div className="mt-3 h-5 w-12 rounded bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
