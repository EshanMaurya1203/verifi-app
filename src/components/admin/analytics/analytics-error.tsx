interface AnalyticsErrorProps {
  readonly onRetry: () => void | Promise<void>;
  readonly isRetrying?: boolean;
}

export function AnalyticsError({ onRetry, isRetrying = false }: AnalyticsErrorProps) {
  return (
    <div
      aria-busy={isRetrying}
      className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-8 text-center"
    >
      <h3 className="text-lg font-bold text-white">Unable to load analytics</h3>
      <p className="mt-1 text-sm text-neutral-400">Please try again later.</p>
      <button
        onClick={onRetry}
        disabled={isRetrying}
        aria-busy={isRetrying}
        className="mt-4 inline-flex items-center justify-center space-x-2 rounded-lg bg-white/10 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isRetrying && (
          <span
            className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"
            aria-hidden="true"
          />
        )}
        <span>{isRetrying ? "Retrying..." : "Retry"}</span>
      </button>
    </div>
  );
}
