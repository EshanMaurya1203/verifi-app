export default function EditPageLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="mx-auto max-w-4xl px-4 pt-24 pb-12 animate-pulse">
        {/* Header skeleton */}
        <div className="h-8 w-64 bg-neutral-800 rounded-xl mb-8" />
        
        <div className="bg-neutral-900/50 border border-white/5 p-6 rounded-3xl space-y-6">
          {/* Field skeletons */}
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-28 bg-neutral-800 rounded" />
              <div className="h-11 w-full bg-neutral-800/60 rounded-xl" />
            </div>
          ))}
          
          {/* Checkbox skeleton */}
          <div className="pt-4 border-t border-white/5 flex items-center gap-3">
            <div className="w-5 h-5 bg-neutral-800 rounded" />
            <div className="space-y-1">
              <div className="h-4 w-24 bg-neutral-800 rounded" />
              <div className="h-3 w-64 bg-neutral-800/60 rounded" />
            </div>
          </div>
        </div>

        {/* Button skeletons */}
        <div className="flex items-center gap-4 mt-6">
          <div className="h-12 w-36 bg-neutral-800 rounded-xl" />
          <div className="h-12 w-24 bg-neutral-800/50 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
