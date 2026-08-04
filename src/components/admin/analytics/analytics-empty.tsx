export function AnalyticsEmpty() {
  return (
    <div className="rounded-xl border border-white/10 bg-[#161616] p-12 text-center shadow-sm">
      <h3 className="text-lg font-bold text-white">No onboarding activity found</h3>
      <p className="mt-1 text-sm text-neutral-400">
        There is no onboarding data for the selected time range.
      </p>
    </div>
  );
}
